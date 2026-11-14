// M-05 · Clientes: registro con vehículo, documento duplicado y consulta por documento.
// M-06 · Vehículos: registro, placa duplicada, cambio de titular y bloqueo del cambio de tipo.

import { capturar, db, expect, test } from "../support/fixtures.js";
import {
  crearClienteConVehiculo,
  crearSuscripcionVigente,
  documentoUnico,
  placaCarro,
  placaMoto,
  registrarEntradaApi,
  sesionAdmin,
  tokenAdmin,
} from "./apoyo.js";

async function irAClientes(page) {
  await page.locator(".nav-item", { hasText: "Gestión de clientes" }).click();
  await expect(page.locator(".page-heading h2")).toHaveText("Clientes");
}

async function irAVehiculos(page) {
  await page.locator(".nav-item", { hasText: "Gestión de vehículos" }).click();
  await expect(page.locator(".page-heading h2")).toHaveText("Vehículos");
}

// Completa el formulario de registro de cliente (incluye el bloque de vehículos).
async function llenarFormularioCliente(page, { documento, nombres, apellidos, telefono, correo, placa, tipo = "CARRO" }) {
  const dialogo = page.getByRole("dialog", { name: "Registrar cliente" });
  await expect(dialogo).toBeVisible();

  await dialogo.locator('input[name="numero_documento"]').fill(documento);
  await dialogo.locator('input[name="nombres"]').fill(nombres);
  await dialogo.locator('input[name="apellidos"]').fill(apellidos);
  await dialogo.locator('input[name="telefono"]').fill(telefono);
  await dialogo.locator('input[name="correo"]').fill(correo);

  const bloque = dialogo.locator(".vehiculos-registro");
  const fila = bloque.locator(".form-grid").first();
  await fila.locator("label.field", { hasText: "Placa" }).locator("input").fill(placa);
  await fila.locator("label.field", { hasText: "Tipo" }).locator("select").selectOption(tipo);
  await fila.locator("label.field", { hasText: "Marca" }).locator("input").fill("Marca E2E");
  await fila.locator("label.field", { hasText: "Modelo" }).locator("input").fill("Modelo E2E");
  await fila.locator("label.field", { hasText: "Color" }).locator("input").fill("Azul");
  await fila.locator("label.field", { hasText: "Año" }).locator("input").fill("2021");
  await bloque.locator('input[type="checkbox"]').check();

  return dialogo;
}

async function buscarCliente(page, documento) {
  await page.getByPlaceholder("Buscar cliente o documento...").fill(documento);
  const fila = page.locator(".history-panel table.movement-table tbody tr").filter({ hasText: documento });
  await expect(fila).toHaveCount(1);
  return fila;
}

// Selecciona en un `select` la opción que contiene un texto dado (documento del cliente).
async function seleccionarPorTexto(select, texto) {
  const opcion = select.locator("option", { hasText: texto });
  await expect(opcion).toHaveCount(1);
  await select.selectOption(await opcion.getAttribute("value"));
}

test("M-05a · registro de cliente con su vehículo", async ({ page }) => {
  await sesionAdmin(page);
  await irAClientes(page);

  const documento = documentoUnico();
  const placa = placaCarro();

  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const dialogo = await llenarFormularioCliente(page, {
    documento,
    nombres: "Cliente",
    apellidos: "Registrado",
    telefono: "3001234567",
    correo: `cliente.${documento}@example.test`,
    placa,
  });
  await dialogo.getByRole("button", { name: "Registrar cliente" }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Cliente y vehículo registrados correctamente.",
  );

  const fila = await buscarCliente(page, documento);
  await expect(fila).toContainText("Cliente Registrado");
  await expect(fila).toContainText("1");
  await capturar(page, "M-05a_cliente_registrado.png");

  const base = db();
  expect(base.contar("clientes", `numero_documento='${documento}'`)).toBe(1);
  expect(base.valor(`SELECT autorizacion_datos FROM clientes WHERE numero_documento='${documento}'`)).toBe("1");
  expect(base.contar("vehiculos", `placa='${placa}'`)).toBe(1);
});

