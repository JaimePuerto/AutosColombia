
import pool from "../config/database.js";
import { registrarAuditoria } from "./auditoria.service.js";
import { insertarVehiculo } from "./vehiculos.service.js";
import {
  normalizarAutorizacionDatos,
  validarDatosCliente,
} from "../validators/gestion.js";

function limpiar(valor) {
  return String(valor ?? "").trim();
}

// Prioridad del estado de mensualidad vigente para un vehículo (RF-22).
// Estados alineados con el documento EA2 (RF-28): Programada / Vigente / Vencida / Cancelada.
const ORDEN_MENSUALIDAD = { VIGENTE: 0, PROGRAMADA: 1, VENCIDA: 2, CANCELADA: 3 };

async function mensualidadesPorVehiculo(ids) {
  const resultado = new Map();
  if (!ids.length) return resultado;

  const marcadores = ids.map(() => "?").join(",");
  const [filas] = await pool.execute(
    `SELECT vehiculo_id, estado, fecha_inicio, fecha_fin
     FROM suscripciones
     WHERE vehiculo_id IN (${marcadores})
     ORDER BY vehiculo_id, fecha_inicio DESC, id DESC`,
    ids,
  );

  for (const fila of filas) {
    const clave = Number(fila.vehiculo_id);
    const actual = resultado.get(clave);
    const orden = ORDEN_MENSUALIDAD[fila.estado] ?? 9;
    if (!actual || orden < actual.orden) {
      resultado.set(clave, {
        orden,
        mensualidad: {
          estado: fila.estado,
          fecha_inicio: fila.fecha_inicio,
          fecha_fin: fila.fecha_fin,
        },
      });
    }
  }
  return resultado;
}

async function incluirMensualidades(vehiculos) {
  const mensualidades = await mensualidadesPorVehiculo(vehiculos.map((v) => v.id));
  return vehiculos.map((v) => ({
    ...v,
    mensualidad: mensualidades.get(Number(v.id))?.mensualidad ?? null,
  }));
}

export async function listarClientes({ buscar, tipo, activo } = {}) {
  let sql = `
    SELECT
      c.id,
      c.tipo_cliente,
      c.tipo_documento,
      c.numero_documento,
      c.nombre_razon_social,
      c.nombres,
      c.apellidos,
      c.telefono,
      c.correo,
      c.direccion,
      c.activo,
      c.autorizacion_datos,
      c.autorizacion_fecha,
      c.creado_en,
      COUNT(v.id) AS total_vehiculos
    FROM clientes c
    LEFT JOIN vehiculos v ON v.cliente_id = c.id
    WHERE 1 = 1
  `;

  const parametros = [];

  if (buscar?.trim()) {
    sql += `
      AND (
        c.numero_documento LIKE ?
        OR c.nombre_razon_social LIKE ?
        OR c.correo LIKE ?
        OR c.telefono LIKE ?
      )
    `;
    const termino = `%${buscar.trim()}%`;
    parametros.push(termino, termino, termino, termino);
  }

  if (tipo && ["PERSONA", "EMPRESA"].includes(tipo)) { sql += " AND c.tipo_cliente = ?"; parametros.push(tipo); }
  if (activo !== undefined) { sql += " AND c.activo = ?"; parametros.push(activo === "true" ? 1 : 0); }

  sql += " GROUP BY c.id ORDER BY c.nombre_razon_social";

  const [filas] = await pool.execute(sql, parametros);
  return filas;
}

export async function obtenerCliente(id) {
  const [clientes] = await pool.execute("SELECT * FROM clientes WHERE id = ? LIMIT 1", [id]);
  if (clientes.length === 0) throw Object.assign(new Error("El cliente no existe."), { status: 404 });

  const [vehiculos] = await pool.execute(
    `SELECT id, placa, tipo, marca, modelo, color, anio, activo, creado_en
     FROM vehiculos WHERE cliente_id = ? ORDER BY placa`,
    [id],
  );

  return { ...clientes[0], vehiculos: await incluirMensualidades(vehiculos) };
}

// RF-22: consulta por documento. Devuelve null cuando no existe (la UI habilita el registro).
export async function obtenerClientePorDocumento(numeroDocumento) {
  const documento = limpiar(numeroDocumento);
  if (!documento) throw Object.assign(new Error("Debes indicar el número de documento."), { status: 400 });

  const [clientes] = await pool.execute(
    "SELECT * FROM clientes WHERE numero_documento = ? ORDER BY id LIMIT 1", [documento],
  );
  if (clientes.length === 0) return null;

  const [vehiculos] = await pool.execute(
    `SELECT id, placa, tipo, marca, modelo, color, anio, activo, creado_en
     FROM vehiculos WHERE cliente_id = ? ORDER BY placa`,
    [clientes[0].id],
  );

  return { ...clientes[0], vehiculos: await incluirMensualidades(vehiculos) };
}

function datosClienteNormalizados(datos) {
  const validos = validarDatosCliente(datos);
  return {
    ...validos,
    direccion: limpiar(datos.direccion) || null,
  };
}

export async function crearCliente(datos, actorId = null) {
  return registrarClienteConVehiculos(datos, actorId);
}

