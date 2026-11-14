
import pool from "../config/database.js";
import {
  normalizarPlaca,
  validarPlaca,
  tipoCeldaParaVehiculo,
} from "../validators/placas.js";
import { validarAtributosVehiculo } from "../validators/gestion.js";
import { registrarAuditoria } from "./auditoria.service.js";

export const TIPOS_VEHICULO = ["CARRO", "MOTO", "CAMIONETA"];

// Valida un vehículo y normaliza sus datos (RF-01 incluye el tipo CAMIONETA).
export function validarDatosVehiculo(datos) {
  const tipo = String(datos?.tipo || "").toUpperCase();

  if (!TIPOS_VEHICULO.includes(tipo)) {
    throw Object.assign(new Error("El tipo de vehículo no es válido."), { status: 400 });
  }

  const placa = normalizarPlaca(datos?.placa);

  if (!validarPlaca(placa, tipo)) {
    throw Object.assign(
      new Error(
        tipo === "MOTO"
          ? "La placa debe tener el formato AAA00A para motos."
          : "La placa debe tener el formato AAA000.",
      ),
      { status: 400 },
    );
  }

  const clienteId = Number(datos?.cliente_id);

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    throw Object.assign(new Error("Debes seleccionar un cliente válido."), { status: 400 });
  }

  const { marca, modelo, color } = validarAtributosVehiculo(datos);
  return { placa, tipo, clienteId, marca, modelo, color };
}

