import crypto from 'node:crypto';
import pool from '../config/database.js';

const SESION_MINUTOS = 90;
const MAX_INTENTOS = 5;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verificarPassword(password, storedHash) {
  if (!storedHash || typeof password !== 'string') return false;
  const [scheme, salt, key] = storedHash.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function generarHashPassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw new Error('La contraseña debe tener al menos 10 caracteres.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

async function registrarEvento(connection, operadorId, documento, accion, detalle = null) {
  await connection.execute(
    `INSERT INTO auditoria_autenticacion
      (operador_id, documento_intentado, accion, detalle)
     VALUES (?, ?, ?, ?)`,
    [operadorId, documento || null, accion, detalle],
  );
}

export async function iniciarSesion({ documento, password }) {
  const identificador = String(documento || '').trim();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, nombre, documento, password_hash, rol, estado,
              activo, intentos_fallidos, bloqueado
       FROM operadores WHERE documento = ? LIMIT 1 FOR UPDATE`,
      [identificador],
    );

    const operador = rows[0];
    const passwordValida = operador && verificarPassword(password, operador.password_hash);
    if (!operador || !passwordValida || !operador.activo || operador.estado !== 'ACTIVO' || operador.bloqueado) {
      if (operador && operador.activo && operador.estado === 'ACTIVO' && !operador.bloqueado && !passwordValida) {
        const intentos = Number(operador.intentos_fallidos || 0) + 1;
        const bloqueado = intentos >= MAX_INTENTOS;
        await connection.execute(
          `UPDATE operadores SET intentos_fallidos = ?, bloqueado = ? WHERE id = ?`,
          [Math.min(intentos, MAX_INTENTOS), bloqueado, operador.id],
        );
        await registrarEvento(connection, operador.id, identificador,
          bloqueado ? 'CUENTA_BLOQUEADA' : 'LOGIN_FALLIDO',
          bloqueado ? 'Bloqueo por cinco intentos fallidos' : 'Credenciales no válidas');
      } else {
        await registrarEvento(connection, operador?.id ?? null, identificador, 'LOGIN_FALLIDO', 'Acceso rechazado');
      }
      await connection.commit();
      throw new Error('No fue posible iniciar sesión. Verifica tus credenciales o el estado de tu cuenta.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    await connection.execute(
      `INSERT INTO sesiones_operadores (operador_id, token_hash, ultima_actividad)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [operador.id, hashToken(token)],
    );
    await connection.execute(
      `UPDATE operadores SET intentos_fallidos = 0, ultimo_ingreso = CURRENT_TIMESTAMP WHERE id = ?`,
      [operador.id],
    );
    await registrarEvento(connection, operador.id, identificador, 'LOGIN_EXITOSO');
    await connection.commit();

    return {
      token,
      usuario: { id: operador.id, nombre: operador.nombre, documento: operador.documento, rol: operador.rol },
      inactividadMinutos: SESION_MINUTOS,
    };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch { /* transacción ya cerrada */ }
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function autenticarToken(token) {
  if (!token) return null;
  const [rows] = await pool.execute(
    `SELECT s.id AS sesion_id, o.id, o.nombre, o.documento, o.rol,
            o.estado, o.activo, o.bloqueado
     FROM sesiones_operadores s
     INNER JOIN operadores o ON o.id = s.operador_id
     WHERE s.token_hash = ? AND s.revocada_en IS NULL
       AND TIMESTAMPDIFF(SECOND, s.ultima_actividad, CURRENT_TIMESTAMP) < ?
     LIMIT 1`,
    [hashToken(token), SESION_MINUTOS * 60],
  );
  const user = rows[0];
  if (!user || !user.activo || user.estado !== 'ACTIVO' || user.bloqueado) {
    if (user) await pool.execute('UPDATE sesiones_operadores SET revocada_en = CURRENT_TIMESTAMP WHERE id = ?', [user.sesion_id]);
    return null;
  }
  await pool.execute('UPDATE sesiones_operadores SET ultima_actividad = CURRENT_TIMESTAMP WHERE id = ?', [user.sesion_id]);
  return { id: user.id, nombre: user.nombre, documento: user.documento, rol: user.rol, sesionId: user.sesion_id };
}

export async function cerrarSesion(user) {
  if (!user?.sesionId) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE sesiones_operadores SET revocada_en = CURRENT_TIMESTAMP WHERE id = ? AND revocada_en IS NULL',
      [user.sesionId],
    );
    await registrarEvento(connection, user.id, user.documento, 'CIERRE_SESION');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
