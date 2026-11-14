// M-13 · Gestión de celdas: crear, modificar la ubicación, bloquear con motivo,
//        desbloquear y consultar el historial con valores anterior y nuevo.
// M-14 · Suscripciones: alta de 30 días, solapamiento rechazado, cambio de la fecha
//        de activación y paso a VENCIDA por la sincronización automática del backend.

import { capturar, db, expect, irASeccion, test } from "../support/fixtures.js";
import {
  crearClienteConVehiculo,
  esperarEstadoSuscripcion,
  fechaHoy,
  placaCarro,
  sesionAdmin,
  sumarDias,
  tokenAdmin,
} from "./apoyo.js";

test("M-13 · gestión de celdas con historial y valores anterior/nuevo", async ({ page }) => {
  const codigo = "Z99";

  await sesionAdmin(page);
  await irASeccion(page, "Gestión de celdas");
  await expect(page.locator(".page-heading h2")).toHaveText("Gestión de celdas");

  const panel = page.locator(".history-panel");
  const buscar = panel.getByPlaceholder("Buscar código o ubicación...");
  const fila = panel.locator("table.movement-table tbody tr").filter({ hasText: codigo });

  // --- a) Crear la celda.
  await page.getByRole("button", { name: "Nueva celda" }).click();
  const dialogoCrear = page.getByRole("dialog", { name: "Registrar celda" });
  await expect(dialogoCrear).toBeVisible();
  await dialogoCrear.locator('input[name="codigo"]').fill(codigo);
  await dialogoCrear.locator('select[name="tipo"]').selectOption("CARRO");
  await dialogoCrear.locator('input[name="ubicacion"]').fill("Zona E2E");
  await dialogoCrear.getByRole("button", { name: "Registrar celda" }).click();

  await expect(page.locator(".form-message")).toContainText("Celda creada correctamente.");
  await capturar(page, "M-13a_celda_creada.png");

  await buscar.fill(codigo);
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText("DISPONIBLE");

  const base = db();
  const celdaId = base.valor(`SELECT id FROM celdas WHERE codigo='${codigo}'`);

  // --- b) Modificar la ubicación.
  await fila.getByRole("button", { name: "Editar", exact: true }).click();
  const dialogoEditar = page.getByRole("dialog", { name: "Editar celda" });
  await expect(dialogoEditar).toBeVisible();
  await dialogoEditar.locator('input[name="ubicacion"]').fill("Zona E2E modificada");
  await dialogoEditar.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.locator(".form-message")).toContainText("Celda actualizada correctamente.");
  await capturar(page, "M-13b_celda_modificada.png");

  // --- c) Bloquear con motivo.
  await fila.getByRole("button", { name: "Bloquear", exact: true }).click();
  const dialogoBloquear = page.getByRole("dialog", { name: `Bloquear celda ${codigo}` });
  await expect(dialogoBloquear).toBeVisible();
  await dialogoBloquear.locator("textarea").fill("Bloqueo E2E por mantenimiento programado.");
  await dialogoBloquear.getByRole("button", { name: "Confirmar operación" }).click();

  await expect(page.locator(".form-message")).toContainText("Celda bloqueada correctamente.");
  await expect(fila).toContainText("BLOQUEADA");
  await capturar(page, "M-13c_celda_bloqueada.png");

  // --- d) Desbloquear.
  await fila.getByRole("button", { name: "Desbloquear", exact: true }).click();
  const dialogoDesbloquear = page.getByRole("dialog", { name: `Desbloquear celda ${codigo}` });
  await expect(dialogoDesbloquear).toBeVisible();
  await dialogoDesbloquear.locator("textarea").fill("Fin del mantenimiento programado en E2E.");
  await dialogoDesbloquear.getByRole("button", { name: "Confirmar operación" }).click();

  await expect(page.locator(".form-message")).toContainText("Celda desbloqueada correctamente.");
  await expect(fila).toContainText("DISPONIBLE");
  await capturar(page, "M-13d_celda_desbloqueada.png");

  // --- e) Historial con valores anterior y nuevo.
  await fila.getByRole("button", { name: "Historial", exact: true }).click();
  const seccionHistorial = page
    .locator("section.panel.form-panel")
    .filter({ hasText: `Historial: ${codigo}` });
  await expect(seccionHistorial.locator("h3")).toHaveText(`Historial: ${codigo}`);

  const filasHistorial = seccionHistorial.locator("table.movement-table tbody tr");
  await expect(filasHistorial).toHaveCount(4);
  await expect(filasHistorial.filter({ hasText: "MODIFICAR" })).toContainText("Zona E2E modificada");
  await capturar(page, "M-13e_historial_celda.png");

  expect(base.valor(`SELECT ubicacion FROM celdas WHERE id=${celdaId}`)).toBe("Zona E2E modificada");
  expect(Number(base.valor(`SELECT COUNT(*) FROM historial_celdas WHERE celda_id=${celdaId}`))).toBe(4);
  expect(
    Number(
      base.valor(
        `SELECT COUNT(*) FROM auditoria_eventos WHERE entidad='CELDA' AND entidad_id=${celdaId}`,
      ),
    ),
  ).toBe(4);
});

