import { Router } from 'express';
import { requiereAutenticacion, requiereAdministrador } from '../middleware/auth.middleware.js';
import { consultarAuditoria } from '../services/auditoria.service.js';

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

router.get('/', async (req, res) => {
  try {
    const data = await consultarAuditoria({
      usuario: req.query.usuario,
      desde: req.query.desde,
      hasta: req.query.hasta,
      accion: req.query.accion,
      entidad: req.query.entidad,
      tipo: req.query.tipo,
      limite: req.query.limite,
    });
    res.json({ ok: true, total: data.length, data });
  } catch (error) {
    console.error('Error consultando auditoría:', error);
    res.status(500).json({ ok: false, mensaje: 'No fue posible consultar la auditoría.' });
  }
});

export default router;