test("M-05b · registro rechazado por documento duplicado", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  await crearClienteConVehiculo(token, { documento });

  await sesionAdmin(page);
  await irAClientes(page);

  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const dialogo = await llenarFormularioCliente(page, {
    documento,
    nombres: "Cliente",
    apellidos: "Duplicado",
    telefono: "3007654321",
    correo: `duplicado.${documento}@example.test`,
    placa: placaCarro(),
  });
  await dialogo.getByRole("button", { name: "Registrar cliente" }).click();

  await expect(dialogo.locator(".form-message.error[role='alert']")).toContainText(/Ya existe un cliente/);
  await capturar(page, "M-05b_documento_duplicado.png");

  expect(db().contar("clientes", `numero_documento='${documento}'`)).toBe(1);
});

test("M-05c · consulta de cliente por documento", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const placa = placaCarro();
  await crearClienteConVehiculo(token, {
    documento,
    placa,
    nombres: "Consultable",
    apellidos: "Documento",
  });

  await sesionAdmin(page);
  await irAClientes(page);

  await page.getByPlaceholder("Cédula, NIT o pasaporte").fill(documento);
  await page.getByRole("button", { name: "Consultar" }).click();

  const resultado = page.locator(".consulta-resultado");
  await expect(resultado).toContainText("Consultable Documento");
  await expect(resultado.locator("table.movement-table tbody tr").filter({ hasText: placa })).toHaveCount(1);
  await capturar(page, "M-05c_consulta_documento.png");
});

test("M-06a · registro de vehículo desde la gestión de vehículos", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  await crearClienteConVehiculo(token, { documento });

  await sesionAdmin(page);
  await irAVehiculos(page);

  const placa = placaCarro();
  await page.getByRole("button", { name: "Nuevo vehículo" }).click();
  const dialogo = page.getByRole("dialog", { name: "Registrar vehículo" });
  await expect(dialogo).toBeVisible();

  await dialogo.locator('select[name="tipo"]').selectOption("CARRO");
  await dialogo.locator('input[name="placa"]').fill(placa);
  await seleccionarPorTexto(dialogo.locator('select[name="cliente_id"]'), documento);
  await dialogo.locator('input[name="marca"]').fill("Mazda");
  await dialogo.locator('input[name="modelo"]').fill("CX-30");
  await dialogo.locator('input[name="color"]').fill("Rojo");
  await dialogo.locator('input[name="anio"]').fill("2022");
  await dialogo.getByRole("button", { name: "Registrar vehículo" }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Vehículo registrado correctamente.",
  );

  await page.getByPlaceholder("Buscar por placa, marca o cliente...").fill(placa);
  const fila = page.locator(".history-panel table.movement-table tbody tr").filter({ hasText: placa });
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText("Mazda CX-30");
  await capturar(page, "M-06a_vehiculo_registrado.png");

  expect(db().contar("vehiculos", `placa='${placa}'`)).toBe(1);
});

test("M-06b · registro rechazado por placa duplicada", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const placa = placaCarro();
  await crearClienteConVehiculo(token, { documento, placa });

  await sesionAdmin(page);
  await irAVehiculos(page);

  await page.getByRole("button", { name: "Nuevo vehículo" }).click();
  const dialogo = page.getByRole("dialog", { name: "Registrar vehículo" });
  await dialogo.locator('input[name="placa"]').fill(placa);
  await seleccionarPorTexto(dialogo.locator('select[name="cliente_id"]'), documento);
  await dialogo.locator('input[name="marca"]').fill("Mazda");
  await dialogo.locator('input[name="modelo"]').fill("CX-30");
  await dialogo.locator('input[name="color"]').fill("Rojo");
  await dialogo.getByRole("button", { name: "Registrar vehículo" }).click();

  await expect(dialogo.locator(".form-message.error[role='alert']")).toContainText(
    new RegExp(`La placa ${placa} ya está registrada a nombre de otro cliente|Ya existe un vehículo registrado con la placa ${placa}`),
  );
  await capturar(page, "M-06b_placa_duplicada.png");

  expect(db().contar("vehiculos", `placa='${placa}'`)).toBe(1);
});

