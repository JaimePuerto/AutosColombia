
import pool from "../config/database.js";
import {
  normalizarPlaca,
  validarPlaca,
} from "../validators/placas.js";

// Validar los datos de un vehículo.
function validarVehiculo(datos) {
  const placa = normalizarPlaca(datos.placa);

  if (!validarPlaca(placa, datos.tipo)) {
    throw new Error("La placa no corresponde al tipo de vehículo.");
  }

  if (
    !datos.cliente_id ||
    !Number.isInteger(Number(datos.cliente_id)) ||
    Number(datos.cliente_id) <= 0
  ) {
    throw new Error("Debes seleccionar un cliente válido.");
  }

  return placa;
}

// Consultar vehículos y aplicar filtros.
export async function listarVehiculos({
  buscar,
  cliente_id,
  activo,
} = {}) {
  let sql = `
    SELECT
      v.id,
      v.cliente_id,
      v.placa,
      v.tipo,
      v.marca,
      v.modelo,
      v.color,
      v.anio,
      v.activo,
      v.creado_en,
      c.nombre_razon_social AS cliente,
      c.numero_documento AS documento_cliente
    FROM vehiculos v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE 1 = 1
  `;

  const parametros = [];

  if (buscar?.trim()) {
    const termino = `%${buscar.trim()}%`;

    sql += `
      AND (
        v.placa LIKE ?
        OR v.marca LIKE ?
        OR v.modelo LIKE ?
        OR c.nombre_razon_social LIKE ?
        OR c.numero_documento LIKE ?
      )
    `;

    parametros.push(
      termino,
      termino,
      termino,
      termino,
      termino
    );
  }

  if (cliente_id) {
    sql += " AND v.cliente_id = ?";
    parametros.push(cliente_id);
  }

  if (activo !== undefined) {
    sql += " AND v.activo = ?";
    parametros.push(activo === "true" ? 1 : 0);
  }

  sql += " ORDER BY v.placa";

  const [filas] = await pool.execute(sql, parametros);

  return filas;
}

// Consultar un vehículo por su identificador.
export async function obtenerVehiculo(id) {
  const [filas] = await pool.execute(
    `SELECT
       v.id,
       v.cliente_id,
       v.placa,
       v.tipo,
       v.marca,
       v.modelo,
       v.color,
       v.anio,
       v.activo,
       v.creado_en,
       c.tipo_cliente,
       c.tipo_documento,
       c.numero_documento,
       c.nombre_razon_social AS cliente
     FROM vehiculos v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id = ?
     LIMIT 1`,
    [id]
  );

  if (filas.length === 0) {
    throw new Error("El vehículo no existe.");
  }

  return filas[0];
}

// Registrar un vehículo nuevo.
export async function crearVehiculo(datos) {
  const placa = validarVehiculo(datos);
  const clienteId = Number(datos.cliente_id);

  const [clientes] = await pool.execute(
    `SELECT id
     FROM clientes
     WHERE id = ? AND activo = TRUE`,
    [clienteId]
  );

  if (clientes.length === 0) {
    throw new Error("El cliente no existe o está inactivo.");
  }

  const [resultado] = await pool.execute(
    `INSERT INTO vehiculos (
       cliente_id,
       placa,
       tipo,
       marca,
       modelo,
       color,
       anio
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      placa,
      datos.tipo,
      datos.marca?.trim() || null,
      datos.modelo?.trim() || null,
      datos.color?.trim() || null,
      datos.anio || null,
    ]
  );

  return await obtenerVehiculo(resultado.insertId);
}

// Actualizar información de un vehículo.
export async function actualizarVehiculo(id, datos) {
  const placa = validarVehiculo(datos);
  const clienteId = Number(datos.cliente_id);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Consultar y bloquear el vehículo.
    const [vehiculos] = await connection.execute(
      `SELECT id, cliente_id
       FROM vehiculos
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (vehiculos.length === 0) {
      throw new Error("El vehículo no existe.");
    }

    const vehiculo = vehiculos[0];

    // Verificar que el cliente exista y esté activo.
    const [clientes] = await connection.execute(
      `SELECT id, activo
       FROM clientes
       WHERE id = ?
       FOR UPDATE`,
      [clienteId]
    );

    if (clientes.length === 0 || !clientes[0].activo) {
      throw new Error("El cliente no existe o está inactivo.");
    }

    // Determinar si el vehículo ya tiene propietario.
    const tienePropietario =
      vehiculo.cliente_id !== null &&
      vehiculo.cliente_id !== undefined;

    // Determinar si se intenta cambiar un propietario existente.
    const cambiaPropietario =
      tienePropietario &&
      String(vehiculo.cliente_id) !== String(clienteId);

    // Si ya tiene propietario y existe historial,
    // no se permite cambiarlo.
    //
    // Si no tiene propietario (cliente_id NULL),
    // se permite la primera asociación aunque tenga historial.
    if (cambiaPropietario) {
      const [historial] = await connection.execute(
        `SELECT id
         FROM movimientos
         WHERE vehiculo_id = ?
         LIMIT 1`,
        [id]
      );

      if (historial.length > 0) {
        throw new Error(
          "No se puede cambiar el propietario de un vehículo con historial de movimientos."
        );
      }
    }

    // Actualizar los datos del vehículo.
    await connection.execute(
      `UPDATE vehiculos
       SET cliente_id = ?,
           placa = ?,
           tipo = ?,
           marca = ?,
           modelo = ?,
           color = ?,
           anio = ?
       WHERE id = ?`,
      [
        clienteId,
        placa,
        datos.tipo,
        datos.marca?.trim() || null,
        datos.modelo?.trim() || null,
        datos.color?.trim() || null,
        datos.anio || null,
        id,
      ]
    );

    await connection.commit();

    return await obtenerVehiculo(id);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// Activar o desactivar un vehículo.
export async function cambiarEstadoVehiculo(id, activo) {
  if (typeof activo !== "boolean") {
    throw new Error("El estado debe ser verdadero o falso.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Consultar y bloquear el vehículo.
    const [vehiculos] = await connection.execute(
      `SELECT id
       FROM vehiculos
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (vehiculos.length === 0) {
      throw new Error("El vehículo no existe.");
    }

    // No permitir desactivar un vehículo que esté dentro.
    if (!activo) {
      const [movimientos] = await connection.execute(
        `SELECT id
         FROM movimientos
         WHERE vehiculo_id = ?
           AND fecha_salida IS NULL
         LIMIT 1`,
        [id]
      );

      if (movimientos.length > 0) {
        throw new Error(
          "No se puede desactivar un vehículo que se encuentra dentro del parqueadero."
        );
      }
    }

    await connection.execute(
      `UPDATE vehiculos
       SET activo = ?
       WHERE id = ?`,
      [activo, id]
    );

    await connection.commit();

    return await obtenerVehiculo(id);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}
