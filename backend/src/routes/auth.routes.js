import { Router } from 'express';
import {
  iniciarSesion,
  cerrarSesion,
  cambiarPassword,
  solicitarRecuperacion,
  restablecerPassword,
} from '../services/auth.service.js';
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
  res.json({
    ok: true,
    data: {
      id: req.user.id,
      nombre: req.user.nombre,
      documento: req.user.documento,
      rol: req.user.rol,
      passwordTemporal: Boolean(req.user.passwordTemporal),
    },
  });
});

router.post('/logout', requiereAutenticacion, async (req, res) => {
  try {
    await cerrarSesion(req.user);
    res.json({ ok: true, mensaje: 'Sesión cerrada correctamente.' });
  } catch {
    res.status(500).json({ ok: false, mensaje: 'No fue posible cerrar la sesión.' });
  }
});

// RF-10: cambio de contraseña (incluye el cambio obligatorio de la contraseña temporal).
router.post('/cambiar-password', requiereAutenticacion, async (req, res) => {
  try {
    await cambiarPassword({ user: req.user, actual: req.body?.actual, nueva: req.body?.nueva });
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

// RF-12: solicitud de recuperación de contraseña por correo.
router.post('/recuperacion', async (req, res) => {
  try {
    const data = await solicitarRecuperacion(req.body || {});
    res.json({ ok: true, ...data });
  } catch {
    res.status(500).json({ ok: false, mensaje: 'No fue posible procesar la solicitud de recuperación.' });
  }
});

// RF-12: restablecimiento mediante el token enviado por correo.
router.post('/recuperacion/restablecer', async (req, res) => {
  try {
    await restablecerPassword({ token: req.body?.token, nueva: req.body?.nueva });
    res.json({ ok: true, mensaje: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

export default router;
