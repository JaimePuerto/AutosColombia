import pool from '../config/database.js';

// La Iteración 1 trabaja directamente con el Operador 1, sin login ni token.
export async function requiereAutenticacion(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, nombre, documento, rol FROM operadores WHERE rol = 'OPERADOR' AND activo = TRUE ORDER BY id ASC LIMIT 1`
    );
    const operador = rows[0];
    if (!operador) {
      return res.status(503).json({ ok: false, mensaje: 'No existe un Operador 1 activo para iniciar la Iteración 1.' });
    }
    req.user = operador;
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
