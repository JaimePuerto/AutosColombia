
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database.js";
import movimientosRoutes from "./routes/movimientos.routes.js";
import celdasRoutes from "./routes/celdas.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, mensaje: "API y MySQL conectados." });
  } catch {
    res.status(500).json({
      ok: false,
      mensaje: "No fue posible conectar con MySQL.",
    });
  }
});

app.use("/api/movimientos", movimientosRoutes);
app.use("/api/celdas", celdasRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AutosColombia API disponible en http://localhost:${PORT}`);
});
