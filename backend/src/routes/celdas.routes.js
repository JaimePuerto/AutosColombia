import { Router } from 'express';
import { requiereAutenticacion, requiereAdministrador } from '../middleware/auth.middleware.js';
import { listarCeldas, resumenCeldas, crearCelda, modificarCelda, cambiarBloqueoCelda, historialCelda } from '../services/celdas.service.js';

const router = Router();
router.use(requiereAutenticacion);

router.get('/disponibles', async (req, res) => {
  try {
    const tipo = String(req.query.tipo || '').toUpperCase();
    if (!['CARRO', 'MOTO'].includes(tipo)) return res.status(400).json({ ok: false, mensaje: 'El tipo debe ser CARRO o MOTO.' });
    const data = await listarCeldas({ tipo, estado: 'DISPONIBLE' });
    res.json({ ok: true, total: data.length, data: data.map(({ id, codigo, tipo }) => ({ id, codigo, tipo })) });
  } catch (e) { res.status(400).json({ ok: false, mensaje: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const data = await listarCeldas({ tipo: req.query.tipo, estado: req.query.estado, buscar: req.query.buscar });
    res.json({ ok: true, total: data.length, data });
  } catch (e) { res.status(400).json({ ok: false, mensaje: e.message }); }
});

router.get('/resumen', async (_req, res) => {
  try { res.json({ ok: true, data: await resumenCeldas() }); }
  catch { res.status(500).json({ ok: false, mensaje: 'No fue posible consultar el resumen de celdas.' }); }
});

router.get('/:id/historial', requiereAdministrador, async (req, res) => {
  try { res.json({ ok: true, data: await historialCelda(req.params.id) }); }
  catch { res.status(500).json({ ok: false, mensaje: 'No fue posible consultar el historial.' }); }
});

router.post('/', requiereAdministrador, async (req, res) => {
  try { const data = await crearCelda(req.body, req.user.id); res.status(201).json({ ok: true, data }); }
  catch (e) { res.status(e.code === 'ER_DUP_ENTRY' ? 409 : 400).json({ ok: false, mensaje: e.code === 'ER_DUP_ENTRY' ? 'Ya existe una celda con ese código.' : e.message }); }
});

router.put('/:id', requiereAdministrador, async (req, res) => {
  try { const data = await modificarCelda(req.params.id, req.body, req.user.id, req.body.motivo); res.json({ ok: true, data }); }
  catch (e) { res.status(e.code === 'ER_DUP_ENTRY' ? 409 : e.message === 'La celda no existe.' ? 404 : 400).json({ ok: false, mensaje: e.code === 'ER_DUP_ENTRY' ? 'Ya existe una celda con ese código.' : e.message }); }
});

router.post('/:id/bloquear', requiereAdministrador, async (req, res) => {
  try { const data = await cambiarBloqueoCelda(req.params.id, true, req.body.motivo, req.user.id); res.json({ ok: true, data }); }
  catch (e) { res.status(e.message === 'La celda no existe.' ? 404 : 400).json({ ok: false, mensaje: e.message }); }
});

router.post('/:id/desbloquear', requiereAdministrador, async (req, res) => {
  try { const data = await cambiarBloqueoCelda(req.params.id, false, req.body.motivo, req.user.id); res.json({ ok: true, data }); }
  catch (e) { res.status(e.message === 'La celda no existe.' ? 404 : 400).json({ ok: false, mensaje: e.message }); }
});

export default router;
