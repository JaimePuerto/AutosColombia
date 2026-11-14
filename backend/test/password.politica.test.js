import test from "node:test";
import assert from "node:assert/strict";
import {
  validarPoliticaPassword,
  generarPasswordTemporal,
  LONGITUD_MINIMA_PASSWORD,
} from "../src/validators/password.js";

// RNF-04 / RF-10: política de contraseñas.
test("acepta una contraseña que cumple la política", () => {
  assert.equal(validarPoliticaPassword("ClaveSegura2026"), true);
});

test("rechaza una contraseña sin números", () => {
  assert.throws(() => validarPoliticaPassword("SoloLetrasAqui"), /letra y un número/);
});

test("rechaza una contraseña sin letras", () => {
  assert.throws(() => validarPoliticaPassword("1234567890"), /letra y un número/);
});

test("rechaza una contraseña con espacios", () => {
  assert.throws(() => validarPoliticaPassword("Clave 2026Segura"), /no debe contener espacios/);
});

test("rechaza un valor que no es texto", () => {
  assert.throws(() => validarPoliticaPassword(null), /al menos 10 caracteres/);
});

// RF-11: la contraseña temporal generada siempre cumple la política.
test("la contraseña temporal cumple la política y la longitud pedida", () => {
  for (let i = 0; i < 25; i += 1) {
    const temporal = generarPasswordTemporal(12);
    assert.equal(temporal.length, 12);
    assert.equal(validarPoliticaPassword(temporal), true);
  }
  assert.equal(generarPasswordTemporal(16).length, 16);
  assert.ok(LONGITUD_MINIMA_PASSWORD >= 10);
});
