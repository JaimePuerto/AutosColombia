import { Router } from 'express';
import { listarOperadores, crearOperador, cambiarEstadoOperador } from '../services/operadores.service.js';
import { requiereAutenticacion, requiereAdministrador } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

router.get('/', async (_req, res) => {
  try { res.json({ ok: true, data: await listarOperadores() }); }
  catch { res.status(500).json({ ok: false, mensaje: 'No fue posible consultar los operadores.' }); }
});

router.post('/', async (req, res) => {
  try {
    const data = await crearOperador(req.body || {});
    res.status(201).json({ ok: true, mensaje: 'Operador creado correctamente.', data });
  } catch (error) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : 400).json({ ok: false, mensaje: duplicate ? 'Ya existe un operador con ese documento.' : error.message });
  }
});

router.patch('/:id/estado', async (req, res) => {
  try {
    const data = await cambiarEstadoOperador(req.params.id, req.body?.estado, req.user.id);
    res.json({ ok: true, mensaje: 'Estado del operador actualizado.', data });
  } catch (error) {
    const status = error.message === 'El operador no existe.' ? 404 : 400;
    res.status(status).json({ ok: false, mensaje: error.message });
  }
});

export default router;
