import { Router } from 'express';
import {
  listarOperadores, crearOperador, actualizarOperador,
  cambiarEstadoOperador, desbloquearCuenta,
} from '../services/operadores.service.js';
import { requiereAutenticacion, requiereAdministrador } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

function estadoHttp(error, porDefecto = 400) {
  return Number.isInteger(error?.status) ? error.status : porDefecto;
}

// RF-17: filtros por documento, nombre y estado.
router.get('/', async (req, res) => {
  try {
    const data = await listarOperadores({
      documento: req.query.documento,
      nombre: req.query.nombre,
      estado: req.query.estado,
    });
    res.json({ ok: true, total: data.length, data });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: 'No fue posible consultar los operadores.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await crearOperador(req.body || {}, req.user.id);
    res.status(201).json({ ok: true, mensaje: 'Operador creado correctamente.', data });
  } catch (error) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : estadoHttp(error)).json({
      ok: false,
      mensaje: duplicate ? 'Ya existe un operador con ese documento.' : error.message,
    });
  }
});

// RF-18: modificación de operadores.
router.put('/:id', async (req, res) => {
  try {
    const data = await actualizarOperador(req.params.id, req.body || {}, req.user.id);
    res.json({ ok: true, mensaje: 'Operador actualizado correctamente.', data });
  } catch (error) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 409 : estadoHttp(error)).json({
      ok: false,
      mensaje: duplicate ? 'Ya existe un operador con ese documento o correo.' : error.message,
    });
  }
});

// RF-19/RF-20/RF-21: suspensión, desvinculación y reactivación con motivo obligatorio.
router.patch('/:id/estado', async (req, res) => {
  try {
    const data = await cambiarEstadoOperador(req.params.id, req.body?.estado, req.body?.motivo, req.user.id);
    res.json({ ok: true, mensaje: 'Estado del operador actualizado.', data });
  } catch (error) {
    res.status(estadoHttp(error, 404)).json({ ok: false, mensaje: error.message });
  }
});

// RF-13: desbloqueo de cuenta con contraseña temporal.
router.post('/:id/desbloquear', async (req, res) => {
  try {
    const data = await desbloquearCuenta(req.params.id, req.user.id);
    res.json({ ok: true, mensaje: 'Cuenta desbloqueada. Se generó una contraseña temporal.', data });
  } catch (error) {
    res.status(estadoHttp(error, 404)).json({ ok: false, mensaje: error.message });
  }
});

export default router;
