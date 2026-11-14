
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import {
  listarVehiculos,
  obtenerVehiculo,
  crearVehiculo,
  actualizarVehiculo,
  cambiarEstadoVehiculo,
  cambiarTitular,
  historialTitulares,
} from "../services/vehiculos.service.js";

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

function estadoHttp(error, porDefecto = 400) {
  return Number.isInteger(error?.status) ? error.status : porDefecto;
}

// Consultar y filtrar vehículos.
router.get("/", async (req, res) => {
  try {
    const data = await listarVehiculos({
      buscar: req.query.buscar,
      cliente_id: req.query.cliente_id,
      activo: req.query.activo,
      tipo: req.query.tipo,
    });
    res.json({ ok: true, total: data.length, data });
  } catch (error) {
    console.error("Error al consultar vehículos:", error);
    res.status(500).json({ ok: false, mensaje: "Error al consultar los vehículos." });
  }
});

// Consultar un vehículo por ID.
router.get("/:id", async (req, res) => {
  try {
    res.json({ ok: true, data: await obtenerVehiculo(req.params.id) });
  } catch (error) {
    res.status(estadoHttp(error, 500)).json({ ok: false, mensaje: error.message });
  }
});

// RF-27: historial de titulares del vehículo.
router.get("/:id/titulares", async (req, res) => {
  try {
    res.json({ ok: true, data: await historialTitulares(req.params.id) });
  } catch (error) {
    res.status(estadoHttp(error, 500)).json({ ok: false, mensaje: error.message });
  }
});

// Registrar un vehículo.
router.post("/", async (req, res) => {
  try {
    const data = await crearVehiculo(req.body, req.user.id);
    res.status(201).json({ ok: true, mensaje: "Vehículo registrado correctamente.", data });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";
    res.status(duplicado ? 409 : estadoHttp(error)).json({
      ok: false,
      mensaje: duplicado ? "Ya existe un vehículo registrado con esa placa." : error.message,
    });
  }
});

// Actualizar un vehículo.
router.put("/:id", async (req, res) => {
  try {
    const data = await actualizarVehiculo(req.params.id, req.body, req.user.id);
    res.json({ ok: true, mensaje: "Vehículo actualizado correctamente.", data });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";
    res.status(duplicado ? 409 : estadoHttp(error)).json({
      ok: false,
      mensaje: duplicado ? "Ya existe un vehículo registrado con esa placa." : error.message,
    });
  }
});

// RF-27: cambio de titular (procedimiento administrativo).
router.post("/:id/cambiar-titular", async (req, res) => {
  try {
    const data = await cambiarTitular(req.params.id, req.body || {}, req.user.id);
    res.json({ ok: true, mensaje: "Cambio de titular registrado correctamente.", data });
  } catch (error) {
    res.status(estadoHttp(error)).json({ ok: false, mensaje: error.message });
  }
});

// Activar o desactivar un vehículo.
router.patch("/:id/estado", async (req, res) => {
  try {
    const data = await cambiarEstadoVehiculo(req.params.id, req.body.activo, req.user.id);
    res.json({ ok: true, mensaje: "Estado del vehículo actualizado correctamente.", data });
  } catch (error) {
    res.status(estadoHttp(error, 404)).json({ ok: false, mensaje: error.message });
  }
});

export default router;
