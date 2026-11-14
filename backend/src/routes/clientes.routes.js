
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import {
  listarClientes,
  obtenerCliente,
  obtenerClientePorDocumento,
  registrarClienteConVehiculos,
  actualizarCliente,
  cambiarEstadoCliente,
} from "../services/clientes.service.js";

const router = Router();
// RF-22: la consulta y el registro están disponibles para administrador y operador.
router.use(requiereAutenticacion);

function estadoHttp(error, porDefecto = 400) {
  return Number.isInteger(error?.status) ? error.status : porDefecto;
}

function responderError(res, error) {
  const duplicado = error.code === "ER_DUP_ENTRY";
  res.status(duplicado ? 409 : estadoHttp(error)).json({
    ok: false,
    mensaje: duplicado
      ? "Ya existe un cliente con ese tipo y número de documento."
      : error.message,
  });
}

// Consultar y buscar clientes.
router.get("/", async (req, res) => {
  try {
    const data = await listarClientes({
      buscar: req.query.buscar,
      tipo: req.query.tipo,
      activo: req.query.activo,
    });
    res.json({ ok: true, total: data.length, data });
  } catch (error) {
    console.error("Error al consultar clientes:", error);
    res.status(500).json({ ok: false, mensaje: "Error al consultar los clientes." });
  }
});

// RF-22: consulta por documento con vehículos y estado de mensualidad.
router.get("/consulta/:documento", async (req, res) => {
  try {
    const data = await obtenerClientePorDocumento(req.params.documento);
    res.json({ ok: true, encontrado: Boolean(data), data });
  } catch (error) {
    res.status(estadoHttp(error)).json({ ok: false, mensaje: error.message });
  }
});

// Consultar un cliente por ID.
router.get("/:id", async (req, res) => {
  try {
    res.json({ ok: true, data: await obtenerCliente(req.params.id) });
  } catch (error) {
    res.status(estadoHttp(error, 500)).json({ ok: false, mensaje: error.message });
  }
});

// RF-23: registro transaccional de cliente + vehículo(s) + autorización de datos.
router.post("/registro", async (req, res) => {
  try {
    const data = await registrarClienteConVehiculos(req.body || {}, req.user.id);
    res.status(201).json({ ok: true, mensaje: "Cliente y vehículo registrados correctamente.", data });
  } catch (error) {
    responderError(res, error);
  }
});

// Compatibilidad de ruta: todas las altas usan la operación atómica de RF-23.
router.post("/", async (req, res) => {
  try {
    const data = await registrarClienteConVehiculos(req.body || {}, req.user.id);
    res.status(201).json({ ok: true, mensaje: "Cliente y vehículo registrados correctamente.", data });
  } catch (error) {
    responderError(res, error);
  }
});

// RF-25: la modificación está restringida al administrador.
router.put("/:id", requiereAdministrador, async (req, res) => {
  try {
    const data = await actualizarCliente(req.params.id, req.body, req.user.id);
    res.json({ ok: true, mensaje: "Cliente actualizado correctamente.", data });
  } catch (error) {
    responderError(res, error);
  }
});

// Activar o desactivar un cliente (administrador).
router.patch("/:id/estado", requiereAdministrador, async (req, res) => {
  try {
    const data = await cambiarEstadoCliente(req.params.id, req.body.activo, req.user.id);
    res.json({ ok: true, mensaje: "Estado del cliente actualizado correctamente.", data });
  } catch (error) {
    res.status(estadoHttp(error, 404)).json({ ok: false, mensaje: error.message });
  }
});

export default router;
