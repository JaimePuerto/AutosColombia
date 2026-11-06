
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import {
  listarVehiculos,
  obtenerVehiculo,
  crearVehiculo,
  actualizarVehiculo,
  cambiarEstadoVehiculo,
} from "../services/vehiculos.service.js";

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

// Consultar y filtrar vehículos.
router.get("/", async (req, res) => {
  try {
    const data = await listarVehiculos({
      buscar: req.query.buscar,
      cliente_id: req.query.cliente_id,
      activo: req.query.activo,
    });

    res.json({
      ok: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Error al consultar vehículos:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar los vehículos.",
    });
  }
});

// Consultar un vehículo por ID.
router.get("/:id", async (req, res) => {
  try {
    const data = await obtenerVehiculo(req.params.id);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    const estado = error.message === "El vehículo no existe." ? 404 : 500;

    res.status(estado).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// Registrar un vehículo.
router.post("/", async (req, res) => {
  try {
    const data = await crearVehiculo(req.body);

    res.status(201).json({
      ok: true,
      mensaje: "Vehículo registrado correctamente.",
      data,
    });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";

    res.status(duplicado ? 409 : 400).json({
      ok: false,
      mensaje: duplicado
        ? "Ya existe un vehículo registrado con esa placa."
        : error.message,
    });
  }
});

// Actualizar un vehículo.
router.put("/:id", async (req, res) => {
  try {
    const data = await actualizarVehiculo(req.params.id, req.body);

    res.json({
      ok: true,
      mensaje: "Vehículo actualizado correctamente.",
      data,
    });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";
    const noExiste = error.message === "El vehículo no existe.";

    res.status(duplicado ? 409 : noExiste ? 404 : 400).json({
      ok: false,
      mensaje: duplicado
        ? "Ya existe un vehículo registrado con esa placa."
        : error.message,
    });
  }
});

// Activar o desactivar un vehículo.
router.patch("/:id/estado", async (req, res) => {
  try {
    const data = await cambiarEstadoVehiculo(
      req.params.id,
      req.body.activo
    );

    res.json({
      ok: true,
      mensaje: "Estado del vehículo actualizado correctamente.",
      data,
    });
  } catch (error) {
    const noExiste = error.message === "El vehículo no existe.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

export default router;
