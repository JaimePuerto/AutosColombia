import pool from '../config/database.js';
import { generarHashPassword } from './auth.service.js';

export async function listarOperadores() {
  const [rows] = await pool.execute(
    `SELECT id, nombre, documento, telefono, rol, estado, activo,
            bloqueado, ultimo_ingreso
     FROM operadores ORDER BY nombre`,
  );
  return rows;
}

export async function crearOperador(datos) {
  const nombre = String(datos.nombre || '').trim();
  const documento = String(datos.documento || '').trim();
  const telefono = String(datos.telefono || '').trim() || null;
  const password = String(datos.password || '');
  const rol = datos.rol || 'OPERADOR';
  if (!nombre || !documento) throw new Error('Nombre y documento son obligatorios.');
  if (!['ADMINISTRADOR', 'OPERADOR'].includes(rol)) throw new Error('El perfil indicado no es válido.');
  const password_hash = generarHashPassword(password);
  const [result] = await pool.execute(
    `INSERT INTO operadores (nombre, documento, password_hash, telefono, rol, estado, activo)
     VALUES (?, ?, ?, ?, ?, 'ACTIVO', TRUE)`,
    [nombre, documento, password_hash, telefono, rol],
  );
  const [rows] = await pool.execute(
    `SELECT id, nombre, documento, telefono, rol, estado, activo
     FROM operadores WHERE id = ?`, [result.insertId],
  );
  return rows[0];
}

export async function cambiarEstadoOperador(id, estado, actorId) {
  if (!['ACTIVO', 'SUSPENDIDO', 'DESVINCULADO'].includes(estado)) {
    throw new Error('El estado indicado no es válido.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, rol, estado FROM operadores WHERE id = ? FOR UPDATE', [id],
    );
    if (!rows.length) throw new Error('El operador no existe.');
    const operador = rows[0];
    if (Number(id) === Number(actorId) && estado !== 'ACTIVO') {
      throw new Error('No puedes suspender ni desvincular tu propia cuenta.');
    }
    if (estado !== 'ACTIVO') {
      const [sesiones] = await connection.execute(
        `SELECT id FROM sesiones_operadores
         WHERE operador_id = ? AND revocada_en IS NULL
           AND TIMESTAMPDIFF(SECOND, ultima_actividad, CURRENT_TIMESTAMP) < 5400
         LIMIT 1 FOR UPDATE`, [id],
      );
      if (sesiones.length) throw new Error('No se puede suspender o desvincular: el operador tiene una sesión activa.');
    }
    if (operador.rol === 'ADMINISTRADOR' && estado !== 'ACTIVO') {
      const [admins] = await connection.execute(
        `SELECT COUNT(*) AS total FROM operadores
         WHERE rol = 'ADMINISTRADOR' AND estado = 'ACTIVO' AND activo = TRUE AND id <> ?`, [id],
      );
      if (Number(admins[0].total) < 1) throw new Error('Debe existir al menos un administrador activo.');
    }
    await connection.execute(
      'UPDATE operadores SET estado = ?, activo = ?, bloqueado = FALSE, intentos_fallidos = 0 WHERE id = ?',
      [estado, estado === 'ACTIVO', id],
    );
    await connection.execute(
      `UPDATE sesiones_operadores SET revocada_en = CURRENT_TIMESTAMP
       WHERE operador_id = ? AND revocada_en IS NULL`, [id],
    );
    await connection.commit();
    return { id: Number(id), estado, activo: estado === 'ACTIVO' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
