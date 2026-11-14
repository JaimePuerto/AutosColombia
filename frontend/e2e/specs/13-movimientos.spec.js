// M-07 · Entrada rechazada de una placa no registrada.
// M-08 · Entrada válida de un carro y de una camioneta (que ocupa celda tipo CARRO).
// M-09 · Salida registrada y salida rechazada cuando no hay entrada abierta.
// M-10 · Filtros y búsqueda del historial de movimientos.

import { api, capturar, db, expect, irASeccion, test } from "../support/fixtures.js";
import {
  crearClienteConVehiculo,
  crearSuscripcionVigente,
  placaCarro,
  registrarEntradaApi,
  registrarSalidaApi,
  sesionAdmin,
  tokenAdmin,
} from "./apoyo.js";

function panelFormulario(page) {
  return page.locator("section.panel.form-panel");
}

async function irAEntrada(page) {
  await irASeccion(page, "Ingreso de vehículos");
  await expect(page.locator(".page-heading h2")).toHaveText("Ingreso de vehículos");
}

async function irASalida(page) {
  await irASeccion(page, "Salida de vehículos");
  await expect(page.locator(".page-heading h2")).toHaveText("Salida de vehículos");
}

// Registra la entrada o la salida desde el formulario de la interfaz y devuelve el mensaje.
async function registrarMovimientoUI(page, { placa, tipo, seccion }) {
  const panel = panelFormulario(page);
  await panel.locator(".field", { hasText: "Placa del vehículo" }).locator("input").fill(placa);

  if (seccion === "entrada") {
    await panel.locator(".field", { hasText: "Tipo de vehículo" }).locator("select").selectOption(tipo);
  }

  await panel
    .getByRole("button", { name: seccion === "entrada" ? "Registrar ingreso" : "Registrar salida" })
    .click();

  return panel.locator(".form-message");
}

// Crea un cliente con vehículo y una suscripción VIGENTE; devuelve placa y vehículo.
async function vehiculoListoParaIngresar(token, tipo = "CARRO") {
  const creado = await crearClienteConVehiculo(token, { placa: placaCarro(), tipo });
  const vehiculo = creado.data.vehiculos[0];
  await crearSuscripcionVigente(token, vehiculo.id);
  return { placa: vehiculo.placa, vehiculoId: vehiculo.id };
}

// Cuenta los eventos que la interfaz deriva de cada movimiento (finalizado => 2).
function eventosEsperados(placa) {
  return Number(
    db().valor(
      `SELECT SUM(CASE
                    WHEN m.fecha_salida IS NOT NULL AND m.anulado_en IS NULL THEN 2
                    ELSE 1
                  END)
       FROM movimientos m
       INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE v.placa='${placa}'`,
    ),
  );
}

test("M-07 · entrada rechazada de una placa no registrada", async ({ page }) => {
  await sesionAdmin(page);
  await irAEntrada(page);

  const placa = placaCarro();
  const mensaje = await registrarMovimientoUI(page, { placa, tipo: "CARRO", seccion: "entrada" });

  await expect(mensaje).toContainText(
    "El vehículo no se encuentra registrado. Debe registrarse antes de ingresar al parqueadero.",
  );
  await expect(mensaje).toHaveClass(/error/);
  await capturar(page, "M-07_entrada_placa_no_registrada.png");

  // No se crea el vehículo automáticamente ni el movimiento.
  expect(db().contar("vehiculos", `placa='${placa}'`)).toBe(0);
  expect(
    Number(
      db().valor(
        `SELECT COUNT(*) FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id WHERE v.placa='${placa}'`,
      ),
    ),
  ).toBe(0);
});

test("M-08a · entrada de un carro con suscripción vigente", async ({ page }) => {
  const token = await tokenAdmin();
  const { placa } = await vehiculoListoParaIngresar(token, "CARRO");

  await sesionAdmin(page);
  await irAEntrada(page);

  const mensaje = await registrarMovimientoUI(page, { placa, tipo: "CARRO", seccion: "entrada" });
  await expect(mensaje).toContainText("Entrada registrada correctamente. Celda asignada:");
  await expect(mensaje).toHaveClass(/success/);
  await capturar(page, "M-08a_entrada_carro.png");

  const base = db();
  expect(
    Number(
      base.valor(
        `SELECT COUNT(*) FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id
         WHERE v.placa='${placa}' AND m.fecha_salida IS NULL`,
      ),
    ),
  ).toBe(1);
  expect(
    base.valor(
      `SELECT tipo_celda_snapshot FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE v.placa='${placa}' AND m.fecha_salida IS NULL LIMIT 1`,
    ),
  ).toBe("CARRO");
});

test("M-08b · entrada de una camioneta que ocupa celda tipo CARRO", async ({ page }) => {
  const token = await tokenAdmin();
  const { placa } = await vehiculoListoParaIngresar(token, "CAMIONETA");

  await sesionAdmin(page);
  await irAEntrada(page);

  const mensaje = await registrarMovimientoUI(page, { placa, tipo: "CAMIONETA", seccion: "entrada" });
  await expect(mensaje).toContainText("Entrada registrada correctamente. Celda asignada:");
  await capturar(page, "M-08b_entrada_camioneta.png");

  const base = db();
  expect(base.valor(`SELECT tipo FROM vehiculos WHERE placa='${placa}'`)).toBe("CAMIONETA");
  expect(
    base.valor(
      `SELECT tipo_celda_snapshot FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE v.placa='${placa}' AND m.fecha_salida IS NULL LIMIT 1`,
    ),
  ).toBe("CARRO");
});

