
import pool from "../config/database.js";

const TIPOS_CLIENTE = ["PERSONA", "EMPRESA"];

function validarCliente(datos) {
  const {
    tipo_cliente,
    tipo_documento,
    numero_documento,
    nombre_razon_social,
  } = datos;

  if (!TIPOS_CLIENTE.includes(tipo_cliente)) {
    throw new Error("El tipo de cliente debe ser PERSONA o EMPRESA.");
  }

  if (!tipo_documento?.trim()) {
    throw new Error("Debes indicar el tipo de documento.");
  }

  if (!numero_documento?.trim()) {
    throw new Error("Debes indicar el número de documento.");
  }

  if (!nombre_razon_social?.trim()) {
    throw new Error("Debes indicar el nombre o razón social.");
  }
}

export async function listarClientes({ buscar, tipo, activo } = {}) {
  let sql = `
    SELECT
      c.id,
      c.tipo_cliente,
      c.tipo_documento,
      c.numero_documento,
      c.nombre_razon_social,
      c.telefono,
      c.correo,
      c.direccion,
      c.activo,
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

  if (tipo && TIPOS_CLIENTE.includes(tipo)) {
    sql += " AND c.tipo_cliente = ?";
    parametros.push(tipo);
  }

  if (activo !== undefined) {
    sql += " AND c.activo = ?";
    parametros.push(activo === "true" ? 1 : 0);
  }

  sql += `
    GROUP BY c.id
    ORDER BY c.nombre_razon_social
  `;

  const [filas] = await pool.execute(sql, parametros);

  return filas;
}

export async function obtenerCliente(id) {
  const [clientes] = await pool.execute(
    `SELECT *
     FROM clientes
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (clientes.length === 0) {
    throw new Error("El cliente no existe.");
  }

  const [vehiculos] = await pool.execute(
    `SELECT
       id,
       placa,
       tipo,
       marca,
       modelo,
       color,
       anio,
       activo,
       creado_en
     FROM vehiculos
     WHERE cliente_id = ?
     ORDER BY placa`,
    [id]
  );

  return {
    ...clientes[0],
    vehiculos,
  };
}

export async function crearCliente(datos) {
  validarCliente(datos);

  const {
    tipo_cliente,
    tipo_documento,
    numero_documento,
    nombre_razon_social,
    telefono,
    correo,
    direccion,
  } = datos;

  const [resultado] = await pool.execute(
    `INSERT INTO clientes (
       tipo_cliente,
       tipo_documento,
       numero_documento,
       nombre_razon_social,
       telefono,
       correo,
       direccion
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tipo_cliente,
      tipo_documento.trim().toUpperCase(),
      numero_documento.trim(),
      nombre_razon_social.trim(),
      telefono?.trim() || null,
      correo?.trim() || null,
      direccion?.trim() || null,
    ]
  );

  return await obtenerCliente(resultado.insertId);
}

export async function actualizarCliente(id, datos) {
  validarCliente(datos);

  const {
    tipo_cliente,
    tipo_documento,
    numero_documento,
    nombre_razon_social,
    telefono,
    correo,
    direccion,
  } = datos;

  const [resultado] = await pool.execute(
    `UPDATE clientes
     SET tipo_cliente = ?,
         tipo_documento = ?,
         numero_documento = ?,
         nombre_razon_social = ?,
         telefono = ?,
         correo = ?,
         direccion = ?
     WHERE id = ?`,
    [
      tipo_cliente,
      tipo_documento.trim().toUpperCase(),
      numero_documento.trim(),
      nombre_razon_social.trim(),
      telefono?.trim() || null,
      correo?.trim() || null,
      direccion?.trim() || null,
      id,
    ]
  );

  if (resultado.affectedRows === 0) {
    throw new Error("El cliente no existe.");
  }

  return await obtenerCliente(id);
}

export async function cambiarEstadoCliente(id, activo) {
  if (typeof activo !== "boolean") {
    throw new Error("El estado debe ser verdadero o falso.");
  }

  const [resultado] = await pool.execute(
    `UPDATE clientes
     SET activo = ?
     WHERE id = ?`,
    [activo, id]
  );

  if (resultado.affectedRows === 0) {
    throw new Error("El cliente no existe.");
  }

  return await obtenerCliente(id);
}
