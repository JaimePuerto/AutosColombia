import pool from '../config/database.js';

/**
 * Adaptado al esquema existente:
 * auditoria_eventos.valor_anterior, valor_nuevo y fecha_hora.
 * Los alias de salida mantienen compatibilidad con la pantalla de auditoría.
 */
export async function registrarAuditoria(connection, evento) {
  const db = connection || pool;
  const {
    operadorId = null, accion, entidad, entidadId = null, motivo = null,
    anteriores = null, nuevos = null,
  } = evento || {};

  if (!accion || !entidad) throw new Error('La auditoría requiere acción y entidad.');

  let idNumerico = null;
  if (entidadId !== null && entidadId !== undefined && entidadId !== '') {
    const parsed = Number(entidadId);
    if (Number.isSafeInteger(parsed) && parsed >= 0) idNumerico = parsed;
  }

  await db.execute(
    `INSERT INTO auditoria_eventos
      (operador_id, entidad, entidad_id, accion, motivo, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      operadorId,
      String(entidad).slice(0, 40),
      idNumerico,
      String(accion).slice(0, 50),
      motivo == null ? null : String(motivo).slice(0, 500),
      anteriores == null ? null : JSON.stringify(anteriores),
      nuevos == null ? null : JSON.stringify(nuevos),
    ],
  );
}

export async function consultarAuditoria({
  usuario, desde, hasta, accion, entidad, tipo, limite = 200,
} = {}) {
  const filtros = [];
  const params = [];

  if (usuario !== undefined && usuario !== null && String(usuario).trim() !== '') {
    const operadorId = Number(usuario);
    if (!Number.isSafeInteger(operadorId) || operadorId <= 0) {
      throw new Error('El filtro de operador no es válido.');
    }
    filtros.push('t.operador_id = ?');
    params.push(operadorId);
  }
  if (desde) { filtros.push('DATE(t.fecha_hora) >= ?'); params.push(desde); }
  if (hasta) { filtros.push('DATE(t.fecha_hora) <= ?'); params.push(hasta); }
  if (accion) { filtros.push('t.accion = ?'); params.push(String(accion).slice(0, 50)); }
  if (entidad) { filtros.push('t.entidad = ?'); params.push(String(entidad).slice(0, 40)); }
  if (tipo) {
    const tipoEvento = String(tipo).trim().toUpperCase();
    if (tipoEvento === 'OPERACION' || tipoEvento === 'AUTENTICACION') {
      filtros.push('t.tipo_evento = ?');
      params.push(tipoEvento);
    }
  }

  const parsedLimit = Number(limite);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500)
    : 200;
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  // RF-38: consulta unificada de auditoria_eventos (operaciones) y
  // auditoria_autenticacion (login, cierre de sesión y bloqueos), conservando
  // sus diferencias: los eventos de autenticación exponen su detalle como motivo
  // y se identifican con entidad = 'AUTENTICACION'. El campo id es único entre
  // ambas tablas combinando el origen (clave) con el id real (id_origen).
  const [rows] = await pool.execute(
    `SELECT * FROM (
        SELECT
          a.id AS id_origen,
          CONCAT('OPERACION-', a.id) AS id,
          'OPERACION' AS tipo_evento,
          a.operador_id,
          o.nombre AS operador,
          a.accion,
          a.entidad,
          a.entidad_id,
          a.motivo,
          a.valor_anterior AS valores_anteriores,
          a.valor_nuevo AS valores_nuevos,
          a.fecha_hora
        FROM auditoria_eventos a
        LEFT JOIN operadores o ON o.id = a.operador_id
        UNION ALL
        SELECT
          aa.id AS id_origen,
          CONCAT('AUTENTICACION-', aa.id) AS id,
          'AUTENTICACION' AS tipo_evento,
          aa.operador_id,
          o.nombre AS operador,
          aa.accion,
          'AUTENTICACION' AS entidad,
          aa.operador_id AS entidad_id,
          aa.detalle AS motivo,
          NULL AS valores_anteriores,
          NULL AS valores_nuevos,
          aa.fecha_hora
        FROM auditoria_autenticacion aa
        LEFT JOIN operadores o ON o.id = aa.operador_id
      ) t
      ${where}
      ORDER BY t.fecha_hora DESC, t.id DESC
      LIMIT ${safeLimit}`,
    params,
  );
  return rows;
}