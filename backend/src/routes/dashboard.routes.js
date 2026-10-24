
import { Router } from "express";
import pool from "../config/database.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [[totales]] = await pool.execute(
      `SELECT
         COUNT(*) AS total_celdas,
         SUM(tipo = 'CARRO') AS celdas_carros,
         SUM(tipo = 'MOTO') AS celdas_motos
       FROM celdas
       WHERE activa = TRUE`
    );

    const [[ocupacion]] = await pool.execute(
      `SELECT
         COUNT(*) AS vehiculos_dentro,
         SUM(v.tipo = 'CARRO') AS carros_dentro,
         SUM(v.tipo = 'MOTO') AS motos_dentro
       FROM movimientos m
       INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE m.fecha_salida IS NULL`
    );

    res.json({
      ok: true,
      data: {
        ...totales,
        ...ocupacion,
        celdas_libres:
          Number(totales.total_celdas) -
          Number(ocupacion.vehiculos_dentro),
      },
    });
  } catch {
    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar el panel principal.",
    });
  }
});

export default router;
