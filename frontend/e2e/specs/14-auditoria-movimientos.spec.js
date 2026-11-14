// M-11 · Auditoría: eventos ENTRADA y SALIDA de movimientos con su operador.
// M-12 · Anular y corregir movimientos desde el historial (acciones de fila del administrador).

import { capturar, db, expect, irASeccion, test } from "../support/fixtures.js";
import { CREDENCIALES } from "../support/env.js";
import {
  crearClienteConVehiculo,
  crearSuscripcionVigente,
  placaCarro,
  registrarEntradaApi,
  registrarSalidaApi,
  sesionAdmin,
  tokenAdmin,
} from "./apoyo.js";

// Crea un cliente con vehículo, suscripción VIGENTE y una entrada; devuelve placa y movimiento.
async function vehiculoConEntrada(token) {
  const creado = await crearClienteConVehiculo(token, { placa: placaCarro() });
  const vehiculo = creado.data.vehiculos[0];
  await crearSuscripcionVigente(token, vehiculo.id);
  const entrada = await registrarEntradaApi(token, vehiculo.placa, "CARRO");
  expect(entrada.status).toBe(201);
  return { placa: vehiculo.placa, movimientoId: entrada.json.data.id };
}

test("M-11 · eventos ENTRADA y SALIDA de movimientos en la auditoría", async ({ page }) => {
  const token = await tokenAdmin();
  const { placa } = await vehiculoConEntrada(token);
  const salida = await registrarSalidaApi(token, placa);
  expect(salida.status).toBe(200);

  await sesionAdmin(page);
  await irASeccion(page, "Auditoría");
  await expect(page.locator(".audit-heading h2")).toHaveText("Auditoría del sistema");

  await page.locator(".audit-filters label", { hasText: "Entidad" }).locator("input").fill("MOVIMIENTO");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  const filas = page.locator(".audit-table-wrap table tbody tr").filter({ hasText: placa });
  await expect(filas).toHaveCount(2);

  const acciones = await filas.locator("td:nth-child(4)").allInnerTexts();
  expect(acciones.map((texto) => texto.trim()).sort()).toEqual(["ENTRADA", "SALIDA"]);

  // El operador que ejecutó las operaciones queda registrado en la auditoría.
  const nombreAdmin = db().valor(`SELECT nombre FROM operadores WHERE documento='${CREDENCIALES.adminDocumento}'`);
  const usuarios = await filas.locator("td:nth-child(3)").allInnerTexts();
  expect(usuarios.map((texto) => texto.trim())).toEqual([nombreAdmin, nombreAdmin]);

  await capturar(page, "M-11_auditoria_movimientos.png");

  const base = db();
  expect(
    Number(
      base.valor(
        `SELECT COUNT(*) FROM auditoria_eventos WHERE entidad='MOVIMIENTO' AND accion IN ('ENTRADA','SALIDA') AND motivo LIKE '%${placa}%'`,
      ),
    ),
  ).toBe(2);
});

test("M-12 · corrección y anulación de un movimiento desde el historial", async ({ page }) => {
  const token = await tokenAdmin();
  const { placa, movimientoId } = await vehiculoConEntrada(token);

  await sesionAdmin(page);
  await irASeccion(page, "Historial de movimientos");

  const panel = page.locator(".history-panel");
  await panel.getByPlaceholder("Buscar por placa...").fill(placa);
  const fila = panel.locator("table.movement-table tbody tr").filter({ hasText: placa });
  await expect(fila).toHaveCount(1);

  // --- Corregir el movimiento activo: cambia el acceso de entrada sin borrar nada.
  await fila.getByRole("button", { name: "Corregir" }).click();
  const dialogoCorregir = page.getByRole("dialog", { name: `Corregir movimiento ${movimientoId}` });
  await expect(dialogoCorregir).toBeVisible();
  await dialogoCorregir
    .locator(".field", { hasText: "Acceso de entrada" })
    .locator("select")
    .selectOption("SECUNDARIO");
  await dialogoCorregir
    .locator(".field", { hasText: "Motivo de la corrección" })
    .locator("input")
    .fill("Corrección E2E del acceso de entrada registrado.");
  await dialogoCorregir.getByRole("button", { name: "Guardar corrección" }).click();

  await expect(dialogoCorregir.locator(".form-message.success")).toContainText(
    "Movimiento corregido correctamente.",
  );
  await capturar(page, "M-12a_movimiento_corregido.png");

  const base = db();
  expect(base.valor(`SELECT acceso_entrada FROM movimientos WHERE id=${movimientoId}`)).toBe("SECUNDARIO");
  expect(base.valor(`SELECT fecha_salida FROM movimientos WHERE id=${movimientoId}`)).toBe("NULL");
  expect(base.valor(`SELECT anulado_en FROM movimientos WHERE id=${movimientoId}`)).toBe("NULL");

  await dialogoCorregir.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(dialogoCorregir).toBeHidden();

  // --- Anular el movimiento indicando el motivo: el registro se conserva marcado.
  await fila.getByRole("button", { name: "Anular" }).click();
  const dialogoAnular = page.getByRole("dialog", { name: `Anular movimiento ${movimientoId}` });
  await expect(dialogoAnular).toBeVisible();
  await dialogoAnular.locator("textarea").fill("Anulación E2E del movimiento registrado.");
  await dialogoAnular.getByRole("button", { name: "Confirmar anulación" }).click();

  await expect(dialogoAnular.locator(".form-message.success")).toContainText(
    "Movimiento anulado correctamente.",
  );
  await capturar(page, "M-12b_movimiento_anulado.png");

  const anulado = base.valor(`SELECT anulado_en FROM movimientos WHERE id=${movimientoId}`);
  expect(anulado).not.toBe("NULL");
  expect(base.valor(`SELECT motivo_anulacion FROM movimientos WHERE id=${movimientoId}`)).toContain(
    "Anulación E2E",
  );
});
