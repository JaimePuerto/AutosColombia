import { Router } from 'express';
import { requiereAutenticacion, requiereAdministrador } from '../middleware/auth.middleware.js';
import { anularMovimiento, modificarMovimiento } from '../services/movimientos.admin.service.js';

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

router.post('/:id/anular', async (req,res) => {
  try {
    const data = await anularMovimiento(req.params.id, req.body?.motivo, req.user.id, {
      ip:req.ip, userAgent:req.get('user-agent')
    });
    res.json({ ok:true, mensaje:'Movimiento anulado correctamente.', data });
  } catch(e) {
    const status = e.message === 'El movimiento no existe.' ? 404 : 400;
    res.status(status).json({ ok:false, mensaje:e.message });
  }
});

router.patch('/:id/corregir', async (req,res) => {
  try {
    const data = await modificarMovimiento(req.params.id, req.body || {}, req.body?.motivo, req.user.id, {
      ip:req.ip, userAgent:req.get('user-agent')
    });
    res.json({ ok:true, mensaje:'Movimiento actualizado correctamente.', data });
  } catch(e) {
    const status = e.message === 'El movimiento no existe.' ? 404 : 400;
    res.status(status).json({ ok:false, mensaje:e.message });
  }
});
export default router;
