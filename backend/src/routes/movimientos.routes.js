import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import pool from "../config/database.js";
import {
  registrarEntrada,
  registrarSalida,
} from "../services/movimientos.service.js";

const router = Router();
router.use(requiereAutenticacion);

router.post("/entrada", async (req, res) => {
  try {
    const resultado = await registrarEntrada({ ...req.body, operadorId: req.user.id });

    res.status(201).json({
      ok: true,
      data: resultado,
    });
  } catch (error) {
    const mensaje =
      error.message || "No fue posible registrar la entrada.";

    const estado = mensaje.includes("Duplicate entry") ? 409 : 400;

    res.status(estado).json({
      ok: false,
      mensaje,
      message: mensaje,
    });
  }
});

router.post("/salida", async (req, res) => {
  try {
    const resultado = await registrarSalida({ ...req.body, operadorId: req.user.id });

    res.json({
      ok: true,
      data: resultado,
    });
  } catch (error) {
    const mensaje =
      error.message || "No hay una entrada abierta para esta placa.";

    res.status(400).json({
      ok: false,
      mensaje,
      message: mensaje,
    });
  }
});

router.get("/vehiculo/:placa", async (req, res) => {
  try {
    const placa = req.params.placa.toUpperCase().replace(/\s+/g, "");

    const [filas] = await pool.execute(
      `SELECT m.id, v.placa, v.tipo, c.codigo AS celda,
              m.fecha_entrada, m.acceso_entrada
       FROM movimientos m
       INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       INNER JOIN celdas c ON c.id = m.celda_id
       WHERE v.placa = ? AND m.fecha_salida IS NULL
       LIMIT 1`,
      [placa]
    );

    res.json({
      ok: true,
      dentro: filas.length > 0,
      data: filas[0] ?? null,
    });
  } catch {
    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar el vehículo.",
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const [filas] = await pool.execute(
      `SELECT
          m.id,
          v.placa,
          v.tipo,
          c.codigo AS celda,
          m.fecha_entrada,
          m.fecha_salida,
          m.acceso_entrada,
          m.acceso_salida,
          m.operador_entrada_id,
          m.operador_salida_id,
          oe.nombre AS operador_entrada,
          os.nombre AS operador_salida
       FROM movimientos m
       INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       INNER JOIN celdas c ON c.id = m.celda_id
       LEFT JOIN operadores oe
          ON oe.id = m.operador_entrada_id
       LEFT JOIN operadores os
          ON os.id = m.operador_salida_id
       ORDER BY m.fecha_entrada DESC
       LIMIT 200`
    );

    res.json({
      ok: true,
      data: filas,
    });
  } catch (error) {
    console.error("Error al consultar el historial:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar el historial.",
    });
  }
});

export default router;