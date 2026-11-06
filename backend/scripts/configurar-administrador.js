import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pool from '../src/config/database.js';
import { generarHashPassword } from '../src/services/auth.service.js';

const rl = readline.createInterface({ input, output });
try {
  const [rows] = await pool.execute('SELECT id, nombre FROM operadores ORDER BY id LIMIT 1');
  if (!rows.length) throw new Error('No existe un operador inicial en la base de datos.');
  const admin = rows[0];
  console.log(`Se configurará como administrador el operador existente: ${admin.nombre} (ID ${admin.id}).`);
  const documento = (await rl.question('Documento para iniciar sesión: ')).trim();
  const password = await rl.question('Nueva contraseña (mínimo 10 caracteres): ');
  const confirmacion = await rl.question('Confirma la contraseña: ');
  if (!documento) throw new Error('El documento es obligatorio.');
  if (password !== confirmacion) throw new Error('Las contraseñas no coinciden.');
  const hash = generarHashPassword(password);
  await pool.execute(
    `UPDATE operadores SET documento = ?, password_hash = ?, rol = 'ADMINISTRADOR',
      estado = 'ACTIVO', activo = TRUE, intentos_fallidos = 0, bloqueado = FALSE
     WHERE id = ?`, [documento, hash, admin.id],
  );
  console.log('Administrador configurado correctamente. Ya puedes iniciar sesión.');
} catch (error) {
  console.error(`No fue posible configurar el administrador: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}