// Inserta un vehículo dentro de una transacción existente.
// RF-24: si la placa pertenece a otro cliente, rechaza e informa del procedimiento de cambio de titular.
export async function insertarVehiculo(connection, datos) {
  const { placa, tipo, clienteId, marca, modelo, color } = validarDatosVehiculo(datos);

  const [clientes] = await connection.execute(
    "SELECT id, activo FROM clientes WHERE id = ?", [clienteId],
  );
  if (!clientes.length) throw Object.assign(new Error("El cliente no existe."), { status: 404 });
  if (!clientes[0].activo) throw Object.assign(new Error("El cliente está inactivo."), { status: 400 });

  const [existentes] = await connection.execute(
    "SELECT id, cliente_id FROM vehiculos WHERE placa = ? LIMIT 1", [placa],
  );
  if (existentes.length) {
    const propietario = existentes[0].cliente_id;
    if (propietario && String(propietario) !== String(clienteId)) {
      throw Object.assign(
        new Error(`La placa ${placa} ya está registrada a nombre de otro cliente. El cambio de titular solo puede realizarlo un administrador mediante el procedimiento de cambio de titular.`),
        { status: 409 },
      );
    }
    throw Object.assign(new Error(`Ya existe un vehículo registrado con la placa ${placa}.`), { status: 409 });
  }

  const [resultado] = await connection.execute(
    `INSERT INTO vehiculos (cliente_id, placa, tipo, marca, modelo, color, anio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      clienteId,
      placa,
      tipo,
      marca,
      modelo,
      color,
      datos.anio || null,
    ],
  );

  return resultado.insertId;
}

// Consultar vehículos y aplicar filtros.
export async function listarVehiculos({ buscar, cliente_id, activo, tipo } = {}) {
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
    parametros.push(termino, termino, termino, termino, termino);
  }

  if (cliente_id) { sql += " AND v.cliente_id = ?"; parametros.push(cliente_id); }
  if (activo !== undefined) { sql += " AND v.activo = ?"; parametros.push(activo === "true" ? 1 : 0); }
  if (tipo && TIPOS_VEHICULO.includes(String(tipo).toUpperCase())) {
    sql += " AND v.tipo = ?";
    parametros.push(String(tipo).toUpperCase());
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
    [id],
  );

  if (filas.length === 0) throw Object.assign(new Error("El vehículo no existe."), { status: 404 });
  return filas[0];
}

// Registrar un vehículo nuevo (RF-24).
export async function crearVehiculo(datos, actorId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = await insertarVehiculo(connection, datos);
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "VEHICULO",
      entidadId: id,
      accion: "CREAR_VEHICULO",
      motivo: "Registro de vehículo",
      nuevos: {
        placa: normalizarPlaca(datos.placa),
        tipo: String(datos.tipo || "").toUpperCase(),
        cliente_id: Number(datos.cliente_id),
      },
    });
    await connection.commit();
    return await obtenerVehiculo(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Actualizar información de un vehículo (RF-26).
// El cambio de titular no se realiza aquí: exige el procedimiento administrativo (RF-27).
export async function actualizarVehiculo(id, datos, actorId = null) {
  const { placa, tipo, clienteId, marca, modelo, color } = validarDatosVehiculo(datos);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [vehiculos] = await connection.execute(
      "SELECT * FROM vehiculos WHERE id = ? FOR UPDATE", [id],
    );
    if (vehiculos.length === 0) throw Object.assign(new Error("El vehículo no existe."), { status: 404 });
    const vehiculo = vehiculos[0];

    const [clientes] = await connection.execute(
      "SELECT id, activo FROM clientes WHERE id = ? FOR UPDATE", [clienteId],
    );
    if (clientes.length === 0) throw Object.assign(new Error("El cliente no existe."), { status: 404 });
    if (!clientes[0].activo) throw Object.assign(new Error("El cliente está inactivo."), { status: 400 });

    // RF-27: el cambio de propietario requiere el flujo de cambio de titular.
    if (String(vehiculo.cliente_id) !== String(clienteId)) {
      if (vehiculo.cliente_id === null) {
        // Primera asociación: se permite sin trámite de titular.
      } else {
        throw Object.assign(
          new Error("Para cambiar el titular del vehículo utiliza el procedimiento de cambio de titular."),
          { status: 409 },
        );
      }
    }

    // RF-26: no permitir cambiar el tipo si existe un movimiento activo.
    if (vehiculo.tipo !== tipo) {
      const [activos] = await connection.execute(
        `SELECT id FROM movimientos
         WHERE vehiculo_id = ? AND fecha_salida IS NULL AND anulado_en IS NULL
         LIMIT 1 FOR UPDATE`,
        [id],
      );
      if (activos.length) {
        throw Object.assign(
          new Error("No se puede cambiar el tipo del vehículo mientras tenga un movimiento activo."),
          { status: 409 },
        );
      }
    }

    // Reactivar el vehículo al asignarle un cliente, si estaba inactivo.
    const nuevoActivo = datos.activo === undefined ? vehiculo.activo : Boolean(datos.activo);

    await connection.execute(
      `UPDATE vehiculos
       SET cliente_id = ?, placa = ?, tipo = ?, marca = ?, modelo = ?, color = ?, anio = ?, activo = ?
       WHERE id = ?`,
      [
        clienteId,
        placa,
        tipo,
        marca,
        modelo,
        color,
        datos.anio || null,
        nuevoActivo,
        id,
      ],
    );

    // RF-37: trazabilidad de la modificación con valores anteriores y nuevos.
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "VEHICULO",
      entidadId: id,
      accion: "MODIFICAR_VEHICULO",
      motivo: "Modificación de datos del vehículo",
      anteriores: {
        placa: vehiculo.placa, tipo: vehiculo.tipo, marca: vehiculo.marca,
        modelo: vehiculo.modelo, color: vehiculo.color, anio: vehiculo.anio,
        cliente_id: vehiculo.cliente_id, activo: Boolean(vehiculo.activo),
      },
      nuevos: {
        placa, tipo, marca, modelo, color,
        anio: datos.anio || null, cliente_id: clienteId, activo: nuevoActivo,
      },
    });

    await connection.commit();
    return await obtenerVehiculo(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-27: cambio de titular administrativo. Conserva el historial de movimientos y
// registra el vínculo con el titular anterior.
export async function cambiarTitular(id, datos, actorId = null) {
  const motivo = String(datos?.motivo || "").trim();
  if (motivo.length < 5) {
    throw Object.assign(new Error("Debes indicar el motivo del cambio de titular (mínimo 5 caracteres)."), { status: 400 });
  }
  const clienteNuevoId = Number(datos?.cliente_id);
  if (!Number.isInteger(clienteNuevoId) || clienteNuevoId <= 0) {
    throw Object.assign(new Error("Debes seleccionar el nuevo titular."), { status: 400 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [vehiculos] = await connection.execute(
      "SELECT * FROM vehiculos WHERE id = ? FOR UPDATE", [id],
    );
    if (vehiculos.length === 0) throw Object.assign(new Error("El vehículo no existe."), { status: 404 });
    const vehiculo = vehiculos[0];

    if (String(vehiculo.cliente_id) === String(clienteNuevoId)) {
      throw Object.assign(new Error("El vehículo ya pertenece a ese cliente."), { status: 400 });
    }

    const [clientes] = await connection.execute(
      "SELECT id, activo, nombre_razon_social FROM clientes WHERE id = ? FOR UPDATE", [clienteNuevoId],
    );
    if (clientes.length === 0) throw Object.assign(new Error("El nuevo titular no existe."), { status: 404 });
    if (!clientes[0].activo) throw Object.assign(new Error("El nuevo titular está inactivo."), { status: 400 });

    // No permitir el cambio de titular con un movimiento activo (trazabilidad del ingreso).
    const [activos] = await connection.execute(
      `SELECT id FROM movimientos
       WHERE vehiculo_id = ? AND fecha_salida IS NULL AND anulado_en IS NULL LIMIT 1 FOR UPDATE`,
      [id],
    );
    if (activos.length) {
      throw Object.assign(
        new Error("No se puede cambiar el titular mientras el vehículo tenga un movimiento activo."),
        { status: 409 },
      );
    }

    await connection.execute(
      `INSERT INTO historial_titulares_vehiculo
         (vehiculo_id, cliente_anterior_id, cliente_nuevo_id, operador_id, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [id, vehiculo.cliente_id, clienteNuevoId, actorId, motivo],
    );
    await connection.execute(
      "UPDATE vehiculos SET cliente_id = ? WHERE id = ?", [clienteNuevoId, id],
    );
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "VEHICULO",
      entidadId: id,
      accion: "CAMBIO_TITULAR",
      motivo,
      anteriores: { cliente_id: vehiculo.cliente_id },
      nuevos: { cliente_id: clienteNuevoId, placa: vehiculo.placa },
    });

    await connection.commit();
    return await obtenerVehiculo(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Consultar el historial de titulares de un vehículo (RF-27).
export async function historialTitulares(id) {
  const [filas] = await pool.execute(
    `SELECT h.id, h.motivo, h.fecha_cambio,
            h.cliente_anterior_id, ca.nombre_razon_social AS cliente_anterior,
            h.cliente_nuevo_id, cn.nombre_razon_social AS cliente_nuevo,
            o.nombre AS operador
     FROM historial_titulares_vehiculo h
     LEFT JOIN clientes ca ON ca.id = h.cliente_anterior_id
     LEFT JOIN clientes cn ON cn.id = h.cliente_nuevo_id
     LEFT JOIN operadores o ON o.id = h.operador_id
     WHERE h.vehiculo_id = ?
     ORDER BY h.fecha_cambio DESC, h.id DESC`,
    [id],
  );
  return filas;
}

// Activar o desactivar un vehículo.
export async function cambiarEstadoVehiculo(id, activo, actorId = null) {
  if (typeof activo !== "boolean") {
    throw Object.assign(new Error("El estado debe ser verdadero o falso."), { status: 400 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [vehiculos] = await connection.execute(
      "SELECT id, activo FROM vehiculos WHERE id = ? FOR UPDATE", [id],
    );
    if (vehiculos.length === 0) throw Object.assign(new Error("El vehículo no existe."), { status: 404 });

    if (!activo) {
      const [movimientos] = await connection.execute(
        `SELECT id FROM movimientos
         WHERE vehiculo_id = ? AND fecha_salida IS NULL AND anulado_en IS NULL LIMIT 1`,
        [id],
      );
      if (movimientos.length > 0) {
        throw Object.assign(
          new Error("No se puede desactivar un vehículo que se encuentra dentro del parqueadero."),
          { status: 409 },
        );
      }
    }

    await connection.execute("UPDATE vehiculos SET activo = ? WHERE id = ?", [activo, id]);
    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: "VEHICULO",
      entidadId: id,
      accion: "CAMBIAR_ESTADO_VEHICULO",
      motivo: activo ? "Reactivación de vehículo" : "Desactivación de vehículo",
      anteriores: { activo: Boolean(vehiculos[0].activo) },
      nuevos: { activo },
    });

    await connection.commit();
    return await obtenerVehiculo(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { tipoCeldaParaVehiculo };
