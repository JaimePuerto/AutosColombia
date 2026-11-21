import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import { registrarPago, listarPagos, obtenerPago, anularPago } from "../services/pagos.service.js";

const router = Router();
router.use(requiereAutenticacion);

router.get("/", async (req, res) => {
  try {
    const data = await listarPagos({
      documento: req.query.documento, placa: req.query.placa,
      estado: req.query.estado, desde: req.query.desde, hasta: req.query.hasta,
      limite: req.query.limite,
    });
    res.json({ ok: true, total: data.length, data });
  } catch (error) { res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

router.post("/", async (req, res) => {
  try {
    const data = await registrarPago(req.body || {}, req.user.id);
    res.status(201).json({ ok: true, mensaje: "Pago aprobado y registrado correctamente.", data });
  } catch (error) { res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

router.get("/:id/comprobante", async (req, res) => {
  try { res.json({ ok: true, data: await obtenerPago(req.params.id) }); }
  catch (error) { res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

router.patch("/:id/anular", requiereAdministrador, async (req, res) => {
  try {
    const data = await anularPago(req.params.id, req.body?.motivo, req.user.id);
    res.json({ ok: true, mensaje: "Pago anulado y conservado en el historial.", data });
  } catch (error) { res.status(error.status || 400).json({ ok: false, mensaje: error.message }); }
});

export default router;
