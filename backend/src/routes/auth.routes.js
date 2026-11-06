import { Router } from 'express';
import { iniciarSesion, cerrarSesion } from '../services/auth.service.js';
import { requiereAutenticacion } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const data = await iniciarSesion(req.body || {});
    res.json({ ok: true, data });
  } catch (error) {
    res.status(401).json({ ok: false, mensaje: error.message || 'No fue posible iniciar sesión.' });
  }
});

router.get('/me', requiereAutenticacion, (req, res) => {
  res.json({ ok: true, data: { id: req.user.id, nombre: req.user.nombre, documento: req.user.documento, rol: req.user.rol } });
});

router.post('/logout', requiereAutenticacion, async (req, res) => {
  try {
    await cerrarSesion(req.user);
    res.json({ ok: true, mensaje: 'Sesión cerrada correctamente.' });
  } catch {
    res.status(500).json({ ok: false, mensaje: 'No fue posible cerrar la sesión.' });
  }
});

export default router;
