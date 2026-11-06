
import { Router } from "express";
import { requiereAutenticacion, requiereAdministrador } from "../middleware/auth.middleware.js";
import {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  cambiarEstadoCliente,
} from "../services/clientes.service.js";

const router = Router();
router.use(requiereAutenticacion, requiereAdministrador);

// Consultar y buscar clientes.
router.get("/", async (req, res) => {
  try {
    const data = await listarClientes({
      buscar: req.query.buscar,
      tipo: req.query.tipo,
      activo: req.query.activo,
    });

    res.json({
      ok: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Error al consultar clientes:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error al consultar los clientes.",
    });
  }
});

// Consultar un cliente por ID.
router.get("/:id", async (req, res) => {
  try {
    const data = await obtenerCliente(req.params.id);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    const estado = error.message === "El cliente no existe." ? 404 : 500;

    res.status(estado).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

// Registrar un cliente.
router.post("/", async (req, res) => {
  try {
    const data = await crearCliente(req.body);

    res.status(201).json({
      ok: true,
      mensaje: "Cliente registrado correctamente.",
      data,
    });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";

    res.status(duplicado ? 409 : 400).json({
      ok: false,
      mensaje: duplicado
        ? "Ya existe un cliente con ese tipo y número de documento."
        : error.message,
    });
  }
});

// Actualizar un cliente.
router.put("/:id", async (req, res) => {
  try {
    const data = await actualizarCliente(req.params.id, req.body);

    res.json({
      ok: true,
      mensaje: "Cliente actualizado correctamente.",
      data,
    });
  } catch (error) {
    const duplicado = error.code === "ER_DUP_ENTRY";
    const noExiste = error.message === "El cliente no existe.";

    res.status(duplicado ? 409 : noExiste ? 404 : 400).json({
      ok: false,
      mensaje: duplicado
        ? "Ya existe un cliente con ese tipo y número de documento."
        : error.message,
    });
  }
});

// Activar o desactivar un cliente.
router.patch("/:id/estado", async (req, res) => {
  try {
    const data = await cambiarEstadoCliente(
      req.params.id,
      req.body.activo
    );

    res.json({
      ok: true,
      mensaje: "Estado del cliente actualizado correctamente.",
      data,
    });
  } catch (error) {
    const noExiste = error.message === "El cliente no existe.";

    res.status(noExiste ? 404 : 400).json({
      ok: false,
      mensaje: error.message,
    });
  }
});

export default router;