test("M-14 · suscripciones: alta, solapamiento, cambio de fecha y vencimiento", async ({ page }) => {
  test.setTimeout(180_000);

  const token = await tokenAdmin();
  const creado = await crearClienteConVehiculo(token, { placa: placaCarro() });
  const vehiculo = creado.data.vehiculos[0];
  const hoy = fechaHoy();

  await sesionAdmin(page);
  // El rótulo del menú es "Suscripciones"; "Gestión de suscripciones" es el encabezado de página.
  await irASeccion(page, "Suscripciones");
  await expect(page.locator(".page-heading h2")).toHaveText("Gestión de suscripciones");

  // --- a) Alta de una suscripción de 30 días.
  await page.getByRole("button", { name: "Nueva suscripción" }).click();
  const dialogo = page.getByRole("dialog", { name: "Registrar suscripción" });
  await expect(dialogo).toBeVisible();
  await dialogo.locator("select").selectOption(String(vehiculo.id));
  await dialogo.locator(".field", { hasText: "Valor de la suscripción" }).locator("input").fill("150000");
  await dialogo.getByRole("button", { name: "Registrar suscripción" }).click();

  await expect(page.locator(".form-message")).toContainText(
    "Suscripción registrada. El estado se actualizará automáticamente según su fecha de inicio.",
  );
  await capturar(page, "M-14a_suscripcion_creada.png");

  const base = db();
  const subId = base.valor(`SELECT id FROM suscripciones WHERE vehiculo_id=${vehiculo.id}`);
  expect(base.valor(`SELECT fecha_fin FROM suscripciones WHERE id=${subId}`)).toBe(sumarDias(hoy, 29));

  // --- b) Período solapado rechazado.
  await page.getByRole("button", { name: "Nueva suscripción" }).click();
  const dialogoSolape = page.getByRole("dialog", { name: "Registrar suscripción" });
  await dialogoSolape.locator("select").selectOption(String(vehiculo.id));
  const inicioInput = dialogoSolape.locator(".field", { hasText: "Fecha de inicio" }).locator("input");
  // La renovación propone el día siguiente al último período no cancelado.
  await expect(inicioInput).toHaveValue(sumarDias(hoy, 30));
  await dialogoSolape.locator(".field", { hasText: "Valor de la suscripción" }).locator("input").fill("150000");
  await inicioInput.fill(sumarDias(hoy, 5));
  await dialogoSolape.getByRole("button", { name: "Registrar suscripción" }).click();

  await expect(dialogoSolape.locator(".form-message")).toContainText("El período se cruza con la suscripción");
  await capturar(page, "M-14b_solapamiento_rechazado.png");
  await dialogoSolape.getByRole("button", { name: "Cancelar" }).click();

  // --- c) Modificar la fecha de activación (recalcula el período a 30 días).
  const panel = page.locator(".history-panel");
  const fila = panel.locator("table.movement-table tbody tr").filter({ hasText: vehiculo.placa });
  await expect(fila).toHaveCount(1);
  await fila.getByRole("button", { name: "Fecha", exact: true }).click();

  const dialogoFecha = page.getByRole("dialog", {
    name: `Modificar fecha de activación de la suscripción ${subId}`,
  });
  await expect(dialogoFecha).toBeVisible();
  await dialogoFecha
    .locator(".field", { hasText: "Nueva fecha de inicio" })
    .locator("input")
    .fill(sumarDias(hoy, 1));
  await dialogoFecha
    .locator(".field", { hasText: "Motivo" })
    .locator("input")
    .fill("Ajuste E2E de la fecha de activación de la mensualidad.");
  await dialogoFecha.getByRole("button", { name: "Guardar fecha" }).click();

  await expect(page.locator(".form-message")).toContainText("Fecha de activación actualizada correctamente.");
  await expect(fila).toContainText("PROGRAMADA");
  await capturar(page, "M-14c_fecha_activacion_modificada.png");
  expect(base.valor(`SELECT fecha_fin FROM suscripciones WHERE id=${subId}`)).toBe(sumarDias(hoy, 30));

  // --- d) Vencimiento alcanzado por la sincronización automática (cada 60 s).
  // Se ajustan las fechas en la base efímera y se espera la sincronización real.
  base.filas(
    `UPDATE suscripciones
     SET fecha_inicio='${sumarDias(hoy, -40)}', fecha_fin='${sumarDias(hoy, -11)}', estado='VIGENTE'
     WHERE id=${subId}`,
  );
  await esperarEstadoSuscripcion(subId, "VENCIDA");

  await page.getByRole("button", { name: "Actualizar" }).click();
  await panel.getByPlaceholder("Buscar placa, marca o cliente...").fill(vehiculo.placa);
  await panel.locator("select").selectOption("VENCIDA");
  await expect(fila).toContainText("VENCIDA");
  await capturar(page, "M-14d_estado_vencida.png");

  expect(base.valor(`SELECT estado FROM suscripciones WHERE id=${subId}`)).toBe("VENCIDA");
});
