import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';

import authRoutes from './routes/auth.routes.js';
import movimientosRoutes from './routes/movimientos.routes.js';
import celdasRoutes from './routes/celdas.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import vehiculosRoutes from './routes/vehiculos.routes.js';
import suscripcionesRoutes from './routes/suscripciones.routes.js';
import operadoresRoutes from './routes/operadores.routes.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, mensaje: 'API y MySQL conectados.' });
  } catch {
    res.status(500).json({ ok: false, mensaje: 'No fue posible conectar con MySQL.' });
  }
});

app.get('/api/session', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, nombre, documento, rol FROM operadores WHERE rol = 'OPERADOR' AND activo = TRUE ORDER BY id ASC LIMIT 1`
    );
    if (!rows.length) return res.status(503).json({ ok: false, mensaje: 'No existe un Operador 1 activo.' });
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al cargar el Operador 1:', error);
    res.status(500).json({ ok: false, mensaje: 'No fue posible cargar el operador inicial.' });
  }
});


app.use('/api/auth', authRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/celdas', celdasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/operadores', operadoresRoutes);

app.use((error, _req, res, _next) => {
  console.error('Error no controlado en API:', error);
  res.status(500).json({ ok: false, mensaje: 'Ocurrió un error interno en el servidor.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AutosColombia API disponible en http://localhost:${PORT}`));
