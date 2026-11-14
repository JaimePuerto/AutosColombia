
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import {
  listarSuscripciones,
  obtenerSuscripcion,
  obtenerSuscripcionPorPlaca,
  crearSuscripcion,
  cambiarEstadoSuscripcion,
  modificarFechaActivacion,
} from "../services/suscripciones.service.js";

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

// Consultar y filtrar suscripciones.
router.get("/", async (req, res) => {
  try {
    const data = await listarSuscripciones({
      buscar: req.query.buscar,
      vehiculo_id: req.query.vehiculo_id,
      estado: req.query.estado,
    });

    res.json({
      ok: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Error al consultar suscripciones:", error);

    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// Consultar suscripción de un vehículo por placa.
router.get("/vehiculo/:placa", async (req, res) => {
  try {
    const data = await obtenerSuscripcionPorPlaca(
      req.params.placa
    );

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    const noExiste = error.message ===
      "El vehículo no tiene una suscripción registrada.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// Consultar suscripción por ID.
router.get("/:id", async (req, res) => {
  try {
    const data = await obtenerSuscripcion(req.params.id);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    const noExiste = error.message ===
      "La suscripción no existe.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// Registrar una suscripción.
router.post("/", async (req, res) => {
  try {
    const data = await crearSuscripcion(req.body, req.user.id);

    res.status(201).json({
      ok: true,
      mensaje: "Suscripción registrada correctamente.",
      data,
    });
  } catch (error) {
    const duplicada = error.code === "ER_DUP_ENTRY";

    res.status(duplicada ? 409 : 400).json({
      ok: false,
      mensaje: duplicada
        ? "No se pudo registrar la suscripción por una restricción de unicidad. Verifica el período y los índices de la base de datos."
        : error.message,
    });
  }
});

// Cambiar estado de una suscripción.
router.patch("/:id/estado", async (req, res) => {
  try {
    const data = await cambiarEstadoSuscripcion(req.params.id, req.body.estado, req.user.id, req.body.motivo);

    res.json({
      ok: true,
      mensaje: "Estado de la suscripción actualizado correctamente.",
      data,
    });
  } catch (error) {
    const noExiste = error.message ===
      "La suscripción no existe.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// RF-29: modificar la fecha de activación de una mensualidad.
router.patch("/:id/fecha-activacion", async (req, res) => {
  try {
    const data = await modificarFechaActivacion(req.params.id, req.body || {}, req.user.id);

    res.json({
      ok: true,
      mensaje: "Fecha de activación actualizada correctamente.",
      data,
    });
  } catch (error) {
    const noExiste = error.message === "La suscripción no existe.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

export default router;
