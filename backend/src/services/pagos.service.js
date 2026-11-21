import pool from "../config/database.js";
import { registrarAuditoria } from "./auditoria.service.js";

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"];
const ESTADOS = ["APROBADO", "ANULADO"];

function errorHttp(mensaje, status = 400) {
  return Object.assign(new Error(mensaje), { status });
}

function numeroMoneda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) throw errorHttp("El valor del pago no es válido.");
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function generarComprobante(id) {
  return `AUT-${new Date().getFullYear()}-${String(id).padStart(8, "0")}`;
}

const SELECT_PAGO = `
 SELECT p.id, p.numero_comprobante, p.suscripcion_id, p.valor, p.fecha_pago,
        p.metodo_pago, p.referencia, p.estado, p.responsable_id,
        p.motivo_anulacion, p.anulado_en,
        s.fecha_inicio, s.fecha_fin, s.estado AS estado_suscripcion,
        v.id AS vehiculo_id, v.placa, v.tipo, v.marca, v.modelo,
        c.id AS cliente_id, c.numero_documento, c.tipo_documento,
        c.nombre_razon_social AS cliente,
        o.nombre AS responsable,
        oa.nombre AS anulado_por_nombre
 FROM pagos p
 INNER JOIN suscripciones s ON s.id = p.suscripcion_id
 INNER JOIN vehiculos v ON v.id = s.vehiculo_id
 INNER JOIN clientes c ON c.id = v.cliente_id
 LEFT JOIN operadores o ON o.id = p.responsable_id
 LEFT JOIN operadores oa ON oa.id = p.anulado_por
`;

export async function registrarPago(datos, responsableId) {
  const suscripcionId = Number(datos?.suscripcion_id);
  if (!Number.isSafeInteger(suscripcionId) || suscripcionId <= 0) {
    throw errorHttp("Selecciona una mensualidad válida.");
  }
  const metodo = String(datos?.metodo_pago || "").trim().toUpperCase();
  if (!METODOS.includes(metodo)) throw errorHttp("Selecciona un método de pago válido.");
  const referencia = String(datos?.referencia || "").trim().slice(0, 120) || null;

  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [suscripciones] = await cx.execute(
      `SELECT s.*, v.placa, v.tipo, v.activo AS vehiculo_activo,
              c.id AS cliente_id, c.activo AS cliente_activo
       FROM suscripciones s
       INNER JOIN vehiculos v ON v.id=s.vehiculo_id
       INNER JOIN clientes c ON c.id=v.cliente_id
       WHERE s.id=? FOR UPDATE`, [suscripcionId]
    );
    if (!suscripciones.length) throw errorHttp("La mensualidad seleccionada no existe.", 404);
    const s = suscripciones[0];
    if (!s.vehiculo_activo || !s.cliente_activo) throw errorHttp("No se puede cobrar una mensualidad de un cliente o vehículo inactivo.");
    if (s.estado === "CANCELADA") throw errorHttp("No se puede registrar el pago de una mensualidad cancelada.");

    const valor = numeroMoneda(s.valor);
    if (datos?.valor !== undefined && datos?.valor !== null && datos?.valor !== "") {
      const enviado = numeroMoneda(datos.valor);
      if (Math.abs(enviado - valor) > 0.009) throw errorHttp("El valor enviado no coincide con el valor registrado en la mensualidad.");
    }

    const [duplicados] = await cx.execute(
      "SELECT id FROM pagos WHERE suscripcion_id=? AND estado='APROBADO' LIMIT 1 FOR UPDATE",
      [suscripcionId]
    );
    if (duplicados.length) throw errorHttp(`Esta mensualidad ya tiene un pago aprobado (comprobante ${duplicados[0].id}).`, 409);

    const [fechaRows] = await cx.execute("SELECT CURRENT_DATE() AS hoy");
    const hoy = String(fechaRows[0].hoy).slice(0, 10);
    const inicio = String(s.fecha_inicio).slice(0, 10);
    const fin = String(s.fecha_fin).slice(0, 10);
    // Se conserva el período definido en la suscripción. El pago no altera fechas ni crea períodos solapados.
    const nuevoEstado = hoy < inicio ? "PROGRAMADA" : hoy <= fin ? "VIGENTE" : "VENCIDA";

    const [insertado] = await cx.execute(
      `INSERT INTO pagos
        (numero_comprobante, suscripcion_id, valor, metodo_pago, referencia,
         estado, responsable_id, estado_suscripcion_anterior)
       VALUES (NULL, ?, ?, ?, ?, 'APROBADO', ?, ?)`,
      [suscripcionId, valor, metodo, referencia, responsableId, s.estado]
    );
    const pagoId = insertado.insertId;
    const comprobante = generarComprobante(pagoId);
    await cx.execute("UPDATE pagos SET numero_comprobante=? WHERE id=?", [comprobante, pagoId]);
    await cx.execute("UPDATE suscripciones SET estado=? WHERE id=?", [nuevoEstado, suscripcionId]);

    await registrarAuditoria(cx, {
      operadorId: responsableId, entidad: "PAGO", entidadId: pagoId,
      accion: "REGISTRAR_PAGO", motivo: "Pago aprobado automáticamente tras validar mensualidad, valor y duplicados",
      anteriores: { estado_suscripcion: s.estado },
      nuevos: { suscripcion_id: suscripcionId, valor, metodo_pago: metodo, referencia, estado: "APROBADO", numero_comprobante: comprobante, estado_suscripcion: nuevoEstado },
    });
    await cx.commit();
    const [rows] = await pool.execute(`${SELECT_PAGO} WHERE p.id=?`, [pagoId]);
    return rows[0];
  } catch (error) {
    await cx.rollback();
    if (error.code === "ER_DUP_ENTRY") throw errorHttp("Ya existe un pago aprobado para esta mensualidad.", 409);
    throw error;
  } finally {
    cx.release();
  }
}