test("M-06c · cambio de titular con trazabilidad", async ({ page }) => {
  const token = await tokenAdmin();
  const documentoOrigen = documentoUnico();
  const documentoDestino = documentoUnico();
  const placa = placaCarro();
  await crearClienteConVehiculo(token, {
    documento: documentoOrigen,
    placa,
    nombres: "Titular",
    apellidos: "Anterior",
  });
  await crearClienteConVehiculo(token, {
    documento: documentoDestino,
    nombres: "Titular",
    apellidos: "Nuevo",
  });

  await sesionAdmin(page);
  await irAVehiculos(page);
  await page.getByPlaceholder("Buscar por placa, marca o cliente...").fill(placa);
  const fila = page.locator(".history-panel table.movement-table tbody tr").filter({ hasText: placa });
  await expect(fila).toHaveCount(1);
  await fila.getByRole("button", { name: "Cambiar titular" }).click();

  const dialogo = page.getByRole("dialog", { name: `Cambiar titular del vehículo ${placa}` });
  await expect(dialogo).toBeVisible();
  await seleccionarPorTexto(dialogo.locator("select"), documentoDestino);
  await dialogo.locator("label.field", { hasText: "Motivo" }).locator("input").fill("Venta del vehículo registrada en E2E");
  await dialogo.getByRole("button", { name: "Confirmar cambio de titular" }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Titular actualizado correctamente.",
  );
  await expect(fila).toContainText("Titular Nuevo");
  await capturar(page, "M-06c_cambio_titular.png");

  const base = db();
  expect(
    base.valor(
      `SELECT c.numero_documento FROM vehiculos v INNER JOIN clientes c ON c.id = v.cliente_id WHERE v.placa='${placa}'`,
    ),
  ).toBe(documentoDestino);
  expect(
    Number(
      base.valor(
        `SELECT COUNT(*) FROM historial_titulares_vehiculo h
         INNER JOIN vehiculos v ON v.id = h.vehiculo_id WHERE v.placa='${placa}'`,
      ),
    ),
  ).toBeGreaterThanOrEqual(1);
});

test("M-06d · cambio de tipo bloqueado con movimiento activo", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const placa = placaCarro();
  const creado = await crearClienteConVehiculo(token, { documento, placa });
  const vehiculoId = creado.data.vehiculos[0].id;

  await crearSuscripcionVigente(token, vehiculoId);
  const entrada = await registrarEntradaApi(token, placa, "CARRO");
  expect(entrada.status).toBe(201);

  await sesionAdmin(page);
  await irAVehiculos(page);
  await page.getByPlaceholder("Buscar por placa, marca o cliente...").fill(placa);
  const fila = page.locator(".history-panel table.movement-table tbody tr").filter({ hasText: placa });
  await expect(fila).toHaveCount(1);
  await fila.getByRole("button", { name: "Editar" }).click();

  const dialogo = page.getByRole("dialog", { name: "Editar vehículo" });
  await expect(dialogo).toBeVisible();
  // El cambio de tipo exige que la placa cumpla el formato del nuevo tipo; se
  // ingresa una placa de moto para que la validación llegue al control de movimiento activo.
  await dialogo.locator('select[name="tipo"]').selectOption("MOTO");
  await dialogo.locator('input[name="placa"]').fill(placaMoto());
  await dialogo.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(dialogo.locator(".form-message.error[role='alert']")).toContainText(
    "No se puede cambiar el tipo del vehículo mientras tenga un movimiento activo.",
  );
  await capturar(page, "M-06d_cambio_tipo_bloqueado.png");

  expect(db().valor(`SELECT tipo FROM vehiculos WHERE placa='${placa}'`)).toBe("CARRO");
});
