
import pool from "../config/database.js";
import { registrarAuditoria } from "./auditoria.service.js";

const ESTADOS = ["ACTIVA", "INACTIVA"];

function validarFecha(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === fecha;
}

function validarDatos(datos) {
  const tipoVehiculoId = Number(datos.tipo_vehiculo_id);
  const valor = Number(datos.valor);
  const fechaInicio = datos.fecha_inicio;
  const fechaFin = datos.fecha_fin || null;
  const estado = datos.estado || "ACTIVA";

  if (!Number.isInteger(tipoVehiculoId) || tipoVehiculoId <= 0) {
    throw new Error("Selecciona un tipo de vehículo válido.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("El valor de la tarifa debe ser mayor que cero.");
  }

  if (!validarFecha(fechaInicio)) {
    throw new Error("La fecha de inicio no es válida.");
  }

  if (fechaFin && (!validarFecha(fechaFin) || fechaFin < fechaInicio)) {
    throw new Error("La fecha de finalización no es válida.");
  }

  if (!ESTADOS.includes(estado)) {
    throw new Error("El estado de la tarifa no es válido.");
  }

  return { tipoVehiculoId, valor, fechaInicio, fechaFin, estado };
}


async function validarTipo(cx, tipoVehiculoId) {
  const [rows] = await cx.execute(
    "SELECT id FROM tipos_vehiculo WHERE id = ?",
    [tipoVehiculoId]
  );

  if (!rows.length) {
    throw new Error("El tipo de vehículo no existe.");
  }
}

async function validarSolapamiento(
  cx,
  tipoVehiculoId,
  fechaInicio,
  fechaFin,
  excluirId = null
) {
  const [rows] = await cx.execute(
    `SELECT id, fecha_inicio, fecha_fin
     FROM tarifas
     WHERE tipo_vehiculo_id = ?
       AND estado = 'ACTIVA'
       AND (? IS NULL OR id <> ?)
       AND fecha_inicio <= COALESCE(?, '9999-12-31')
       AND COALESCE(fecha_fin, '9999-12-31') >= ?
     LIMIT 1 FOR UPDATE`,
    [
      tipoVehiculoId,
      excluirId,
      excluirId,
      fechaFin,
      fechaInicio
    ]
  );

  if (rows.length) {
    throw new Error(
      `Ya existe una tarifa activa para ese tipo de vehículo durante el período indicado (tarifa #${rows[0].id}).`
    );
  }
}

export async function listarTiposVehiculo() {
  const [rows] = await pool.execute(
    "SELECT id, codigo, nombre FROM tipos_vehiculo ORDER BY nombre"
  );
  return rows;
}

export async function listarTarifas() {
  const [rows] = await pool.execute(
    `SELECT t.id, t.tipo_vehiculo_id, tv.codigo, tv.nombre,
            t.valor, t.fecha_inicio, t.fecha_fin,
            t.estado, t.created_at
     FROM tarifas t
     INNER JOIN tipos_vehiculo tv ON tv.id = t.tipo_vehiculo_id
     ORDER BY tv.nombre, t.fecha_inicio DESC, t.id DESC`
  );
  return rows;
}

export async function crearTarifa(datos, operadorId) {
  const tarifa = validarDatos(datos);
  const cx = await pool.getConnection();

  try {
    await cx.beginTransaction();

    await validarTipo(cx, tarifa.tipoVehiculoId);

    if (tarifa.estado === "ACTIVA") {
      await validarSolapamiento(
        cx,
        tarifa.tipoVehiculoId,
        tarifa.fechaInicio,
        tarifa.fechaFin
      );
    }

    const [result] = await cx.execute(
      `INSERT INTO tarifas
       (tipo_vehiculo_id, valor, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tarifa.tipoVehiculoId,
        tarifa.valor,
        tarifa.fechaInicio,
        tarifa.fechaFin,
        tarifa.estado
      ]
    );

    await registrarAuditoria(cx, {
      operadorId,
      accion: "CREAR",
      entidad: "TARIFA",
      entidadId: result.insertId,
      motivo: "Registro de nueva tarifa.",
      anteriores: null,
      nuevos: tarifa
    });

    await cx.commit();

    const [rows] = await pool.execute(
      `SELECT t.*, tv.codigo, tv.nombre
       FROM tarifas t
       INNER JOIN tipos_vehiculo tv ON tv.id = t.tipo_vehiculo_id
       WHERE t.id = ?`,
      [result.insertId]
    );

    return rows[0];
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}

export async function actualizarTarifa(id, datos, operadorId) {
  const tarifa = validarDatos(datos);
  const cx = await pool.getConnection();

  try {
    await cx.beginTransaction();

    const [rows] = await cx.execute(
      "SELECT * FROM tarifas WHERE id = ? FOR UPDATE",
      [id]
    );

    if (!rows.length) throw new Error("La tarifa no existe.");

    const anterior = rows[0];

    if (Number(anterior.tipo_vehiculo_id) !== tarifa.tipoVehiculoId) {
      throw new Error(
        "No se puede cambiar el tipo de una tarifa existente. Registra una nueva."
      );
    }

    await validarTipo(cx, tarifa.tipoVehiculoId);

    if (tarifa.estado === "ACTIVA") {
      await validarSolapamiento(
        cx,
        tarifa.tipoVehiculoId,
        tarifa.fechaInicio,
        tarifa.fechaFin,
        Number(id)
      );
    }

    await cx.execute(
      `UPDATE tarifas
       SET valor = ?, fecha_inicio = ?, fecha_fin = ?, estado = ?
       WHERE id = ?`,
      [
        tarifa.valor,
        tarifa.fechaInicio,
        tarifa.fechaFin,
        tarifa.estado,
        id
      ]
    );

    await registrarAuditoria(cx, {
      operadorId,
      accion: "MODIFICAR",
      entidad: "TARIFA",
      entidadId: id,
      motivo: "Actualización de valor o vigencia de tarifa.",
      anteriores: anterior,
      nuevos: tarifa
    });

    await cx.commit();

    const [actualizada] = await pool.execute(
      `SELECT t.*, tv.codigo, tv.nombre
       FROM tarifas t
       INNER JOIN tipos_vehiculo tv ON tv.id = t.tipo_vehiculo_id
       WHERE t.id = ?`,
      [id]
    );

    return actualizada[0];
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}

export async function cambiarEstadoTarifa(id, estado, operadorId) {
  if (!ESTADOS.includes(estado)) {
    throw new Error("El estado de la tarifa no es válido.");
  }

  const cx = await pool.getConnection();

  try {
    await cx.beginTransaction();

    const [rows] = await cx.execute(
      "SELECT * FROM tarifas WHERE id = ? FOR UPDATE",
      [id]
    );

    if (!rows.length) throw new Error("La tarifa no existe.");

    const anterior = rows[0];

    if (estado === "ACTIVA") {
      await validarSolapamiento(
        cx,
        anterior.tipo_vehiculo_id,
        String(anterior.fecha_inicio).slice(0, 10),
        anterior.fecha_fin
          ? String(anterior.fecha_fin).slice(0, 10)
          : null,
        Number(id)
      );
    }

    await cx.execute(
      "UPDATE tarifas SET estado = ? WHERE id = ?",
      [estado, id]
    );

    await registrarAuditoria(cx, {
      operadorId,
      accion: estado === "ACTIVA" ? "ACTIVAR" : "INACTIVAR",
      entidad: "TARIFA",
      entidadId: id,
      motivo: `Cambio de estado de tarifa a ${estado}.`,
      anteriores: { estado: anterior.estado },
      nuevos: { estado }
    });

    await cx.commit();
    return { id: Number(id), estado };
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}
