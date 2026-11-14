import pool from "../config/database.js";
import { registrarAuditoria } from "./auditoria.service.js";

// Estados alineados con el documento EA2 (RF-28): Programada / Vigente / Vencida / Cancelada.
const ESTADOS_PERMITIDOS = ["PROGRAMADA", "VIGENTE", "VENCIDA", "CANCELADA"];

function validarFecha(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function validarFechaInicioNoPasada(connection, fechaInicio) {
  const [filas] = await connection.execute("SELECT CURRENT_DATE() AS hoy");
  const hoy = String(filas[0].hoy).slice(0, 10);
  if (fechaInicio < hoy) {
    throw new Error(`La fecha de inicio no puede ser anterior a hoy (${hoy}).`);
  }
}

// RF-28: la mensualidad no genera cobro en esta iteración. El campo `valor` es obligatorio
// por la estructura de la tabla, por lo que se registra en 0 cuando no se informa,
// sin inventar transacciones económicas.
function validarSuscripcion(datos) {
  const vehiculoId = Number(datos.vehiculo_id);
  const valor = datos.valor === undefined || datos.valor === null || datos.valor === ""
    ? 0
    : Number(datos.valor);
  if (!Number.isInteger(vehiculoId) || vehiculoId <= 0) throw new Error("Debes seleccionar un vehículo válido.");
  if (!Number.isFinite(valor) || valor < 0) throw new Error("El valor de la suscripción no puede ser negativo.");
  const fechaInicio = datos.fecha_inicio;
  const fechaFin = datos.fecha_fin;
  if (!validarFecha(fechaInicio) || !validarFecha(fechaFin)) throw new Error("Debes ingresar fechas válidas en formato AAAA-MM-DD.");
  if (fechaFin !== sumarDias(fechaInicio, 29)) throw new Error("La suscripción debe tener exactamente 30 días calendario, contando el día inicial.");
  return { vehiculoId, valor, fechaInicio, fechaFin };
}

const SELECT_BASE = `
  SELECT s.id, s.vehiculo_id, s.valor, s.estado, s.fecha_inicio, s.fecha_fin, s.creado_en,
         v.placa, v.tipo, v.marca, v.modelo, v.activo AS vehiculo_activo,
         c.id AS cliente_id, c.nombre_razon_social AS cliente
  FROM suscripciones s
  INNER JOIN vehiculos v ON v.id = s.vehiculo_id
  LEFT JOIN clientes c ON c.id = v.cliente_id
`;

export async function listarSuscripciones({ buscar, vehiculo_id, estado } = {}) {
  let sql = `${SELECT_BASE} WHERE 1=1`;
  const params = [];
  if (buscar?.trim()) {
    const q = `%${buscar.trim()}%`;
    sql += ` AND (v.placa LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ? OR c.nombre_razon_social LIKE ?)`;
    params.push(q, q, q, q);
  }
  if (vehiculo_id) { sql += " AND s.vehiculo_id = ?"; params.push(vehiculo_id); }
  if (estado) {
    if (!ESTADOS_PERMITIDOS.includes(estado)) throw new Error("El estado de la suscripción no es válido.");
    sql += " AND s.estado = ?"; params.push(estado);
  }
  sql += " ORDER BY s.fecha_inicio DESC, s.id DESC";
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function obtenerSuscripcion(id) {
  const [rows] = await pool.execute(`${SELECT_BASE} WHERE s.id=? LIMIT 1`, [id]);
  if (!rows.length) throw new Error("La suscripción no existe.");
  return rows[0];
}

export async function obtenerSuscripcionPorPlaca(placa) {
  if (!placa?.trim()) throw new Error("Debes ingresar una placa válida.");
  const [rows] = await pool.execute(
    `${SELECT_BASE}
     WHERE v.placa = ?
     ORDER BY CASE WHEN s.estado='VIGENTE' AND CURRENT_DATE BETWEEN s.fecha_inicio AND s.fecha_fin THEN 0
                   WHEN s.estado='PROGRAMADA' AND s.fecha_inicio > CURRENT_DATE THEN 1
                   ELSE 2 END,
              s.fecha_inicio DESC, s.id DESC
     LIMIT 1`,
    [placa.trim().toUpperCase()]
  );
  if (!rows.length) throw new Error("El vehículo no tiene una suscripción registrada.");
  return rows[0];
}

export async function crearSuscripcion(datos, operadorId) {
  const { vehiculoId, valor, fechaInicio, fechaFin } = validarSuscripcion(datos);
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    await validarFechaInicioNoPasada(cx, fechaInicio);
    const [vehiculos] = await cx.execute(
      "SELECT id, activo FROM vehiculos WHERE id=? FOR UPDATE", [vehiculoId]
    );
    if (!vehiculos.length) throw new Error("El vehículo no existe.");
    if (!vehiculos[0].activo) throw new Error("No se puede registrar una suscripción para un vehículo inactivo.");

    // Las canceladas no ocupan fechas; el resto conserva su período, incluso vencido.
    const [cruces] = await cx.execute(
      `SELECT id, estado, fecha_inicio, fecha_fin
       FROM suscripciones
       WHERE vehiculo_id = ?
         AND estado <> 'CANCELADA'
         AND fecha_inicio <= ?
         AND fecha_fin >= ?
       LIMIT 1 FOR UPDATE`,
      [vehiculoId, fechaFin, fechaInicio]
    );
    if (cruces.length) {
      const x = cruces[0];
      throw new Error(`El período se cruza con la suscripción #${x.id} (${x.fecha_inicio} a ${x.fecha_fin}, ${x.estado}). Las suscripciones canceladas sí liberan sus fechas.`);
    }

    // Si el administrador no envía fechas, el backend puede calcular el siguiente período.
    // La interfaz actual envía fechas; para renovaciones, la fecha propuesta debe ser el día
    // siguiente al último período no cancelado. Se valida aquí para impedir saltos/solapamientos.
    const [anteriores] = await cx.execute(
      `SELECT fecha_fin FROM suscripciones
       WHERE vehiculo_id=? AND estado <> 'CANCELADA'
       ORDER BY fecha_fin DESC, id DESC LIMIT 1 FOR UPDATE`,
      [vehiculoId]
    );
    if (anteriores.length) {
      const inicioEsperado = sumarDias(String(anteriores[0].fecha_fin).slice(0,10), 1);
      if (fechaInicio !== inicioEsperado) {
        throw new Error(`La renovación debe iniciar el ${inicioEsperado}, día siguiente al último período no cancelado.`);
      }
    }

    const [ins] = await cx.execute(
      `INSERT INTO suscripciones (vehiculo_id, valor, estado, fecha_inicio, fecha_fin)
       VALUES (?, ?, 'PROGRAMADA', ?, ?)`,
      [vehiculoId, valor, fechaInicio, fechaFin]
    );
    await registrarAuditoria(cx, {
      operadorId,
      accion: "CREAR",
      entidad: "SUSCRIPCION",
      entidadId: ins.insertId,
      motivo: "Registro de nueva suscripción.",
      anteriores: null,
      nuevos: {
        vehiculo_id: vehiculoId,
        valor,
        estado: "PROGRAMADA",
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      }
    });

    await cx.commit();
    return await obtenerSuscripcion(ins.insertId);
  } catch (e) {
    await cx.rollback();
    throw e;
  } finally {
    cx.release();
  }
}


// Sincroniza estados según la fecha de MySQL. Las canceladas nunca se modifican.
export async function sincronizarEstadosSuscripciones() {
  const cx = await pool.getConnection();
  let actualizadas = 0;

  try {
    await cx.beginTransaction();

    const [pendientes] = await cx.execute(
      `SELECT id, estado, fecha_inicio, fecha_fin,
              CASE
                WHEN fecha_fin < CURRENT_DATE() THEN 'VENCIDA'
                WHEN fecha_inicio <= CURRENT_DATE() AND fecha_fin >= CURRENT_DATE() THEN 'VIGENTE'
                ELSE estado
              END AS estado_nuevo
       FROM suscripciones
       WHERE (estado = 'PROGRAMADA' AND fecha_inicio <= CURRENT_DATE())
          OR (estado IN ('PROGRAMADA', 'VIGENTE') AND fecha_fin < CURRENT_DATE())
       FOR UPDATE`
    );

    for (const fila of pendientes) {
      if (!fila.estado_nuevo || fila.estado_nuevo === fila.estado) continue;

      const [resultado] = await cx.execute(
        "UPDATE suscripciones SET estado = ? WHERE id = ? AND estado = ?",
        [fila.estado_nuevo, fila.id, fila.estado]
      );

      if (!resultado.affectedRows) continue;

      await registrarAuditoria(cx, {
        operadorId: null,
        accion: "CAMBIO_ESTADO_AUTOMATICO",
        entidad: "SUSCRIPCION",
        entidadId: fila.id,
        motivo: `Actualización automática de estado por vigencia de fechas (${fila.estado} a ${fila.estado_nuevo}).`,
        anteriores: {
          estado: fila.estado,
          fecha_inicio: fila.fecha_inicio,
          fecha_fin: fila.fecha_fin
        },
        nuevos: {
          estado: fila.estado_nuevo,
          fecha_inicio: fila.fecha_inicio,
          fecha_fin: fila.fecha_fin
        }
      });

      actualizadas += 1;
    }

    await cx.commit();
    return actualizadas;
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}
export async function cambiarEstadoSuscripcion(id, estado, operadorId, motivoPersonalizado) {
  if (!ESTADOS_PERMITIDOS.includes(estado)) throw new Error("El estado de la suscripción no es válido.");
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [rows] = await cx.execute("SELECT * FROM suscripciones WHERE id=? FOR UPDATE", [id]);
    if (!rows.length) throw new Error("La suscripción no existe.");
    const actual = rows[0];
    if (actual.estado === "CANCELADA" && estado !== "CANCELADA") {
      throw new Error("Una suscripción cancelada no se puede reactivar; registra una nueva para conservar la trazabilidad.");
    }
    if (estado === "VIGENTE") {
      const [fechaRows] = await cx.execute("SELECT CURRENT_DATE() AS hoy");
      const hoy = String(fechaRows[0].hoy).slice(0, 10);
      if (hoy < String(actual.fecha_inicio).slice(0,10) || hoy > String(actual.fecha_fin).slice(0,10)) {
        throw new Error("Solo se puede activar una suscripción dentro de su período de vigencia.");
      }
      const [otra] = await cx.execute(
        `SELECT id FROM suscripciones
         WHERE vehiculo_id=? AND id<>? AND estado='VIGENTE'
           AND fecha_inicio <= ? AND fecha_fin >= ? LIMIT 1 FOR UPDATE`,
        [actual.vehiculo_id, id, actual.fecha_fin, actual.fecha_inicio]
      );
      if (otra.length) throw new Error(`El vehículo ya tiene otra suscripción activa (#${otra[0].id}).`);
    }
    const [result] = await cx.execute("UPDATE suscripciones SET estado=? WHERE id=?", [estado, id]);
    if (!result.affectedRows) throw new Error("La suscripción no existe.");
    await registrarAuditoria(cx, {
      operadorId, accion: estado === "CANCELADA" ? "CANCELAR" : "CAMBIAR_ESTADO",
      entidad: "SUSCRIPCION", entidadId: id,
      motivo: estado === "CANCELADA" ? (String(motivoPersonalizado || "").trim() || "Cancelación de suscripción") : "Cambio de estado de suscripción",
      anteriores: { estado: actual.estado, fecha_inicio: actual.fecha_inicio, fecha_fin: actual.fecha_fin },
      nuevos: { estado, fecha_inicio: actual.fecha_inicio, fecha_fin: actual.fecha_fin }
    });
    await cx.commit();
    return await obtenerSuscripcion(id);
  } catch (e) {
    await cx.rollback();
    throw e;
  } finally {
    cx.release();
  }
}

// RF-29: modifica la fecha de activación de una mensualidad.
// El sistema recalcula el vencimiento (30 días calendario), valida traslapes y audita el cambio.
export async function modificarFechaActivacion(id, datos, operadorId) {
  const motivo = String(datos?.motivo || "").trim();
  if (motivo.length < 5) throw new Error("Debes indicar el motivo de la modificación (mínimo 5 caracteres).");

  const fechaInicio = String(datos?.fecha_inicio || "").trim();
  if (!validarFecha(fechaInicio)) throw new Error("Debes ingresar una fecha de inicio válida en formato AAAA-MM-DD.");
  const fechaFin = sumarDias(fechaInicio, 29);

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();

    const [rows] = await cx.execute("SELECT * FROM suscripciones WHERE id = ? FOR UPDATE", [id]);
    if (!rows.length) throw new Error("La suscripción no existe.");
    const actual = rows[0];

    if (actual.estado === "CANCELADA") {
      throw new Error("No se puede modificar una suscripción cancelada; registra una nueva para conservar la trazabilidad.");
    }
    if (actual.estado === "VENCIDA") {
      throw new Error("No se puede modificar una suscripción vencida; registra una nueva para conservar la trazabilidad.");
    }

    await validarFechaInicioNoPasada(cx, fechaInicio);

    // No permitir traslapes con otras suscripciones no canceladas del mismo vehículo.
    const [cruces] = await cx.execute(
      `SELECT id, estado, fecha_inicio, fecha_fin
       FROM suscripciones
       WHERE vehiculo_id = ? AND id <> ?
         AND estado <> 'CANCELADA'
         AND fecha_inicio <= ? AND fecha_fin >= ?
       LIMIT 1 FOR UPDATE`,
      [actual.vehiculo_id, id, fechaFin, fechaInicio],
    );
    if (cruces.length) {
      const x = cruces[0];
      throw new Error(`El nuevo período se cruza con la suscripción #${x.id} (${x.fecha_inicio} a ${x.fecha_fin}, ${x.estado}).`);
    }

    const [fechaRows] = await cx.execute("SELECT CURRENT_DATE() AS hoy");
    const hoy = String(fechaRows[0].hoy).slice(0, 10);
    let estado = actual.estado;
    if (estado !== "CANCELADA") {
      if (hoy < fechaInicio) estado = "PROGRAMADA";
      else if (hoy > fechaFin) estado = "VENCIDA";
      else estado = "VIGENTE";
    }

    await cx.execute(
      `UPDATE suscripciones SET fecha_inicio = ?, fecha_fin = ?, estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [fechaInicio, fechaFin, estado, id],
    );

    await registrarAuditoria(cx, {
      operadorId,
      accion: "MODIFICAR_FECHA_ACTIVACION",
      entidad: "SUSCRIPCION",
      entidadId: id,
      motivo,
      anteriores: { fecha_inicio: actual.fecha_inicio, fecha_fin: actual.fecha_fin, estado: actual.estado },
      nuevos: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, estado },
    });

    await cx.commit();
    return await obtenerSuscripcion(id);
  } catch (e) {
    await cx.rollback();
    throw e;
  } finally {
    cx.release();
  }
}
