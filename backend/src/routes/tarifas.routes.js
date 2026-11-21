import { Router } from "express";
import {
  listarTiposVehiculo,
  listarTarifas,
  crearTarifa,
  actualizarTarifa,
  cambiarEstadoTarifa
} from "../services/tarifas.service.js";

import {
  requiereAutenticacion,
  requiereAdministrador
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(requiereAutenticacion, requiereAdministrador);

// Consultar tipos de vehículo.
router.get("/tipos-vehiculo", async (req, res) => {
  try {
    const data = await listarTiposVehiculo();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

// Listar tarifas.
router.get("/", async (req, res) => {
  try {
    const data = await listarTarifas();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

// Crear tarifa.
router.post("/", async (req, res) => {
  try {
    const data = await crearTarifa(req.body, req.user.id);
    res.status(201).json({
      ok: true,
      mensaje: "Tarifa creada correctamente.",
      data
    });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

// Actualizar tarifa.
router.put("/:id", async (req, res) => {
  try {
    const data = await actualizarTarifa(
      req.params.id,
      req.body,
      req.user.id
    );

    res.json({
      ok: true,
      mensaje: "Tarifa actualizada correctamente.",
      data
    });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

// Activar o inactivar tarifa.
router.patch("/:id/estado", async (req, res) => {
  try {
    const data = await cambiarEstadoTarifa(
      req.params.id,
      req.body.estado,
      req.user.id
    );

    res.json({
      ok: true,
      mensaje: "Estado de la tarifa actualizado correctamente.",
      data
    });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  }
});

export default router;
