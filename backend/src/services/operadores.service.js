import pool from '../config/database.js';
import { generarHashPassword, asignarPasswordTemporal } from './auth.service.js';
import { registrarAuditoria } from './auditoria.service.js';
import { validarDatosOperador } from '../validators/gestion.js';

const ESTADOS_VALIDOS = ['ACTIVO', 'SUSPENDIDO', 'DESVINCULADO'];
const ROLES_VALIDOS = ['ADMINISTRADOR', 'OPERADOR'];

function limpiar(valor) {
  return String(valor ?? '').trim();
}

// RF-17: filtros por documento, nombre y estado resueltos en SQL.
export async function listarOperadores(filtros = {}) {
  const condiciones = [];
  const params = [];

  const documento = limpiar(filtros.documento);
  if (documento) { condiciones.push('documento LIKE ?'); params.push(`%${documento}%`); }

  const nombre = limpiar(filtros.nombre);
  if (nombre) {
    condiciones.push('(nombre LIKE ? OR apellidos LIKE ? OR CONCAT_WS(" ", nombre, apellidos) LIKE ?)');
    params.push(`%${nombre}%`, `%${nombre}%`, `%${nombre}%`);
  }

  const estado = limpiar(filtros.estado).toUpperCase();
  if (estado && ESTADOS_VALIDOS.includes(estado)) { condiciones.push('estado = ?'); params.push(estado); }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT id, nombre, apellidos, documento, email, telefono, rol, estado, activo,
            bloqueado, password_temporal, ultimo_ingreso
     FROM operadores
     ${where}
     ORDER BY nombre, apellidos`,
    params,
  );
  return rows;
}

// RF-16: registro de operadores con nombres, apellidos, documento, correo, teléfono,
// rol, estado y contraseña temporal.
export async function crearOperador(datos, actorId = null) {
  const { nombre, apellidos, documento, email, telefono } = validarDatosOperador(datos);
  const rol = (limpiar(datos.rol) || 'OPERADOR').toUpperCase();

  if (!ROLES_VALIDOS.includes(rol)) throw Object.assign(new Error('El perfil indicado no es válido.'), { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existentes] = await connection.execute(
      'SELECT id FROM operadores WHERE documento = ? LIMIT 1 FOR UPDATE', [documento],
    );
    if (existentes.length) throw Object.assign(new Error('Ya existe un operador con ese documento.'), { status: 409 });

    const passwordPlano = limpiar(datos.password);
    const esTemporal = !passwordPlano;
    const password_hash = esTemporal ? null : generarHashPassword(passwordPlano);

    const [result] = await connection.execute(
      `INSERT INTO operadores
         (nombre, apellidos, documento, email, password_hash, password_temporal, telefono, rol, estado, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', TRUE)`,
      [nombre, apellidos, documento, email, password_hash, esTemporal, telefono, rol],
    );

    let passwordTemporal = null;
    if (esTemporal) {
      passwordTemporal = await asignarPasswordTemporal(
        connection, result.insertId, documento, 'Contraseña temporal asignada al crear el operador',
      );
    }

    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: 'OPERADOR',
      entidadId: result.insertId,
      accion: 'CREAR_OPERADOR',
      motivo: 'Registro de operador',
      nuevos: { nombre, apellidos, documento, email, telefono, rol, estado: 'ACTIVO', passwordTemporal: esTemporal },
    });

    await connection.commit();

    const [rows] = await connection.execute(
      `SELECT id, nombre, apellidos, documento, email, telefono, rol, estado, activo, password_temporal
       FROM operadores WHERE id = ?`, [result.insertId],
    );
    return { ...rows[0], passwordTemporalEmitida: passwordTemporal };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-18: modificación de operadores con validación de unicidad y auditoría de valores.
