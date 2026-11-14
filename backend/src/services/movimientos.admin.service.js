import pool from '../config/database.js';
import { registrarAuditoria } from './auditoria.service.js';
import { tipoCeldaParaVehiculo } from '../validators/placas.js';

const ACCESOS = ['PRINCIPAL', 'SECUNDARIO'];

export async function anularMovimiento(id, motivo, operadorId, meta = {}) {
  const razon = String(motivo || '').trim();
  if (razon.length < 5) throw new Error('Debes indicar un motivo de anulación de al menos 5 caracteres.');
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [rows] = await cx.execute(
      `SELECT m.*, c.codigo AS celda, v.placa
       FROM movimientos m
       INNER JOIN celdas c ON c.id=m.celda_id
       INNER JOIN vehiculos v ON v.id=m.vehiculo_id
       WHERE m.id=? FOR UPDATE`, [id]);
    if (!rows.length) throw new Error('El movimiento no existe.');
    const m = rows[0];
    if (m.anulado_en) throw new Error('El movimiento ya se encuentra anulado.');
    const old = { fecha_salida: m.fecha_salida, celda_id: m.celda_id, celda: m.celda, placa: m.placa };
    await cx.execute(
      `UPDATE movimientos SET anulado_en=CURRENT_TIMESTAMP, anulado_por=?, motivo_anulacion=?,
       fecha_salida=COALESCE(fecha_salida,CURRENT_TIMESTAMP), operador_salida_id=COALESCE(operador_salida_id,?)
       WHERE id=?`, [operadorId, razon, operadorId, id]);
    await registrarAuditoria(cx, { operadorId, accion:'ANULAR', entidad:'MOVIMIENTO', entidadId:id, motivo:razon,
      anteriores:old, nuevos:{ anulado:true, celda_liberada:true }, ...meta });
    await cx.commit();
    return { id:Number(id), anulado:true, celdaLiberada: m.fecha_salida == null };
  } catch (e) { await cx.rollback(); throw e; }
  finally { cx.release(); }
}

export async function modificarMovimiento(id, datos, motivo, operadorId, meta = {}) {
  const razon = String(motivo || '').trim();
  if (razon.length < 5) throw new Error('Debes indicar un motivo de modificación de al menos 5 caracteres.');
  const updates = {};
  if (datos.observaciones !== undefined) updates.observaciones = String(datos.observaciones).slice(0,500);
  if (datos.acceso_entrada !== undefined) {
    if (!ACCESOS.includes(datos.acceso_entrada)) throw new Error('El acceso de entrada no es válido.');
    updates.acceso_entrada = datos.acceso_entrada;
  }
  if (datos.acceso_salida !== undefined) {
    if (datos.acceso_salida !== null && !ACCESOS.includes(datos.acceso_salida)) throw new Error('El acceso de salida no es válido.');
    updates.acceso_salida = datos.acceso_salida;
  }
  if (datos.celda_id !== undefined) {
    const cellId = Number(datos.celda_id);
    if (!Number.isInteger(cellId) || cellId <= 0) throw new Error('La celda seleccionada no es válida.');
    updates.celda_id = cellId;
  }
  if (!Object.keys(updates).length) throw new Error('No hay campos permitidos para modificar.');
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [rows] = await cx.execute('SELECT * FROM movimientos WHERE id=? FOR UPDATE',[id]);
    if (!rows.length) throw new Error('El movimiento no existe.');
    const old = rows[0];
    if (old.fecha_salida !== null || old.anulado_en) throw new Error('Solo se pueden modificar movimientos activos.');
    if (updates.celda_id !== undefined && updates.celda_id !== Number(old.celda_id)) {
      const [cells] = await cx.execute('SELECT id,tipo,activa,codigo FROM celdas WHERE id=? FOR UPDATE',[updates.celda_id]);
      if (!cells.length || !cells[0].activa) throw new Error('La celda seleccionada no existe o está bloqueada.');
      const [occupied] = await cx.execute('SELECT id FROM movimientos WHERE celda_id=? AND fecha_salida IS NULL AND anulado_en IS NULL AND id<>? FOR UPDATE',[updates.celda_id,id]);
      if (occupied.length) throw new Error('La celda seleccionada ya está ocupada.');
      const [vehicle] = await cx.execute('SELECT tipo FROM vehiculos WHERE id=?',[old.vehiculo_id]);
      // RF-01: las camionetas usan celdas de tipo CARRO.
      if (tipoCeldaParaVehiculo(vehicle[0].tipo) !== cells[0].tipo) throw new Error('El tipo de celda no corresponde al vehículo.');
      // RF-31: al cambiar la celda se actualiza el snapshot del movimiento activo.
      updates.codigo_celda_snapshot = cells[0].codigo;
      updates.tipo_celda_snapshot = cells[0].tipo;
    }
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k}=?`).join(', ');
    await cx.execute(`UPDATE movimientos SET ${sets} WHERE id=?`, [...keys.map(k=>updates[k]),id]);
    await registrarAuditoria(cx,{ operadorId, accion:'MODIFICAR', entidad:'MOVIMIENTO', entidadId:id, motivo:razon,
      anteriores:Object.fromEntries(keys.map(k=>[k,old[k]])), nuevos:updates, ...meta });
    await cx.commit();
    return { id:Number(id), ...updates };
  } catch(e) { await cx.rollback(); throw e; }
  finally { cx.release(); }
}
