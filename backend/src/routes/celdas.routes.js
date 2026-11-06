
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import pool from "../config/database.js";

const router = Router();
router.use(requiereAutenticacion);

router.get("/disponibles", async (req, res) => {
  const { tipo } = req.query;

  if (!["CARRO", "MOTO"].includes(tipo)) {
    return res.status(400).json({
      ok: false,
      mensaje: "El tipo debe ser CARRO o MOTO.",
    });
  }

  try {
    const [filas] = await pool.execute(
      `SELECT c.id, c.codigo, c.tipo
       FROM celdas c
       WHERE c.tipo = ?
         AND c.activa = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM movimientos m
           WHERE m.celda_id = c.id AND m.fecha_salida IS NULL
         )
       ORDER BY c.codigo`,
      [tipo]
    );

    res.json({ ok: true, total: filas.length, data: filas });
  } catch {
    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar las celdas.",
    });
  }
});

export default router;
