import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarPlaca,
  validarPlaca,
  tipoCeldaParaVehiculo,
  tiposVehiculoParaCelda,
} from "../src/validators/placas.js";

// RF-01: carros y camionetas comparten el formato de placa de 3 letras y 3 números.
test("carro y camioneta aceptan el formato de 3 letras y 3 números", () => {
  assert.equal(validarPlaca("ABC123", "CARRO"), true);
  assert.equal(validarPlaca("abc123", "CARRO"), true);
  assert.equal(validarPlaca("ABC123", "CAMIONETA"), true);
  assert.equal(validarPlaca("abc 123", "CAMIONETA"), true);
});

test("carro y camioneta rechazan el formato de moto", () => {
  assert.equal(validarPlaca("ABC12D", "CARRO"), false);
  assert.equal(validarPlaca("ABC12D", "CAMIONETA"), false);
});

test("la moto acepta 3 letras, 2 números y una letra final", () => {
  assert.equal(validarPlaca("KLM45D", "MOTO"), true);
  assert.equal(validarPlaca("ABC123", "MOTO"), false);
});

test("un tipo de vehículo desconocido no valida ninguna placa", () => {
  assert.equal(validarPlaca("ABC123", "BICICLETA"), false);
  assert.equal(validarPlaca("ABC123", undefined), false);
});

test("la normalización elimina espacios y pasa a mayúsculas", () => {
  assert.equal(normalizarPlaca("  abc 123 "), "ABC123");
  assert.equal(normalizarPlaca(null), "");
});

// RF-01: las camionetas se ubican en celdas de tipo CARRO.
test("la camioneta usa celdas de carro", () => {
  assert.equal(tipoCeldaParaVehiculo("CAMIONETA"), "CARRO");
  assert.equal(tipoCeldaParaVehiculo("camioneta"), "CARRO");
  assert.equal(tipoCeldaParaVehiculo("CARRO"), "CARRO");
  assert.equal(tipoCeldaParaVehiculo("MOTO"), "MOTO");
});

test("una celda de carro admite carros y camionetas", () => {
  assert.deepEqual(tiposVehiculoParaCelda("CARRO"), ["CARRO", "CAMIONETA"]);
  assert.deepEqual(tiposVehiculoParaCelda("MOTO"), ["MOTO"]);
});