export async function actualizarOperador(id, datos, actorId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, nombre, apellidos, documento, email, telefono, rol, estado, activo
       FROM operadores WHERE id = ? LIMIT 1 FOR UPDATE`, [id],
    );
    const actual = rows[0];
    if (!actual) throw Object.assign(new Error('El operador no existe.'), { status: 404 });

    const { nombre, apellidos, documento, email, telefono } = validarDatosOperador({
      nombre: datos.nombre !== undefined ? datos.nombre : actual.nombre,
      apellidos: datos.apellidos !== undefined ? datos.apellidos : actual.apellidos,
      documento: datos.documento !== undefined ? datos.documento : actual.documento,
      email: datos.email !== undefined ? datos.email : actual.email,
      telefono: datos.telefono !== undefined ? datos.telefono : actual.telefono,
    });
    const rol = datos.rol !== undefined ? limpiar(datos.rol).toUpperCase() : actual.rol;

    if (!ROLES_VALIDOS.includes(rol)) throw Object.assign(new Error('El perfil indicado no es válido.'), { status: 400 });

    if (documento !== actual.documento) {
      const [dupDoc] = await connection.execute(
        'SELECT id FROM operadores WHERE documento = ? AND id <> ? LIMIT 1', [documento, id],
      );
      if (dupDoc.length) throw Object.assign(new Error('Ya existe un operador con ese documento.'), { status: 409 });
    }
    if (email && email !== actual.email) {
      const [dupMail] = await connection.execute(
        'SELECT id FROM operadores WHERE email = ? AND id <> ? LIMIT 1', [email, id],
      );
      if (dupMail.length) throw Object.assign(new Error('Ya existe un operador con ese correo electrónico.'), { status: 409 });
    }

    // Protección del último administrador activo al retirar el rol.
    if (actual.rol === 'ADMINISTRADOR' && rol !== 'ADMINISTRADOR' && actual.estado === 'ACTIVO') {
      const [admins] = await connection.execute(
        `SELECT COUNT(*) AS total FROM operadores
         WHERE rol = 'ADMINISTRADOR' AND estado = 'ACTIVO' AND activo = TRUE AND id <> ?`, [id],
      );
      if (Number(admins[0].total) < 1) throw Object.assign(new Error('Debe existir al menos un administrador activo.'), { status: 400 });
    }

    await connection.execute(
      `UPDATE operadores SET nombre = ?, apellidos = ?, documento = ?, email = ?, telefono = ?,
         rol = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [nombre, apellidos, documento, email, telefono, rol, id],
    );

    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: 'OPERADOR',
      entidadId: id,
      accion: 'MODIFICAR_OPERADOR',
      motivo: 'Modificación de datos del operador',
      anteriores: {
        nombre: actual.nombre, apellidos: actual.apellidos, documento: actual.documento,
        email: actual.email, telefono: actual.telefono, rol: actual.rol,
      },
      nuevos: { nombre, apellidos, documento, email, telefono, rol },
    });

    await connection.commit();
    const [actualizados] = await connection.execute(
      `SELECT id, nombre, apellidos, documento, email, telefono, rol, estado, activo, password_temporal
       FROM operadores WHERE id = ?`, [id],
    );
    return actualizados[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-19/RF-20/RF-21: cambio de estado con motivo obligatorio, auditoría y contraseña
// temporal al reactivar.
export async function cambiarEstadoOperador(id, estado, motivo, actorId) {
  const nuevoEstado = limpiar(estado).toUpperCase();
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw Object.assign(new Error('El estado indicado no es válido.'), { status: 400 });
  }
  const motivoLimpio = limpiar(motivo);
  if (!motivoLimpio) {
    throw Object.assign(new Error('Debes registrar el motivo de la operación.'), { status: 400 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, nombre, apellidos, documento, rol, estado, activo FROM operadores WHERE id = ? LIMIT 1 FOR UPDATE', [id],
    );
    if (!rows.length) throw Object.assign(new Error('El operador no existe.'), { status: 404 });
    const operador = rows[0];

    if (Number(id) === Number(actorId) && nuevoEstado !== 'ACTIVO') {
      throw Object.assign(new Error('No puedes suspender ni desvincular tu propia cuenta.'), { status: 400 });
    }
    if (operador.estado === nuevoEstado) {
      throw Object.assign(new Error(`El operador ya se encuentra en estado ${nuevoEstado}.`), { status: 400 });
    }

    if (nuevoEstado !== 'ACTIVO') {
      const [sesiones] = await connection.execute(
        `SELECT id FROM sesiones_operadores
         WHERE operador_id = ? AND revocada_en IS NULL
           AND TIMESTAMPDIFF(SECOND, ultima_actividad, CURRENT_TIMESTAMP) < 5400
         LIMIT 1 FOR UPDATE`, [id],
      );
      if (sesiones.length) {
        throw Object.assign(new Error('No se puede suspender o desvincular: el operador tiene una sesión activa.'), { status: 409 });
      }
    }
    if (operador.rol === 'ADMINISTRADOR' && nuevoEstado !== 'ACTIVO') {
      const [admins] = await connection.execute(
        `SELECT COUNT(*) AS total FROM operadores
         WHERE rol = 'ADMINISTRADOR' AND estado = 'ACTIVO' AND activo = TRUE AND id <> ?`, [id],
      );
      if (Number(admins[0].total) < 1) throw Object.assign(new Error('Debe existir al menos un administrador activo.'), { status: 400 });
    }

    await connection.execute(
      'UPDATE operadores SET estado = ?, activo = ?, bloqueado = FALSE, intentos_fallidos = 0, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?',
      [nuevoEstado, nuevoEstado === 'ACTIVO', id],
    );
    await connection.execute(
      `UPDATE sesiones_operadores SET revocada_en = CURRENT_TIMESTAMP
       WHERE operador_id = ? AND revocada_en IS NULL`, [id],
    );

    // RF-21: al reactivar se entrega una contraseña temporal y se exige el cambio.
    let passwordTemporal = null;
    if (nuevoEstado === 'ACTIVO') {
      passwordTemporal = await asignarPasswordTemporal(
        connection, id, operador.documento, 'Contraseña temporal asignada al reactivar el operador',
      );
    }

    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: 'OPERADOR',
      entidadId: id,
      accion: nuevoEstado === 'ACTIVO' ? 'REACTIVAR_OPERADOR' : (nuevoEstado === 'SUSPENDIDO' ? 'SUSPENDER_OPERADOR' : 'DESVINCULAR_OPERADOR'),
      motivo: motivoLimpio,
      anteriores: { estado: operador.estado, activo: Boolean(operador.activo) },
      nuevos: { estado: nuevoEstado, activo: nuevoEstado === 'ACTIVO', passwordTemporal: Boolean(passwordTemporal) },
    });

    await connection.commit();
    return { id: Number(id), estado: nuevoEstado, activo: nuevoEstado === 'ACTIVO', passwordTemporalEmitida: passwordTemporal };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RF-13: desbloqueo de cuenta por el administrador con contraseña temporal.
// No reactiva cuentas suspendidas ni desvinculadas (eso corresponde a cambiarEstadoOperador).
export async function desbloquearCuenta(id, actorId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, documento, estado, activo, bloqueado FROM operadores WHERE id = ? LIMIT 1 FOR UPDATE', [id],
    );
    const operador = rows[0];
    if (!operador) throw Object.assign(new Error('El operador no existe.'), { status: 404 });
    if (operador.estado !== 'ACTIVO' || !operador.activo) {
      throw Object.assign(new Error('Solo se pueden desbloquear cuentas activas. Usa la reactivación para cuentas suspendidas o desvinculadas.'), { status: 400 });
    }
    if (!operador.bloqueado) {
      throw Object.assign(new Error('La cuenta no está bloqueada.'), { status: 400 });
    }

    const passwordTemporal = await asignarPasswordTemporal(
      connection, id, operador.documento, 'Desbloqueo de cuenta con contraseña temporal',
    );

    await registrarAuditoria(connection, {
      operadorId: actorId,
      entidad: 'OPERADOR',
      entidadId: id,
      accion: 'DESBLOQUEAR_OPERADOR',
      motivo: 'Desbloqueo de cuenta por el administrador',
      anteriores: { bloqueado: true },
      nuevos: { bloqueado: false, passwordTemporal: true },
    });

    await connection.commit();
    return { id: Number(id), bloqueado: false, passwordTemporalEmitida: passwordTemporal };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
