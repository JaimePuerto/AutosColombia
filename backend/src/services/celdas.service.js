import pool from '../config/database.js';

const TIPOS = new Set(['CARRO', 'MOTO']);
const texto = (v) => String(v ?? '').trim();

async function registrarEvento(connection, { celdaId, actorId, accion, motivo = null, anterior = null, nuevo = null }) {
  await connection.execute(
    `INSERT INTO historial_celdas (celda_id, operador_id, accion, motivo, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [celdaId, actorId, accion, motivo, anterior == null ? null : JSON.stringify(anterior), nuevo == null ? null : JSON.stringify(nuevo)],
  );
  await connection.execute(
    `INSERT INTO auditoria_eventos (operador_id, entidad, entidad_id, accion, motivo, valor_anterior, valor_nuevo)
     VALUES (?, 'CELDA', ?, ?, ?, ?, ?)`,
    [actorId, celdaId, accion, motivo, anterior == null ? null : JSON.stringify(anterior), nuevo == null ? null : JSON.stringify(nuevo)],
  );
}

export async function listarCeldas({ tipo, estado, buscar } = {}) {
  const where = [];
  const params = [];
  if (tipo) { if (!TIPOS.has(tipo)) throw new Error('El tipo debe ser CARRO o MOTO.'); where.push('c.tipo = ?'); params.push(tipo); }
  if (estado === 'BLOQUEADA') where.push('c.activa = FALSE');
  if (estado === 'DISPONIBLE') where.push('c.activa = TRUE AND m.id IS NULL');
  if (estado === 'OCUPADA') where.push('c.activa = TRUE AND m.id IS NOT NULL');
  if (buscar?.trim()) { where.push('(c.codigo LIKE ? OR c.ubicacion LIKE ?)'); params.push(`%${buscar.trim()}%`, `%${buscar.trim()}%`); }
  const [rows] = await pool.execute(
    `SELECT c.id, c.codigo, c.tipo, c.ubicacion, c.activa,
       CASE WHEN c.activa = FALSE THEN 'BLOQUEADA' WHEN m.id IS NOT NULL THEN 'OCUPADA' ELSE 'DISPONIBLE' END AS estado,
       v.placa, cl.nombre_razon_social AS cliente, oe.nombre AS operador_entrada
     FROM celdas c
     LEFT JOIN movimientos m ON m.celda_id = c.id AND m.fecha_salida IS NULL
     LEFT JOIN vehiculos v ON v.id = m.vehiculo_id
     LEFT JOIN clientes cl ON cl.id = v.cliente_id
     LEFT JOIN operadores oe ON oe.id = m.operador_entrada_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.tipo, c.codigo`, params,
  );
  return rows;
}

export async function resumenCeldas() {
  const [rows] = await pool.execute(
    `SELECT c.tipo, COUNT(*) AS total,
       SUM(c.activa = TRUE AND m.id IS NULL) AS disponibles,
       SUM(c.activa = TRUE AND m.id IS NOT NULL) AS ocupadas,
       SUM(c.activa = FALSE) AS bloqueadas
     FROM celdas c LEFT JOIN movimientos m ON m.celda_id = c.id AND m.fecha_salida IS NULL
     GROUP BY c.tipo ORDER BY c.tipo`,
  );
  return rows;
}

export async function crearCelda(datos, actorId) {
  const codigo = texto(datos.codigo).toUpperCase();
  const tipo = texto(datos.tipo).toUpperCase();
  const ubicacion = texto(datos.ubicacion);
  if (!codigo || !ubicacion || !TIPOS.has(tipo)) throw new Error('Código, tipo válido y ubicación son obligatorios.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO celdas (codigo, tipo, ubicacion, activa) VALUES (?, ?, ?, TRUE)', [codigo, tipo, ubicacion]);
    const nuevo = { id: result.insertId, codigo, tipo, ubicacion, estado: 'DISPONIBLE' };
    await registrarEvento(connection, { celdaId: result.insertId, actorId, accion: 'CREAR', nuevo });
    await connection.commit();
    return nuevo;
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}

export async function modificarCelda(id, datos, actorId, motivo) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM celdas WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new Error('La celda no existe.');
    const actual = rows[0];
    const [ocupada] = await connection.execute('SELECT id FROM movimientos WHERE celda_id = ? AND fecha_salida IS NULL LIMIT 1', [id]);
    if (!actual.activa || ocupada.length) throw new Error('Solo se pueden modificar celdas disponibles.');
    const codigo = texto(datos.codigo ?? actual.codigo).toUpperCase();
    const tipo = texto(datos.tipo ?? actual.tipo).toUpperCase();
    const ubicacion = texto(datos.ubicacion ?? actual.ubicacion);
    if (!codigo || !ubicacion || !TIPOS.has(tipo)) throw new Error('Código, tipo válido y ubicación son obligatorios.');
    const anterior = { codigo: actual.codigo, tipo: actual.tipo, ubicacion: actual.ubicacion };
    const nuevo = { codigo, tipo, ubicacion };
    await connection.execute('UPDATE celdas SET codigo = ?, tipo = ?, ubicacion = ? WHERE id = ?', [codigo, tipo, ubicacion, id]);
    await registrarEvento(connection, { celdaId: id, actorId, accion: 'MODIFICAR', motivo: texto(motivo) || null, anterior, nuevo });
    await connection.commit();
    return { id: Number(id), ...nuevo, estado: 'DISPONIBLE' };
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}

export async function cambiarBloqueoCelda(id, bloquear, motivo, actorId) {
  const razon = texto(motivo);
  if (!razon) throw new Error('Debes indicar el motivo de la operación.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM celdas WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new Error('La celda no existe.');
    const celda = rows[0];
    if (bloquear && !celda.activa) throw new Error('La celda ya se encuentra bloqueada.');
    if (!bloquear && celda.activa) throw new Error('La celda no está bloqueada.');
    if (bloquear) {
      const [ocupaciones] = await connection.execute(
        `SELECT v.placa, cl.nombre_razon_social AS cliente, o.nombre AS operador
         FROM movimientos m JOIN vehiculos v ON v.id=m.vehiculo_id
         LEFT JOIN clientes cl ON cl.id=v.cliente_id
         JOIN operadores o ON o.id=m.operador_entrada_id
         WHERE m.celda_id=? AND m.fecha_salida IS NULL LIMIT 1 FOR UPDATE`, [id],
      );
      if (ocupaciones.length) {
        const x = ocupaciones[0];
        throw new Error(`No se puede bloquear: está ocupada por ${x.placa}, cliente ${x.cliente || 'no identificado'}, ingreso registrado por ${x.operador}.`);
      }
    }
    const accion = bloquear ? 'BLOQUEAR' : 'DESBLOQUEAR';
    await connection.execute('UPDATE celdas SET activa = ? WHERE id = ?', [!bloquear, id]);
    await registrarEvento(connection, { celdaId: id, actorId, accion, motivo: razon, anterior: { activa: Boolean(celda.activa) }, nuevo: { activa: !bloquear } });
    await connection.commit();
    return { id: Number(id), estado: bloquear ? 'BLOQUEADA' : 'DISPONIBLE' };
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}

export async function historialCelda(id) {
  // RF-34: historial administrativo de la celda (creación, modificación, bloqueo,
  // desbloqueo) junto con los movimientos asociados (entradas, salidas y anulaciones).
  // Los eventos administrativos y los movimientos se distinguen con el campo "origen".
  const [eventos] = await pool.execute(
    `SELECT h.id, h.accion, h.motivo, h.valor_anterior, h.valor_nuevo, h.fecha_hora, o.nombre AS operador
     FROM historial_celdas h LEFT JOIN operadores o ON o.id=h.operador_id
     WHERE h.celda_id=? ORDER BY h.fecha_hora DESC, h.id DESC`, [id],
  );

  const [movimientos] = await pool.execute(
    `SELECT m.id, m.fecha_entrada, m.fecha_salida, m.anulado_en, m.motivo_anulacion,
            m.acceso_entrada, m.acceso_salida, m.observaciones,
            m.codigo_celda_snapshot, m.tipo_celda_snapshot,
            v.placa, v.tipo AS tipo_vehiculo,
            oe.nombre AS operador_entrada,
            os.nombre AS operador_salida,
            oa.nombre AS operador_anulado
     FROM movimientos m
     INNER JOIN vehiculos v ON v.id = m.vehiculo_id
     LEFT JOIN operadores oe ON oe.id = m.operador_entrada_id
     LEFT JOIN operadores os ON os.id = m.operador_salida_id
     LEFT JOIN operadores oa ON oa.id = m.anulado_por
     WHERE m.celda_id=?
     ORDER BY m.fecha_entrada DESC, m.id DESC`, [id],
  );

  const historial = eventos.map((e) => ({
    id: `celda-${e.id}`,
    origen: 'CELDA',
    accion: e.accion,
    operador: e.operador,
    motivo: e.motivo,
    fecha_hora: e.fecha_hora,
    valor_anterior: e.valor_anterior,
    valor_nuevo: e.valor_nuevo,
  }));

  for (const m of movimientos) {
    historial.push({
      id: `mov-${m.id}-entrada`,
      origen: 'MOVIMIENTO',
      accion: 'ENTRADA',
      operador: m.operador_entrada,
      motivo: `Entrada de ${m.placa} a la celda ${m.codigo_celda_snapshot || ''}`.trim(),
      fecha_hora: m.fecha_entrada,
      valor_anterior: null,
      valor_nuevo: {
        placa: m.placa,
        tipo_vehiculo: m.tipo_vehiculo,
        celda: m.codigo_celda_snapshot,
        tipo_celda: m.tipo_celda_snapshot,
        acceso_entrada: m.acceso_entrada,
      },
    });

    if (m.fecha_salida) {
      historial.push({
        id: `mov-${m.id}-salida`,
        origen: 'MOVIMIENTO',
        accion: 'SALIDA',
        operador: m.operador_salida,
        motivo: `Salida de ${m.placa} de la celda ${m.codigo_celda_snapshot || ''}`.trim(),
        fecha_hora: m.fecha_salida,
        valor_anterior: { estado: 'ACTIVO' },
        valor_nuevo: {
          placa: m.placa,
          acceso_salida: m.acceso_salida,
          observaciones: m.observaciones,
          estado: m.anulado_en ? 'ANULADO' : 'FINALIZADO',
        },
      });
    }

    if (m.anulado_en) {
      historial.push({
        id: `mov-${m.id}-anulado`,
        origen: 'MOVIMIENTO',
        accion: 'ANULACION',
        operador: m.operador_anulado,
        motivo: m.motivo_anulacion,
        fecha_hora: m.anulado_en,
        valor_anterior: { estado: 'ACTIVO' },
        valor_nuevo: { placa: m.placa, estado: 'ANULADO' },
      });
    }
  }

  historial.sort((a, b) => {
    const fa = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
    const fb = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
    return fb - fa;
  });

  return historial;
}
