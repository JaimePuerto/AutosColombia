import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';
import { sincronizarEstadosSuscripciones } from './services/suscripciones.service.js';

import authRoutes from './routes/auth.routes.js';
import movimientosRoutes from './routes/movimientos.routes.js';
import celdasRoutes from './routes/celdas.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import vehiculosRoutes from './routes/vehiculos.routes.js';
import suscripcionesRoutes from './routes/suscripciones.routes.js';
import operadoresRoutes from './routes/operadores.routes.js';
import auditoriaRoutes from './routes/auditoria.routes.js';
import movimientosAdminRoutes from './routes/movimientos.admin.routes.js';

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

app.use('/api/auth', authRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/celdas', celdasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/operadores', operadoresRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/movimientos-admin', movimientosAdminRoutes);

app.use((error, _req, res, _next) => {
  console.error('Error no controlado en API:', error);
  res.status(500).json({ ok: false, mensaje: 'Ocurrió un error interno en el servidor.' });
});

const PORT = process.env.PORT || 3001;

let sincronizacionEnCurso = false;

async function ejecutarSincronizacionSuscripciones() {
  if (sincronizacionEnCurso) return;
  sincronizacionEnCurso = true;
  try {
    const cantidad = await sincronizarEstadosSuscripciones();
    if (cantidad > 0) {
      console.log(`Suscripciones actualizadas automáticamente: ${cantidad}`);
    }
  } catch (error) {
    console.error("Error en la sincronización automática de suscripciones:", error);
  } finally {
    sincronizacionEnCurso = false;
  }
}

async function iniciarServidor() {
  await ejecutarSincronizacionSuscripciones();
  const intervalo = setInterval(ejecutarSincronizacionSuscripciones, 60 * 1000);
  if (typeof intervalo.unref === "function") intervalo.unref();

  app.listen(PORT, () => console.log(`AutosColombia API disponible en http://localhost:${PORT}`));
}

iniciarServidor();
