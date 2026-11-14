import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import pool from "../config/database.js";
import {
  registrarEntrada,
  registrarSalida,
  listarMovimientos,
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

router.get("/", async (req, res) => {
  try {
    const filas = await listarMovimientos({
      estado: req.query.estado,
      placa: req.query.placa || req.query.buscar,
      limite: req.query.limite,
    });

    res.json({
      ok: true,
      total: filas.length,
      data: filas,
    });
  } catch (error) {
    if (error.message === "El estado del movimiento no es válido.") {
      return res.status(400).json({ ok: false, mensaje: error.message });
    }

    console.error("Error al consultar el historial:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar el historial.",
    });
  }
});

export default router;