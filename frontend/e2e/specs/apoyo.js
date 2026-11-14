// Utilidades compartidas por los escenarios M-01…M-18.
//
// Este archivo NO es un spec (no termina en `.spec.js`): Playwright no lo ejecuta
// como prueba, solo lo importan los specs del directorio.
//
// Todas las operaciones se realizan contra el backend de pruebas del arnés
// (puerto aislado) y la base efímera `autoscolombia_e2e_<pid>`.

import fs from "node:fs";
import { api, expect, iniciarSesionUI } from "../support/fixtures.js";
import { BACKEND_LOG, CREDENCIALES } from "../support/env.js";

// ---- Datos únicos por escenario ------------------------------------------------------------

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function letras(cantidad) {
  let salida = "";
  for (let i = 0; i < cantidad; i += 1) salida += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return salida;
}

function digitos(cantidad) {
  let salida = "";
  for (let i = 0; i < cantidad; i += 1) salida += Math.floor(Math.random() * 10);
  return salida;
}

export function placaCarro() {
  return `${letras(3)}${digitos(3)}`;
}

export function placaMoto() {
  return `${letras(3)}${digitos(2)}${letras(1)}`;
}

export function documentoUnico() {
  return `9${digitos(9)}`;
}

export function fechaHoy() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

export function sumarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// ---- Sesión ---------------------------------------------------------------------------------

export async function sesionAdmin(page) {
  await iniciarSesionUI(page, CREDENCIALES.adminDocumento, CREDENCIALES.adminPassword);
  await expect(page.locator(".sidebar")).toBeVisible();
}

export async function cerrarSesionUI(page) {
  await page.locator(".user-menu-trigger").click();
  await page.getByRole("menuitem", { name: /Cerrar sesión/ }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
}

export function tokenAdmin() {
  return entrarAdmin();
}

async function entrarAdmin() {
  const { entrarPorApi } = await import("../support/fixtures.js");
  return entrarPorApi(CREDENCIALES.adminDocumento, CREDENCIALES.adminPassword);
}

// ---- Creación de datos por API (soporte de la interfaz) -------------------------------------

export async function crearClienteConVehiculo(token, {
  documento = documentoUnico(),
  placa = placaCarro(),
  tipo = "CARRO",
  nombres = "Cliente",
  apellidos = "Automatico",
} = {}) {
  const respuesta = await api("POST", "/clientes/registro", {
    token,
    body: {
      cliente: {
        tipo_cliente: "PERSONA",
        tipo_documento: "CC",
        numero_documento: documento,
        nombres,
        apellidos,
        telefono: "3001234567",
        correo: `cliente.${documento}@example.test`,
        direccion: "Calle 1 # 2-3",
      },
      vehiculos: [{ placa, tipo, marca: "Marca E2E", modelo: "Modelo E2E", color: "Gris", anio: 2020 }],
      autorizacion: true,
    },
  });
  if (respuesta.status !== 201) {
    throw new Error(`No fue posible crear el cliente ${documento}: ${respuesta.texto}`);
  }
  return respuesta.json;
}

export async function crearOperadorApi(token, {
  documento = documentoUnico(),
  password,
  rol = "OPERADOR",
  nombre = "Operador",
  apellidos = "Automatico",
  telefono = "3005556677",
  email,
} = {}) {
  const respuesta = await api("POST", "/operadores", {
    token,
    body: {
      nombre,
      apellidos,
      documento,
      email: email || `op.${documento}@example.test`,
      telefono,
      rol,
      ...(password ? { password } : {}),
    },
  });
  if (respuesta.status !== 201) {
    throw new Error(`No fue posible crear el operador ${documento}: ${respuesta.texto}`);
  }
  return respuesta.json;
}

export async function entrarOperadorApi(documento, password) {
  const { entrarPorApi } = await import("../support/fixtures.js");
  return entrarPorApi(documento, password);
}

export async function crearSuscripcionVigente(token, vehiculoId) {
  const hoy = fechaHoy();
  const creada = await api("POST", "/suscripciones", {
    token,
    body: { vehiculo_id: vehiculoId, valor: 120000, fecha_inicio: hoy, fecha_fin: sumarDias(hoy, 29) },
  });
  if (creada.status !== 201) {
    throw new Error(`No fue posible crear la suscripción del vehículo ${vehiculoId}: ${creada.texto}`);
  }
  const id = creada.json.data.id;
  const activada = await api("PATCH", `/suscripciones/${id}/estado`, { token, body: { estado: "VIGENTE" } });
  if (activada.status !== 200) {
    throw new Error(`No fue posible activar la suscripción ${id}: ${activada.texto}`);
  }
  return id;
}

export async function registrarEntradaApi(token, placa, tipo = "CARRO") {
  return api("POST", "/movimientos/entrada", { token, body: { placa, tipo, acceso: "PRINCIPAL" } });
}

export async function registrarSalidaApi(token, placa) {
  return api("POST", "/movimientos/salida", { token, body: { placa, acceso: "PRINCIPAL" } });
}

// ---- Esperas --------------------------------------------------------------------------------

export async function esperarEstadoSuscripcion(id, estadoEsperado, milisegundosMaximos = 130000) {
  const limite = Date.now() + milisegundosMaximos;
  const { db } = await import("../support/fixtures.js");
  let ultimo = null;
  while (Date.now() < limite) {
    ultimo = db().valor(`SELECT estado FROM suscripciones WHERE id=${id}`);
    if (ultimo === estadoEsperado) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`La suscripción ${id} quedó en estado ${ultimo} y no alcanzó ${estadoEsperado}.`);
}

// Lee el enlace de recuperación registrado en modo consola por el backend de pruebas.
export async function esperarEnlaceRecuperacion(marcador, milisegundosMaximos = 15000) {
  const limite = Date.now() + milisegundosMaximos;
  while (Date.now() < limite) {
    if (fs.existsSync(BACKEND_LOG)) {
      const contenido = fs.readFileSync(BACKEND_LOG, "utf8");
      const linea = contenido
        .split(/\r?\n/)
        .reverse()
        .find((item) => item.includes("[correo:simulado]") && item.includes(marcador));
      if (linea) {
        const coincidencia = linea.match(/Enlace:\s*(\S+)/);
        if (coincidencia) return coincidencia[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("No se encontró el enlace de recuperación en el registro del backend.");
}
