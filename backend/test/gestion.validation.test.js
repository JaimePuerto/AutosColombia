import test from "node:test";
import assert from "node:assert/strict";
import {
  validarAtributosVehiculo,
  normalizarAutorizacionDatos,
  validarDatosCliente,
  validarDatosOperador,
} from "../src/validators/gestion.js";

test("consentimiento: solo valores afirmativos explícitos son true", () => {
  for (const valor of [true, 1, "true", "TRUE", "1"]) {
    assert.equal(normalizarAutorizacionDatos(valor), true, `${String(valor)} debe autorizar`);
  }

  for (const valor of [false, 0, "false", "FALSE", "0", "", "  ", null, undefined]) {
    assert.equal(normalizarAutorizacionDatos(valor), false, `${String(valor)} no debe autorizar`);
  }

  for (const valor of ["sí", "yes", "on", 2, {}, []]) {
    assert.throws(
      () => normalizarAutorizacionDatos(valor),
      { status: 400 },
      `${String(valor)} debe rechazarse como ambiguo`,
    );
  }
});

test("operador: exige nombres, apellidos, documento, correo y teléfono", () => {
  const completo = {
    nombre: "Ana", apellidos: "Prueba", documento: "123",
    email: "ana@example.test", telefono: "3001234567",
  };
  assert.deepEqual(validarDatosOperador(completo), completo);

  for (const campo of Object.keys(completo)) {
    assert.throws(
      () => validarDatosOperador({ ...completo, [campo]: "  " }),
      { status: 400 },
      `${campo} no debe quedar vacío`,
    );
  }
  assert.throws(
    () => validarDatosOperador({ ...completo, email: "correo-invalido" }),
    { status: 400 },
  );
});

test("cliente persona: normaliza y compone el nombre visible desde campos separados", () => {
  const cliente = validarDatosCliente({
    tipo_cliente: "PERSONA",
    tipo_documento: "cc",
    numero_documento: " 100 ",
    nombres: " Ana María ",
    apellidos: " Prueba ",
    correo: "ana@example.test",
    telefono: "3001234567",
  });

  assert.equal(cliente.tipo_documento, "CC");
  assert.equal(cliente.numero_documento, "100");
  assert.equal(cliente.nombres, "Ana María");
  assert.equal(cliente.apellidos, "Prueba");
  assert.equal(cliente.nombre_razon_social, "Ana María Prueba");
});

test("cliente empresa: mantiene razón social y contacto separados", () => {
  const cliente = validarDatosCliente({
    tipo_cliente: "EMPRESA",
    tipo_documento: "NIT",
    numero_documento: "900123",
    nombre_razon_social: "Empresa de Prueba SAS",
    nombres: "Luisa",
    apellidos: "Contacto",
    correo: "contacto@example.test",
    telefono: "3001234567",
  });

  assert.equal(cliente.nombre_razon_social, "Empresa de Prueba SAS");
  assert.equal(cliente.nombres, "Luisa");
  assert.equal(cliente.apellidos, "Contacto");
});

test("cliente y vehículo: rechaza cada dato obligatorio vacío", () => {
  const cliente = {
    tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "100",
    nombres: "Ana", apellidos: "Prueba", correo: "ana@example.test", telefono: "3001234567",
  };
  for (const campo of Object.keys(cliente)) {
    assert.throws(
      () => validarDatosCliente({ ...cliente, [campo]: "" }),
      { status: 400 },
      `${campo} no debe quedar vacío`,
    );
  }

  const vehiculo = { marca: "Marca", modelo: "Modelo", color: "Azul" };
  assert.deepEqual(validarAtributosVehiculo(vehiculo), vehiculo);
  for (const campo of Object.keys(vehiculo)) {
    assert.throws(
      () => validarAtributosVehiculo({ ...vehiculo, [campo]: " " }),
      { status: 400 },
      `${campo} no debe quedar vacío`,
    );
  }
});
