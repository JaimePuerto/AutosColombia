// Escenario de humo: valida que el arnés aísla correctamente la base y la API
// antes de ejecutar los escenarios M-01…M-18.

import { test, expect, api, db, entrarPorApi, iniciarSesionUI } from "../support/fixtures.js";
import { CREDENCIALES } from "../support/env.js";

test("humo: la base efímera tiene los usuarios sembrados y no es la base real", () => {
  const base = db();
  expect(base.nombre).toMatch(/^autoscolombia_e2e_\d+$/);
  expect(base.contar("operadores")).toBe(2);
  expect(base.contar("celdas")).toBeGreaterThan(0);
});

test("humo: el backend de pruebas responde y la API real no se consulta", async () => {
  const respuesta = await api("GET", "/health");
  expect(respuesta.status).toBe(200);
  expect(respuesta.json.ok).toBe(true);

  const token = await entrarPorApi(CREDENCIALES.adminDocumento, CREDENCIALES.adminPassword);
  expect(token).toBeTruthy();

  const sinToken = await api("GET", "/movimientos");
  expect(sinToken.status).toBe(401);
});

test("humo: inicio de sesión por la interfaz contra el backend de pruebas", async ({ page }) => {
  await iniciarSesionUI(page, CREDENCIALES.adminDocumento, CREDENCIALES.adminPassword);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".user-menu-trigger")).toContainText("Administrador");
});
