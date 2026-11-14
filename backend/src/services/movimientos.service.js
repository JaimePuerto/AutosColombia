
import pool from "../config/database.js";
import {
  normalizarPlaca,
  validarPlaca,
  tipoCeldaParaVehiculo,
} from "../validators/placas.js";
import { registrarAuditoria } from "./auditoria.service.js";

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

  // RF-01: las camionetas ocupan celdas de tipo CARRO.
  const tipoCelda = tipoCeldaParaVehiculo(tipo);

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
      "SELECT id, tipo, activo FROM vehiculos WHERE placa = ? FOR UPDATE",
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

    // Impedir el ingreso de vehículos inactivos.
    if (!vehiculos[0].activo) {
      throw new Error(
        `El vehículo con placa ${placaNormalizada} se encuentra inactivo y no puede ingresar al parqueadero.`
      );
    }

    const vehiculoId = vehiculos[0].id;

    // Debe existir una suscripción VIGENTE cuya vigencia incluya la fecha actual.
    // La salida no consulta suscripciones: nunca se bloquea la salida de un vehículo dentro.
    const [suscripcionesVigentes] = await connection.execute(
      `SELECT id
       FROM suscripciones
       WHERE vehiculo_id = ?
         AND estado = 'VIGENTE'
         AND fecha_inicio <= CURRENT_DATE()
         AND fecha_fin >= CURRENT_DATE()
       ORDER BY fecha_inicio DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [vehiculoId]
    );

    if (suscripcionesVigentes.length === 0) {
      throw new Error(
        `El vehículo ${placaNormalizada} no tiene una suscripción vigente. No es posible registrar la entrada.`
      );
    }

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
    // RF-01: se usa el tipo de celda equivalente (CAMIONETA -> CARRO).
    const [celdas] = await connection.execute(
      `SELECT c.id, c.codigo, c.tipo
       FROM celdas c
       WHERE c.tipo = ? AND c.activa = TRUE
       ORDER BY c.id
       FOR UPDATE`,
      [tipoCelda]
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
    // RF-31: se guarda el código y tipo de celda utilizados en ese momento
    // (snapshot) para no depender exclusivamente del JOIN con la celda actual.
    const [resultado] = await connection.execute(
      `INSERT INTO movimientos
       (vehiculo_id, celda_id, operador_entrada_id, acceso_entrada,
        codigo_celda_snapshot, tipo_celda_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        vehiculoId,
        celdaDisponible.id,
        operadorId,
        acceso,
        celdaDisponible.codigo,
        celdaDisponible.tipo,
      ]
    );

    // Trazabilidad: la entrada se audita dentro de la misma transacción.
    await registrarAuditoria(connection, {
      operadorId,
      accion: "ENTRADA",
      entidad: "MOVIMIENTO",
      entidadId: resultado.insertId,
      motivo: `Entrada de vehículo ${placaNormalizada} en la celda ${celdaDisponible.codigo}.`,
      anteriores: null,
      nuevos: {
        placa: placaNormalizada,
        tipo,
        celda: celdaDisponible.codigo,
        acceso_entrada: acceso,
        estado: "ACTIVO",
      },
    });

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

// Condiciones SQL para el filtro de estado del historial de movimientos.
const CONDICIONES_ESTADO = {
  ACTIVO: "m.fecha_salida IS NULL AND m.anulado_en IS NULL",
  ACTIVOS: "m.fecha_salida IS NULL AND m.anulado_en IS NULL",
  FINALIZADO: "m.fecha_salida IS NOT NULL AND m.anulado_en IS NULL",
  FINALIZADOS: "m.fecha_salida IS NOT NULL AND m.anulado_en IS NULL",
  ANULADO: "m.anulado_en IS NOT NULL",
  ANULADOS: "m.anulado_en IS NOT NULL",
};

// Traduce el estado solicitado a su condición SQL.
// Devuelve null cuando no se debe aplicar filtro ("TODOS" o vacío).
export function condicionEstadoMovimiento(estado) {
  if (estado === undefined || estado === null || String(estado).trim() === "") {
    return null;
  }
  const clave = String(estado).trim().toUpperCase();
  if (clave === "TODOS") return null;
  const condicion = CONDICIONES_ESTADO[clave];
  if (!condicion) throw new Error("El estado del movimiento no es válido.");
  return condicion;
}

// Consulta el historial aplicando los filtros en el backend.
export async function listarMovimientos({ estado, placa, limite = 200 } = {}) {
  const filtros = [];
  const params = [];

  const condicionEstado = condicionEstadoMovimiento(estado);
  if (condicionEstado) filtros.push(condicionEstado);

  if (placa !== undefined && placa !== null && String(placa).trim() !== "") {
    filtros.push("v.placa LIKE ?");
    params.push(`%${normalizarPlaca(placa)}%`);
  }

  const parsedLimit = Number(limite);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500)
    : 200;
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const [filas] = await pool.execute(
    `SELECT
        m.id,
        v.placa,
        v.tipo,
        m.celda_id,
        COALESCE(m.codigo_celda_snapshot, c.codigo) AS celda,
        COALESCE(m.tipo_celda_snapshot, c.tipo) AS tipo_celda,
        m.codigo_celda_snapshot,
        m.tipo_celda_snapshot,
        m.fecha_entrada,
        m.fecha_salida,
        m.acceso_entrada,
        m.acceso_salida,
        m.observaciones,
        m.operador_entrada_id,
        m.operador_salida_id,
        oe.nombre AS operador_entrada,
        os.nombre AS operador_salida,
        m.anulado_en,
        m.motivo_anulacion
     FROM movimientos m
     INNER JOIN vehiculos v ON v.id = m.vehiculo_id
     LEFT JOIN celdas c ON c.id = m.celda_id
     LEFT JOIN operadores oe ON oe.id = m.operador_entrada_id
     LEFT JOIN operadores os ON os.id = m.operador_salida_id
     ${where}
     ORDER BY m.fecha_entrada DESC, m.id DESC
     LIMIT ${safeLimit}`,
    params,
  );

  return filas;
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
    // No se valida el estado del vehículo: debe poder salir
    // aunque haya sido desactivado después de su ingreso.
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

    // Trazabilidad: la salida se audita dentro de la misma transacción.
    await registrarAuditoria(connection, {
      operadorId,
      accion: "SALIDA",
      entidad: "MOVIMIENTO",
      entidadId: movimiento.id,
      motivo: `Salida de vehículo ${movimiento.placa} de la celda ${movimiento.celda}.`,
      anteriores: { estado: "ACTIVO", fecha_salida: null },
      nuevos: {
        placa: movimiento.placa,
        celda: movimiento.celda,
        acceso_salida: acceso,
        estado: "FINALIZADO",
      },
    });

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
