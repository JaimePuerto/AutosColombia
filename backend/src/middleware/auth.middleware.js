import { autenticarToken } from '../services/auth.service.js';

export async function requiereAutenticacion(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const user = await autenticarToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, mensaje: 'La sesión no es válida o ha expirado. Inicia sesión nuevamente.' });
    }
    req.user = user;
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
