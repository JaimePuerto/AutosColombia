import { autenticarToken } from '../services/auth.service.js';

// Rutas accesibles aunque el usuario deba cambiar una contraseña temporal (RF-10).
const RUTAS_PERMITIDAS_CON_TEMPORAL = [
  '/api/auth/me',
  '/api/auth/cambiar-password',
  '/api/auth/logout',
];

export async function requiereAutenticacion(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const user = await autenticarToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, mensaje: 'La sesión no es válida o ha expirado. Inicia sesión nuevamente.' });
    }
    req.user = user;

    // Con contraseña temporal solo se permite completar el cambio obligatorio.
    const ruta = (req.originalUrl || '').split('?')[0];
    if (user.passwordTemporal && !RUTAS_PERMITIDAS_CON_TEMPORAL.includes(ruta)) {
      return res.status(403).json({
        ok: false,
        codigo: 'CAMBIO_PASSWORD_REQUERIDO',
        mensaje: 'Debes cambiar tu contraseña temporal antes de continuar.',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permisos para realizar esta operación.' });
    }
    next();
  };
}

export const requiereAdministrador = requiereRol('ADMINISTRADOR');
