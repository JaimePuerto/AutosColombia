import crypto from 'node:crypto';
import pool from '../config/database.js';
import { validarPoliticaPassword, generarPasswordTemporal } from '../validators/password.js';
import { enviarCorreoRecuperacion, construirEnlaceRecuperacion } from './correo.service.js';

const SESION_MINUTOS = 90;
const MAX_INTENTOS = 5;
const MINUTOS_VIGENCIA_TOKEN = 30;

function errorHttp(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

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
  validarPoliticaPassword(password);
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
      `SELECT id, nombre, documento, password_hash, password_temporal, rol, estado,
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
      passwordTemporal: Boolean(operador.password_temporal),
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
    `SELECT s.id AS sesion_id, o.id, o.nombre, o.documento, o.rol, o.password_temporal,
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
  return {
    id: user.id,
    nombre: user.nombre,
    documento: user.documento,
    rol: user.rol,
    passwordTemporal: Boolean(user.password_temporal),
    sesionId: user.sesion_id,
  };
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

async function revocarSesiones(connection, operadorId, exceptoSesionId = null) {
  const params = [operadorId];
  let sql = `UPDATE sesiones_operadores SET revocada_en = CURRENT_TIMESTAMP
             WHERE operador_id = ? AND revocada_en IS NULL`;
  if (exceptoSesionId) {
    sql += ' AND id <> ?';
    params.push(exceptoSesionId);
  }
  await connection.execute(sql, params);
}

// RF-10: cambio de contraseña. Si la contraseña vigente es temporal, el cambio es obligatorio
// y no se exige la anterior (el usuario ya se autenticó con ella).
export async function cambiarPassword({ user, actual, nueva }) {
  if (!user?.id) throw errorHttp('La sesión no es válida.', 401);
  validarPoliticaPassword(nueva);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, password_hash, password_temporal FROM operadores WHERE id = ? LIMIT 1 FOR UPDATE',
      [user.id],
    );
    const operador = rows[0];
    if (!operador) throw errorHttp('El usuario no existe.', 404);

    if (!operador.password_temporal && !verificarPassword(actual, operador.password_hash)) {
      throw errorHttp('La contraseña actual no es correcta.', 400);
    }
    if (verificarPassword(nueva, operador.password_hash)) {
      throw errorHttp('La nueva contraseña debe ser diferente a la actual.', 400);
    }

    const password_hash = generarHashPassword(nueva);
    await connection.execute(
      `UPDATE operadores SET password_hash = ?, password_temporal = FALSE,
         actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [password_hash, operador.id],
    );
    await revocarSesiones(connection, operador.id, user.sesionId);
    await registrarEvento(connection, operador.id, user.documento || null, 'CAMBIO_PASSWORD',
      operador.password_temporal ? 'Cambio obligatorio de contraseña temporal' : 'Cambio de contraseña');
    await connection.commit();
    return { id: operador.id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-12: solicitud de recuperación. La respuesta es siempre equivalente para no revelar
// si el documento existe (RNF de privacidad).
export async function solicitarRecuperacion({ documento }) {
  const identificador = String(documento || '').trim();
  const respuestaGenerica = {
    mensaje: 'Si los datos corresponden a una cuenta activa, enviaremos un enlace de recuperación al correo registrado.',
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, nombre, documento, email, estado, activo
       FROM operadores WHERE documento = ? LIMIT 1 FOR UPDATE`,
      [identificador],
    );
    const operador = rows[0];
    const elegible = Boolean(operador && operador.activo && operador.estado === 'ACTIVO');

    if (!elegible) {
      await registrarEvento(connection, operador?.id ?? null, identificador,
        'RECUPERACION_SOLICITADA', 'Solicitud no procedente o cuenta no elegible');
      await connection.commit();
      return { ...respuestaGenerica, enviado: false };
    }

    const token = crypto.randomBytes(32).toString('hex');
    await connection.execute(
      `INSERT INTO recuperacion_password (operador_id, token_hash, expira_en)
       VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))`,
      [operador.id, hashToken(token), MINUTOS_VIGENCIA_TOKEN],
    );
    await registrarEvento(connection, operador.id, identificador,
      'RECUPERACION_SOLICITADA', 'Enlace de recuperación generado');
    await connection.commit();

    let enviado = false;
    try {
      const resultado = await enviarCorreoRecuperacion({
        destinatario: operador.email,
        nombre: operador.nombre,
        enlace: construirEnlaceRecuperacion(token),
      });
      enviado = resultado.enviado;
    } catch (error) {
      console.error('No fue posible enviar el correo de recuperación:', error.message);
    }
    return { ...respuestaGenerica, enviado };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-12: restablecimiento mediante token de un solo uso.
export async function restablecerPassword({ token, nueva }) {
  const valorToken = String(token || '').trim();
  if (!valorToken) throw errorHttp('El enlace de recuperación no es válido.', 400);
  validarPoliticaPassword(nueva);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT r.id, r.operador_id, r.expira_en, r.usado_en, o.estado, o.activo
       FROM recuperacion_password r
       INNER JOIN operadores o ON o.id = r.operador_id
       WHERE r.token_hash = ? LIMIT 1 FOR UPDATE`,
      [hashToken(valorToken)],
    );
    const registro = rows[0];
    if (!registro || registro.usado_en) {
      throw errorHttp('El enlace de recuperación no es válido o ya fue utilizado.', 400);
    }
    if (!registro.activo || registro.estado !== 'ACTIVO') {
      throw errorHttp('La cuenta no permite el restablecimiento de contraseña.', 400);
    }
    if (new Date(registro.expira_en).getTime() < Date.now()) {
      throw errorHttp('El enlace de recuperación ha expirado.', 400);
    }

    const password_hash = generarHashPassword(nueva);
    await connection.execute(
      `UPDATE operadores SET password_hash = ?, password_temporal = FALSE, bloqueado = FALSE,
         intentos_fallidos = 0, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [password_hash, registro.operador_id],
    );
    await connection.execute(
      'UPDATE recuperacion_password SET usado_en = CURRENT_TIMESTAMP WHERE id = ?',
      [registro.id],
    );
    await revocarSesiones(connection, registro.operador_id);
    await registrarEvento(connection, registro.operador_id, null,
      'PASSWORD_RESTABLECIDA', 'Contraseña restablecida mediante enlace de correo');
    await connection.commit();
    return { id: registro.operador_id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-13/RF-21: asigna una contraseña temporal dentro de una transacción existente.
// Devuelve la contraseña en texto para que el administrador pueda entregarla al usuario.
export async function asignarPasswordTemporal(connection, operadorId, operadorDocumento = null, detalle = null) {
  const temporal = generarPasswordTemporal();
  await connection.execute(
    `UPDATE operadores SET password_hash = ?, password_temporal = TRUE,
       bloqueado = FALSE, intentos_fallidos = 0, actualizado_en = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [generarHashPassword(temporal), operadorId],
  );
  await registrarEvento(connection, operadorId, operadorDocumento,
    'PASSWORD_TEMPORAL_ASIGNADA', detalle || 'Contraseña temporal asignada por el administrador');
  return temporal;
}
