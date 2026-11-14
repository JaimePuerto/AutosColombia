import test from "node:test";
import assert from "node:assert/strict";

function validarFecha(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function validarPeriodo(inicio, fin) {
  if (!validarFecha(inicio) || !validarFecha(fin)) return false;
  return fin === sumarDias(inicio, 29);
}

test("acepta un período exacto de 30 días calendario", () => {
  assert.equal(validarPeriodo("2026-11-13", "2026-12-12"), true);
});
test("rechaza un período de 29 días", () => {
  assert.equal(validarPeriodo("2026-11-13", "2026-12-11"), false);
});
test("rechaza un período de 31 días", () => {
  assert.equal(validarPeriodo("2026-11-13", "2026-12-13"), false);
});
test("rechaza fechas imposibles", () => {
  assert.equal(validarFecha("2026-02-30"), false);
});
test("calcula correctamente el siguiente día al finalizar una suscripción", () => {
  assert.equal(sumarDias("2026-12-12", 1), "2026-12-13");
});
test("respeta el cambio de año en períodos de 30 días", () => {
  assert.equal(validarPeriodo("2026-12-15", "2027-01-13"), true);
});