test("M-09a · salida de un vehículo con entrada abierta", async ({ page }) => {
  const token = await tokenAdmin();
  const { placa } = await vehiculoListoParaIngresar(token, "CARRO");
  const entrada = await registrarEntradaApi(token, placa, "CARRO");
  expect(entrada.status).toBe(201);

  await sesionAdmin(page);
  await irASalida(page);

  const mensaje = await registrarMovimientoUI(page, { placa, seccion: "salida" });
  await expect(mensaje).toContainText("Salida registrada correctamente.");
  await expect(mensaje).toHaveClass(/success/);
  await capturar(page, "M-09a_salida_registrada.png");

  expect(
    db().valor(
      `SELECT fecha_salida FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE v.placa='${placa}' ORDER BY m.id DESC LIMIT 1`,
    ),
  ).not.toBe("NULL");
});

test("M-09b · salida rechazada sin entrada abierta", async ({ page }) => {
  const token = await tokenAdmin();
  const creado = await crearClienteConVehiculo(token, { placa: placaCarro() });
  const placa = creado.data.vehiculos[0].placa;

  await sesionAdmin(page);
  await irASalida(page);

  const mensaje = await registrarMovimientoUI(page, { placa, seccion: "salida" });
  await expect(mensaje).toContainText("No hay una entrada abierta para esta placa.");
  await expect(mensaje).toHaveClass(/error/);
  await capturar(page, "M-09b_salida_sin_entrada.png");

  expect(
    Number(
      db().valor(
        `SELECT COUNT(*) FROM movimientos m INNER JOIN vehiculos v ON v.id = m.vehiculo_id WHERE v.placa='${placa}'`,
      ),
    ),
  ).toBe(0);
});

test("M-10 · filtros y búsqueda del historial de movimientos", async ({ page }) => {
  const token = await tokenAdmin();

  // Placa A: entrada y salida => un movimiento finalizado (dos eventos: Salida y Entrada).
  const a = await vehiculoListoParaIngresar(token, "CARRO");
  expect((await registrarEntradaApi(token, a.placa, "CARRO")).status).toBe(201);
  expect((await registrarSalidaApi(token, a.placa)).status).toBe(200);

  // Placa B: solo entrada => un movimiento activo (un evento: Entrada).
  const b = await vehiculoListoParaIngresar(token, "CARRO");
  expect((await registrarEntradaApi(token, b.placa, "CARRO")).status).toBe(201);

  // Placa C: entrada anulada => un evento de Anulación.
  const c = await vehiculoListoParaIngresar(token, "CARRO");
  const entradaC = await registrarEntradaApi(token, c.placa, "CARRO");
  expect(entradaC.status).toBe(201);
  const anulacion = await api("POST", `/movimientos-admin/${entradaC.json.data.id}/anular`, {
    token,
    body: { motivo: "Anulación de prueba E2E para verificar el filtro del historial." },
  });
  expect(anulacion.status).toBe(200);

  await sesionAdmin(page);
  await irASeccion(page, "Historial de movimientos");
  await expect(page.locator(".page-heading h2")).toHaveText("Historial de movimientos");

  const panel = page.locator(".history-panel");
  const filtro = panel.locator(".history-filters select");
  const buscar = panel.getByPlaceholder("Buscar por placa...");
  const contador = panel.locator(".history-toolbar p");
  const filas = panel.locator("table.movement-table tbody tr");

  // Placa A: dos eventos; sólo aparecen con el filtro Todos y Finalizados.
  await buscar.fill(a.placa);
  await expect(contador).toHaveText(`${eventosEsperados(a.placa)} movimientos registrados`);
  expect(eventosEsperados(a.placa)).toBe(2);

  await filtro.selectOption("FINALIZADOS");
  await expect(contador).toHaveText("2 movimientos registrados");
  await filtro.selectOption("ACTIVOS");
  await expect(contador).toHaveText("0 movimientos registrados");
  await filtro.selectOption("ANULADOS");
  await expect(contador).toHaveText("0 movimientos registrados");
  await filtro.selectOption("TODOS");
  await expect(contador).toHaveText("2 movimientos registrados");

  // Orden descendente por hora: la salida (posterior) precede a la entrada.
  await expect(filas.first()).toContainText("Salida");

  // Placa B: un evento activo.
  await buscar.fill(b.placa);
  await filtro.selectOption("ACTIVOS");
  await expect(contador).toHaveText("1 movimientos registrados");
  await expect(filas.first()).toContainText("Activo");
  expect(eventosEsperados(b.placa)).toBe(1);

  // Placa C: un evento anulado.
  await buscar.fill(c.placa);
  await filtro.selectOption("ANULADOS");
  await expect(contador).toHaveText("1 movimientos registrados");
  await expect(filas.first()).toContainText("Anulado");
  expect(eventosEsperados(c.placa)).toBe(1);

  await filtro.selectOption("TODOS");
  await buscar.fill("");
  await expect(contador).toContainText("movimientos registrados");
  await capturar(page, "M-10_historial_filtros.png");
});
