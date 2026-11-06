
import pool from "../config/database.js";

const ESTADOS_PERMITIDOS = [
  "PENDIENTE",
  "ACTIVA",
  "VENCIDA",
  "CANCELADA",
];

// Validar los datos de una suscripción.
function validarSuscripcion(datos) {
  const vehiculoId = Number(datos.vehiculo_id);
  const valor = Number(datos.valor);
  const fechaInicio = datos.fecha_inicio;
  const fechaFin = datos.fecha_fin;

  if (
    !Number.isInteger(vehiculoId) ||
    vehiculoId <= 0
  ) {
    throw new Error("Debes seleccionar un vehículo válido.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("El valor de la suscripción debe ser mayor que cero.");
  }

  if (
    !fechaInicio ||
    !fechaFin ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)
  ) {
    throw new Error("Debes ingresar fechas válidas en formato AAAA-MM-DD.");
  }

  const inicio = new Date(`${fechaInicio}T00:00:00Z`);
  const fin = new Date(`${fechaFin}T00:00:00Z`);

  if (
    Number.isNaN(inicio.getTime()) ||
    Number.isNaN(fin.getTime()) ||
    inicio.toISOString().slice(0, 10) !== fechaInicio ||
    fin.toISOString().slice(0, 10) !== fechaFin
  ) {
    throw new Error("Las fechas de la suscripción no son válidas.");
  }

  if (fechaFin < fechaInicio) {
    throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
  }

  return {
    vehiculoId,
    valor,
    fechaInicio,
    fechaFin,
  };
}

// Consultar suscripciones y aplicar filtros.
export async function listarSuscripciones({
  buscar,
  vehiculo_id,
  estado,
} = {}) {
  let sql = `
    SELECT
      s.id,
      s.vehiculo_id,
      s.valor,
      s.estado,
      s.fecha_inicio,
      s.fecha_fin,
      s.creado_en,
      v.placa,
      v.tipo,
      v.marca,
      v.modelo,
      c.id AS cliente_id,
      c.nombre_razon_social AS cliente
    FROM suscripciones s
    INNER JOIN vehiculos v ON v.id = s.vehiculo_id
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
      )
    `;

    parametros.push(
      termino,
      termino,
      termino,
      termino
    );
  }

  if (vehiculo_id) {
    sql += " AND s.vehiculo_id = ?";
    parametros.push(vehiculo_id);
  }

  if (estado) {
    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      throw new Error("El estado de la suscripción no es válido.");
    }

    sql += " AND s.estado = ?";
    parametros.push(estado);
  }

  sql += " ORDER BY s.creado_en DESC";

  const [filas] = await pool.execute(sql, parametros);

  return filas;
}

// Consultar una suscripción por ID.
export async function obtenerSuscripcion(id) {
  const [filas] = await pool.execute(
    `SELECT
       s.id,
       s.vehiculo_id,
       s.valor,
       s.estado,
       s.fecha_inicio,
       s.fecha_fin,
       s.creado_en,
       v.placa,
       v.tipo,
       v.marca,
       v.modelo,
       v.activo AS vehiculo_activo,
       c.id AS cliente_id,
       c.nombre_razon_social AS cliente
     FROM suscripciones s
     INNER JOIN vehiculos v ON v.id = s.vehiculo_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE s.id = ?
     LIMIT 1`,
    [id]
  );

  if (filas.length === 0) {
    throw new Error("La suscripción no existe.");
  }

  return filas[0];
}

// Consultar la suscripción de un vehículo por placa.
export async function obtenerSuscripcionPorPlaca(placa) {
  if (!placa?.trim()) {
    throw new Error("Debes ingresar una placa válida.");
  }

  const [filas] = await pool.execute(
    `SELECT
       s.id,
       s.vehiculo_id,
       s.valor,
       s.estado,
       s.fecha_inicio,
       s.fecha_fin,
       s.creado_en,
       v.placa,
       v.tipo,
       v.marca,
       v.modelo,
       c.id AS cliente_id,
       c.nombre_razon_social AS cliente
     FROM suscripciones s
     INNER JOIN vehiculos v ON v.id = s.vehiculo_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.placa = ?
     LIMIT 1`,
    [placa.trim().toUpperCase()]
  );

  if (filas.length === 0) {
    throw new Error("El vehículo no tiene una suscripción registrada.");
  }

  return filas[0];
}

// Registrar una suscripción.
export async function crearSuscripcion(datos) {
  const {
    vehiculoId,
    valor,
    fechaInicio,
    fechaFin,
  } = validarSuscripcion(datos);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Consultar y bloquear el vehículo.
    const [vehiculos] = await connection.execute(
      `SELECT id, activo
       FROM vehiculos
       WHERE id = ?
       FOR UPDATE`,
      [vehiculoId]
    );

    if (vehiculos.length === 0) {
      throw new Error("El vehículo no existe.");
    }

    if (!vehiculos[0].activo) {
      throw new Error("No se puede registrar una suscripción para un vehículo inactivo.");
    }

    // Verificar que el vehículo nunca haya tenido una suscripción.
    const [suscripciones] = await connection.execute(
      `SELECT id
       FROM suscripciones
       WHERE vehiculo_id = ?
       LIMIT 1`,
      [vehiculoId]
    );

    if (suscripciones.length > 0) {
      throw new Error(
        "Este vehículo ya tiene una suscripción registrada y no puede recibir otra."
      );
    }

    const [resultado] = await connection.execute(
      `INSERT INTO suscripciones (
         vehiculo_id,
         valor,
         estado,
         fecha_inicio,
         fecha_fin
       )
       VALUES (?, ?, 'PENDIENTE', ?, ?)`,
      [
        vehiculoId,
        valor,
        fechaInicio,
        fechaFin,
      ]
    );

    await connection.commit();

    return await obtenerSuscripcion(resultado.insertId);

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// Cambiar el estado de una suscripción.
export async function cambiarEstadoSuscripcion(id, estado) {
  if (!ESTADOS_PERMITIDOS.includes(estado)) {
    throw new Error("El estado de la suscripción no es válido.");
  }

  const [resultado] = await pool.execute(
    `UPDATE suscripciones
     SET estado = ?
     WHERE id = ?`,
    [estado, id]
  );

  if (resultado.affectedRows === 0) {
    throw new Error("La suscripción no existe.");
  }

  return await obtenerSuscripcion(id);
}