export async function listarPagos(filtros = {}) {
  const condiciones = [];
  const params = [];
  if (filtros.documento?.trim()) { condiciones.push("c.numero_documento LIKE ?"); params.push(`%${filtros.documento.trim()}%`); }
  if (filtros.placa?.trim()) { condiciones.push("v.placa LIKE ?"); params.push(`%${filtros.placa.trim().toUpperCase()}%`); }
  if (filtros.estado && ESTADOS.includes(String(filtros.estado).toUpperCase())) { condiciones.push("p.estado=?"); params.push(String(filtros.estado).toUpperCase()); }
  if (filtros.desde) { condiciones.push("DATE(p.fecha_pago)>=?"); params.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push("DATE(p.fecha_pago)<=?"); params.push(filtros.hasta); }
  const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [rows] = await pool.execute(`${SELECT_PAGO} ${where} ORDER BY p.fecha_pago DESC, p.id DESC LIMIT ${limite}`, params);
  return rows;
}

export async function obtenerPago(id) {
  const [rows] = await pool.execute(`${SELECT_PAGO} WHERE p.id=? LIMIT 1`, [id]);
  if (!rows.length) throw errorHttp("El pago no existe.", 404);
  return rows[0];
}

export async function anularPago(id, motivo, administradorId) {
  const razon = String(motivo || "").trim();
  if (razon.length < 5) throw errorHttp("Indica el motivo de anulación (mínimo 5 caracteres).");
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [pagos] = await cx.execute("SELECT * FROM pagos WHERE id=? FOR UPDATE", [id]);
    if (!pagos.length) throw errorHttp("El pago no existe.", 404);
    const pago = pagos[0];
    if (pago.estado !== "APROBADO") throw errorHttp("Solo se pueden anular pagos aprobados.");
    await cx.execute(
      `UPDATE pagos SET estado='ANULADO', motivo_anulacion=?, anulado_por=?, anulado_en=CURRENT_TIMESTAMP WHERE id=?`,
      [razon, administradorId, id]
    );
    await registrarAuditoria(cx, {
      operadorId: administradorId, entidad: "PAGO", entidadId: Number(id), accion: "ANULAR_PAGO", motivo: razon,
      anteriores: { estado: pago.estado, valor: pago.valor, numero_comprobante: pago.numero_comprobante },
      nuevos: { estado: "ANULADO" },
    });
    await cx.commit();
    return await obtenerPago(id);
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally { cx.release(); }
}
