// M-18 · Recuperación de contraseña (RF-12): solicitud del enlace, respuesta genérica
//        para un documento inexistente, restablecimiento con token de un solo uso y
//        acceso con la nueva contraseña.
//
// El envío real de correo NO se declara probado: el arnés usa MAIL_PROVIDER=consola y
// lee el enlace registrado por el backend en su propio registro.

import { capturar, db, expect, test } from "../support/fixtures.js";
import {
  crearOperadorApi,
  documentoUnico,
  esperarEnlaceRecuperacion,
  tokenAdmin,
} from "./apoyo.js";

const MENSAJE_GENERICO =
  "Si los datos corresponden a una cuenta activa, enviaremos un enlace de recuperación al correo registrado.";
const MENSAJE_RESTABLECIDO = "Contraseña restablecida correctamente. Ya puedes iniciar sesión.";
const DOCUMENTO_INEXISTENTE = "9999999999";

test("M-18 · recuperación de contraseña por enlace de un solo uso", async ({ page }) => {
  test.setTimeout(120_000);

  const token = await tokenAdmin();
  const documento = documentoUnico();
  const correo = `op.${documento}@example.test`;
  await crearOperadorApi(token, { documento, email: correo, nombre: "Operador" });

  const base = db();
  const operadorId = base.valor(`SELECT id FROM operadores WHERE documento='${documento}'`);

  // --- a) Solicitud con un documento existente.
  await page.goto("/");
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar acceso" })).toBeVisible();

  const campoDocumento = page.getByLabel("Documento");
  await campoDocumento.fill(documento);
  await page.getByRole("button", { name: "Solicitar enlace" }).click();
  await expect(page.locator(".form-message")).toHaveText(MENSAJE_GENERICO);
  await capturar(page, "M-18a_solicitud_documento_existente.png");

  // --- b) Documento inexistente: misma respuesta (no revela si la cuenta existe)
  //        y sin generar token.
  await campoDocumento.fill(DOCUMENTO_INEXISTENTE);
  await page.getByRole("button", { name: "Solicitar enlace" }).click();
  await expect(page.locator(".form-message")).toHaveText(MENSAJE_GENERICO);
  await capturar(page, "M-18b_solicitud_documento_inexistente.png");

  expect(
    Number(base.valor(`SELECT COUNT(*) FROM recuperacion_password WHERE operador_id=${operadorId}`)),
  ).toBe(1);

  // --- c) Restablecimiento con el enlace de un solo uso.
  const NUEVA = "RecuperaE2E2026";
  const enlace = await esperarEnlaceRecuperacion(correo);
  await page.goto(enlace);
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();

  await page.getByLabel("Nueva contraseña").fill(NUEVA);
  await page.getByLabel("Confirmar contraseña").fill(NUEVA);
  await page.getByRole("button", { name: "Restablecer contraseña" }).click();
  await expect(page.locator(".form-message")).toHaveText(MENSAJE_RESTABLECIDO);
  await capturar(page, "M-18c_restablecimiento.png");

  expect(base.valor(`SELECT usado_en FROM recuperacion_password WHERE operador_id=${operadorId}`)).not.toBe(
    "NULL",
  );
  expect(base.valor(`SELECT password_temporal FROM operadores WHERE id=${operadorId}`)).toBe("0");

  // --- d) Acceso con la nueva contraseña.
  await page.goto("/");
  await page.getByPlaceholder("Número de documento").fill(documento);
  await page.getByPlaceholder("Tu contraseña").fill(NUEVA);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await capturar(page, "M-18d_login_con_nueva_password.png");
});
