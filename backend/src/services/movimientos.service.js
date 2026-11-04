
import pool from "../config/database.js";
import { normalizarPlaca, validarPlaca } from "../validators/placas.js";

export async function registrarEntrada({
  placa,
  tipo,
  operadorId,
  acceso = "PRINCIPAL",
}) {
  const placaNormalizada = normalizarPlaca(placa);

  if (!validarPlaca(placaNormalizada, tipo)) {
    throw new Error("La placa no corresponde al tipo de vehículo.");
  }

  if (!["PRINCIPAL", "SECUNDARIO"].includes(acceso)) {
    throw new Error("El acceso indicado no es válido.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [operadores] = await connection.execute(
      "SELECT id FROM operadores WHERE id = ? AND activo = TRUE FOR UPDATE",
      [operadorId]
    );

    if (operadores.length === 0) {
      throw new Error("El operador no existe o está inactivo.");
    }

    // Verificar que el vehículo esté previamente registrado.
    const [vehiculos] = await connection.execute(
      "SELECT id, tipo FROM vehiculos WHERE placa = ? FOR UPDATE",
      [placaNormalizada]
    );

    if (vehiculos.length === 0) {
      throw new Error(
        "El vehículo no se encuentra registrado. Debe registrarse antes de ingresar al parqueadero."
      );
    }

    if (vehiculos[0].tipo !== tipo) {
      throw new Error("El tipo no coincide con el vehículo registrado.");
    }

    const vehiculoId = vehiculos[0].id;

    // Verificar que el vehículo no tenga un ingreso pendiente de salida.
    const [abiertos] = await connection.execute(
      `SELECT m.id, c.codigo AS celda
       FROM movimientos m
       INNER JOIN celdas c ON c.id = m.celda_id
       WHERE m.vehiculo_id = ? AND m.fecha_salida IS NULL
       FOR UPDATE`,
      [vehiculoId]
    );

    if (abiertos.length > 0) {
      const celdaOcupada = abiertos[0].celda;

      throw new Error(
        `El vehículo con placa ${placaNormalizada} ya está parqueado en la celda ${celdaOcupada}.`
      );
    }

    // Bloquear las celdas del tipo mientras se selecciona una disponible.
    const [celdas] = await connection.execute(
      `SELECT c.id, c.codigo
       FROM celdas c
       WHERE c.tipo = ? AND c.activa = TRUE
       ORDER BY c.id
       FOR UPDATE`,
      [tipo]
    );

    let celdaDisponible = null;

    for (const celda of celdas) {
      const [ocupaciones] = await connection.execute(
        `SELECT id
         FROM movimientos
         WHERE celda_id = ? AND fecha_salida IS NULL
         LIMIT 1`,
        [celda.id]
      );

      if (ocupaciones.length === 0) {
        celdaDisponible = celda;
        break;
      }
    }

    if (!celdaDisponible) {
      throw new Error(
        "No hay celdas disponibles para este tipo de vehículo."
      );
    }

    // Registrar el movimiento de entrada.
    const [resultado] = await connection.execute(
      `INSERT INTO movimientos
       (vehiculo_id, celda_id, operador_entrada_id, acceso_entrada)
       VALUES (?, ?, ?, ?)`,
      [vehiculoId, celdaDisponible.id, operadorId, acceso]
    );

    await connection.commit();

    return {
      id: resultado.insertId,
      placa: placaNormalizada,
      tipo,
      celda: celdaDisponible.codigo,
      acceso,
      mensaje: `Entrada registrada correctamente. Celda asignada: ${celdaDisponible.codigo}.`,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function registrarSalida({
  placa,
  operadorId,
  acceso = "PRINCIPAL",
}) {
  const placaNormalizada = normalizarPlaca(placa);

  if (!placaNormalizada) {
    throw new Error("Debes indicar la placa del vehículo.");
  }

  if (!["PRINCIPAL", "SECUNDARIO"].includes(acceso)) {
    throw new Error("El acceso indicado no es válido.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [operadores] = await connection.execute(
      "SELECT id FROM operadores WHERE id = ? AND activo = TRUE FOR UPDATE",
      [operadorId]
    );

    if (operadores.length === 0) {
      throw new Error("El operador no existe o está inactivo.");
    }

    // Buscar el movimiento que todavía no tiene salida.
    const [movimientos] = await connection.execute(
      `SELECT m.id, v.placa, c.codigo AS celda
       FROM movimientos m
       INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       INNER JOIN celdas c ON c.id = m.celda_id
       WHERE v.placa = ? AND m.fecha_salida IS NULL
       FOR UPDATE`,
      [placaNormalizada]
    );

    if (movimientos.length === 0) {
      throw new Error("No hay una entrada abierta para esta placa.");
    }

    const movimiento = movimientos[0];

    // Registrar la salida y el operador responsable.
    await connection.execute(
      `UPDATE movimientos
       SET fecha_salida = CURRENT_TIMESTAMP,
           operador_salida_id = ?,
           acceso_salida = ?
       WHERE id = ? AND fecha_salida IS NULL`,
      [operadorId, acceso, movimiento.id]
    );

    await connection.commit();

    return {
      id: movimiento.id,
      placa: movimiento.placa,
      celda: movimiento.celda,
      acceso,
      mensaje: "Salida registrada correctamente.",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
