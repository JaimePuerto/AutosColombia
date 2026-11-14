// Utilidades y fixtures compartidas por los escenarios E2E.
//
// Toda llamada a `localhost:3001` que haga el navegador es interceptada y redirigida al
// backend de pruebas. Si la redirección falla, la petición se aborta: nunca se permite que
// una solicitud alcance el backend real conectado a la base `autoscolombia`.

import fs from "node:fs";
import path from "node:path";
import { expect, test as base } from "@playwright/test";
import { API_ORIGIN, API_PORT, ARTIFACTS_DIR, EVIDENCE_DIR, STATE_FILE } from "./env.js";
import { contar, ejecutarSql, primerValor } from "./database.js";

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(
      (url) => url.port === "3001" && ["localhost", "127.0.0.1"].includes(url.hostname),
      async (route) => {
        const destino = new URL(route.request().url());
        destino.hostname = "127.0.0.1";
        destino.port = String(API_PORT);
        try {
          await route.continue({ url: destino.toString() });
        } catch (error) {
          console.error(`[e2e] No se pudo redirigir ${route.request().url()}: ${error.message}`);
          try { await route.abort(); } catch { /* la ruta ya fue gestionada */ }
        }
      },
    );
    await use(context);
  },
});

export { expect };

export function estado() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

// ---- API directa contra el backend de pruebas -------------------------------------------

export async function api(metodo, ruta, { token, body } = {}) {
  const respuesta = await fetch(`${API_ORIGIN}/api${ruta}`, {
    method: metodo,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await respuesta.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* respuesta sin JSON */ }
  return { status: respuesta.status, ok: respuesta.ok, json, texto };
}

export async function entrarPorApi(documento, password) {
  const { status, json } = await api("POST", "/auth/login", { body: { documento, password } });
  if (status !== 200 || !json?.ok) {
    throw new Error(`No fue posible autenticar a ${documento} por API: ${JSON.stringify(json)}`);
  }
  return json.data.token;
}

// ---- Base de datos efímera ----------------------------------------------------------------

export function db() {
  const { dbName } = estado();
  return {
    nombre: dbName,
    filas: (sql) => ejecutarSql(dbName, sql),
    valor: (sql) => primerValor(dbName, sql),
    contar: (tabla, condicion) => contar(dbName, tabla, condicion),
  };
}

// ---- Sesión en la interfaz -----------------------------------------------------------------

export async function iniciarSesionUI(page, documento, password) {
  await page.goto("/");
  await page.getByPlaceholder("Número de documento").fill(documento);
  await page.getByPlaceholder("Tu contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

export async function irASeccion(page, nombre) {
  await page.locator(".nav-item", { hasText: nombre }).click();
}

// ---- Evidencia gráfica ----------------------------------------------------------------------

export async function capturar(page, nombreArchivo) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, nombreArchivo), fullPage: true });
}

export function artefacto(nombreArchivo) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  return path.join(ARTIFACTS_DIR, nombreArchivo);
}