// RF-23: registro transaccional de cliente + al menos un vehículo + autorización de datos.
// Si algo falla se revierte todo (RNF-10) y la autorización debe ser expresa (RNF-12).
export async function registrarClienteConVehiculos(payload, actorId = null) {
  const datos = payload?.cliente || payload || {};
  const vehiculos = Array.isArray(payload?.vehiculos) ? payload.vehiculos : [];
  const valorAutorizacion = payload && Object.prototype.hasOwnProperty.call(payload, "autorizacion")
    ? payload.autorizacion
    : datos.autorizacion_datos;
  const autorizacion = normalizarAutorizacionDatos(valorAutorizacion);

  const d = datosClienteNormalizados(datos);
  if (!vehiculos.length) {
    throw Object.assign(new Error("Debes registrar al menos un vehículo junto con el cliente."), { status: 400 });
  }
  if (!autorizacion) {
    throw Object.assign(new Error("Debes registrar la autorización de tratamiento de datos personales."), { status: 400 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [resultado] = await connection.execute(
      `INSERT INTO clientes
         (tipo_cliente, tipo_documento, numero_documento, nombre_razon_social,
          nombres, apellidos, telefono, correo, direccion, autorizacion_datos, autorizacion_fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
      [d.tipo_cliente, d.tipo_documento, d.numero_documento, d.nombre_razon_social,
        d.nombres, d.apellidos, d.telefono, d.correo, d.direccion],
    );
    const clienteId = resultado.insertId;

    const idsVehiculos = [];
    for (const vehiculo of vehiculos) {
      idsVehiculos.push(await insertarVehiculo(connection, { ...vehiculo, cliente_id: clienteId }));
    }

    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "CLIENTE",
      entidadId: clienteId,
      accion: "CREAR_CLIENTE",
      motivo: "Registro transaccional de cliente con vehículos y autorización de datos",
      nuevos: { ...d, autorizacion_datos: true, vehiculos: idsVehiculos.length },
    });
    for (const vehiculoId of idsVehiculos) {
      await registrarAuditoria(connection, {
        operadorId: actorId,
        entidad: "VEHICULO",
        entidadId: vehiculoId,
        accion: "CREAR_VEHICULO",
        motivo: "Vehículo creado junto con el cliente",
        nuevos: { cliente_id: clienteId },
      });
    }

    await connection.commit();
    return await obtenerCliente(clienteId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function actualizarCliente(id, datos, actorId = null) {
  const d = datosClienteNormalizados(datos);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [actuales] = await connection.execute("SELECT * FROM clientes WHERE id = ? FOR UPDATE", [id]);
    if (actuales.length === 0) throw Object.assign(new Error("El cliente no existe."), { status: 404 });
    const actual = actuales[0];

    const autorizacion = datos.autorizacion_datos === undefined
      ? Boolean(actual.autorizacion_datos)
      : normalizarAutorizacionDatos(datos.autorizacion_datos);
    const autorizacionFecha = autorizacion
      ? (actual.autorizacion_fecha || new Date())
      : null;

    await connection.execute(
      `UPDATE clientes
       SET tipo_cliente = ?, tipo_documento = ?, numero_documento = ?, nombre_razon_social = ?,
           nombres = ?, apellidos = ?, telefono = ?, correo = ?, direccion = ?,
           autorizacion_datos = ?, autorizacion_fecha = ?
       WHERE id = ?`,
      [d.tipo_cliente, d.tipo_documento, d.numero_documento, d.nombre_razon_social,
        d.nombres, d.apellidos, d.telefono, d.correo, d.direccion, autorizacion, autorizacionFecha, id],
    );

    // RF-25 / RF-37: se conservan los valores anteriores y nuevos.
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "CLIENTE",
      entidadId: id,
      accion: "MODIFICAR_CLIENTE",
      motivo: "Modificación de datos del cliente",
      anteriores: {
        tipo_cliente: actual.tipo_cliente, tipo_documento: actual.tipo_documento,
        numero_documento: actual.numero_documento, nombre_razon_social: actual.nombre_razon_social,
        nombres: actual.nombres, apellidos: actual.apellidos,
        telefono: actual.telefono, correo: actual.correo, direccion: actual.direccion,
        autorizacion_datos: Boolean(actual.autorizacion_datos),
        autorizacion_fecha: actual.autorizacion_fecha,
      },
      nuevos: {
        ...d,
        autorizacion_datos: autorizacion,
        autorizacion_fecha: autorizacionFecha,
      },
    });

    await connection.commit();
    return await obtenerCliente(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cambiarEstadoCliente(id, activo, actorId = null) {
  if (typeof activo !== "boolean") {
    throw Object.assign(new Error("El estado debe ser verdadero o falso."), { status: 400 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [actuales] = await connection.execute("SELECT id, activo FROM clientes WHERE id = ? FOR UPDATE", [id]);
    if (actuales.length === 0) throw Object.assign(new Error("El cliente no existe."), { status: 404 });

    await connection.execute("UPDATE clientes SET activo = ? WHERE id = ?", [activo, id]);
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "CLIENTE",
      entidadId: id,
      accion: "CAMBIAR_ESTADO_CLIENTE",
      motivo: activo ? "Reactivación de cliente" : "Desactivación de cliente",
      anteriores: { activo: Boolean(actuales[0].activo) },
      nuevos: { activo },
    });

    await connection.commit();
    return await obtenerCliente(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
