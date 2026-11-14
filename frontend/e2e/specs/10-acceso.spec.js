// M-01 · Recorrido por las secciones principales.
// M-02 · Inicio de sesión con credenciales inválidas y válidas.
// M-03 · Bloqueo automático de la cuenta tras cinco intentos fallidos.
//
// Todos los escenarios se ejecutan contra la interfaz servida por el arnés y
// verifican el efecto en la base efímera `autoscolombia_e2e_<pid>`.

import { capturar, db, expect, test } from "../support/fixtures.js";
import { CREDENCIALES } from "../support/env.js";
import { crearOperadorApi, documentoUnico, sesionAdmin, tokenAdmin } from "./apoyo.js";

// Secciones visibles para el perfil administrador (10 elementos de menú).
const SECCIONES = [
  "Panel principal",
  "Ingreso de vehículos",
  "Salida de vehículos",
  "Historial de movimientos",
  "Gestión de clientes",
  "Gestión de vehículos",
  "Gestión de usuarios",
  "Auditoría",
  "Gestión de celdas",
  "Suscripciones",
];

test("M-01 · recorrido por las secciones principales", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error" && !/favicon/i.test(mensaje.text())) errores.push(mensaje.text());
  });

  await sesionAdmin(page);

  // El menú real del administrador expone diez secciones.
  await expect(page.locator(".nav-item")).toHaveCount(SECCIONES.length);

  for (const seccion of SECCIONES) {
    await page.locator(".nav-item", { hasText: seccion }).click();
    await expect(page.locator(".breadcrumb strong")).toHaveText(seccion);
    await expect(page.locator(".page-content")).toBeVisible();
  }

  // Vuelve al panel principal para dejar la captura en el estado inicial.
  await page.locator(".nav-item", { hasText: "Panel principal" }).click();
  await expect(page.locator(".breadcrumb strong")).toHaveText("Panel principal");
  await capturar(page, "M-01_recorrido_secciones.png");

  expect(errores, `Errores de consola durante el recorrido: ${errores.join(" | ")}`).toEqual([]);
});

test("M-02 · inicio de sesión inválido y válido", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("Número de documento").fill(CREDENCIALES.adminDocumento);
  await page.getByPlaceholder("Tu contraseña").fill("ClaveErronea2026");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  const alerta = page.locator(".form-message.error[role='alert']");
  await expect(alerta).toContainText(
    "No fue posible iniciar sesión. Verifica tus credenciales o el estado de tu cuenta.",
  );
  await capturar(page, "M-02a_login_invalido.png");

  // Un intento fallido incrementa el contador en la base efímera.
  const base = db();
  expect(
    base.valor(`SELECT intentos_fallidos FROM operadores WHERE documento='${CREDENCIALES.adminDocumento}'`),
  ).toBe("1");

  await page.getByPlaceholder("Tu contraseña").fill(CREDENCIALES.adminPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".user-menu-trigger")).toContainText("Administrador");
  await capturar(page, "M-02b_login_valido.png");

  // El ingreso exitoso reinicia el contador de intentos.
  expect(
    base.valor(`SELECT intentos_fallidos FROM operadores WHERE documento='${CREDENCIALES.adminDocumento}'`),
  ).toBe("0");
});

test("M-03 · bloqueo de la cuenta tras cinco intentos fallidos", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const password = "Bloqueo2026";
  await crearOperadorApi(token, { documento, password, nombre: "Cuenta", apellidos: "Bloqueo" });

  for (let intento = 1; intento <= 5; intento += 1) {
    await page.goto("/");
    await page.getByPlaceholder("Número de documento").fill(documento);
    await page.getByPlaceholder("Tu contraseña").fill(`Erronea${intento}Clave2026`);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator(".form-message.error[role='alert']")).toContainText(
      "No fue posible iniciar sesión.",
    );
  }

  const base = db();
  expect(base.valor(`SELECT bloqueado FROM operadores WHERE documento='${documento}'`)).toBe("1");
  expect(base.valor(`SELECT intentos_fallidos FROM operadores WHERE documento='${documento}'`)).toBe("5");
  expect(
    Number(
      base.valor(
        `SELECT COUNT(*) FROM auditoria_autenticacion
         WHERE accion='CUENTA_BLOQUEADA' AND documento_intentado='${documento}'`,
      ),
    ),
  ).toBe(1);

  // Aun con la contraseña correcta, la cuenta bloqueada no permite el acceso.
  await page.goto("/");
  await page.getByPlaceholder("Número de documento").fill(documento);
  await page.getByPlaceholder("Tu contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator(".form-message.error[role='alert']")).toContainText(
    "No fue posible iniciar sesión.",
  );
  await capturar(page, "M-03_cuenta_bloqueada.png");
});
