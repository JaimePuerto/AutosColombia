import test from "node:test";
import assert from "node:assert/strict";
import { condicionEstadoMovimiento } from "../src/services/movimientos.service.js";

test("sin estado devuelve null (no aplica filtro)", () => {
  assert.equal(condicionEstadoMovimiento(undefined), null);
  assert.equal(condicionEstadoMovimiento(null), null);
  assert.equal(condicionEstadoMovimiento(""), null);
  assert.equal(condicionEstadoMovimiento("   "), null);
});

test("el estado TODOS no aplica filtro", () => {
  assert.equal(condicionEstadoMovimiento("TODOS"), null);
  assert.equal(condicionEstadoMovimiento("todos"), null);
});

test("activos exige movimiento sin salida y no anulado", () => {
  const condicion = condicionEstadoMovimiento("ACTIVOS");
  assert.match(condicion, /fecha_salida IS NULL/);
  assert.match(condicion, /anulado_en IS NULL/);
});

test("finalizados exige movimiento con salida y no anulado", () => {
  const condicion = condicionEstadoMovimiento("FINALIZADOS");
  assert.match(condicion, /fecha_salida IS NOT NULL/);
  assert.match(condicion, /anulado_en IS NULL/);
});

test("anulados exige marca de anulación", () => {
  const condicion = condicionEstadoMovimiento("ANULADOS");
  assert.match(condicion, /anulado_en IS NOT NULL/);
});

test("acepta el estado en minúsculas", () => {
  assert.match(condicionEstadoMovimiento("activo"), /fecha_salida IS NULL/);
});

test("rechaza un estado desconocido", () => {
  assert.throws(() => condicionEstadoMovimiento("DESCONOCIDO"), /no es válido/);
});
