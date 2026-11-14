// M-15 · Panel principal: los cuatro indicadores del tablero se concilian contra la
//        base de datos efímera (capacidad, vehículos dentro, celdas libres y movimientos).

import { capturar, db, expect, irASeccion, test } from "../support/fixtures.js";
import {
  crearClienteConVehiculo,
  crearSuscripcionVigente,
  placaCarro,
  registrarEntradaApi,
  sesionAdmin,
  tokenAdmin,
} from "./apoyo.js";

test("M-15 · panel principal conciliado contra la base", async ({ page }) => {
  const token = await tokenAdmin();

  // Se deja un vehículo dentro del parqueadero para que los indicadores no sean triviales.
  const creado = await crearClienteConVehiculo(token, { placa: placaCarro() });
  const vehiculo = creado.data.vehiculos[0];
  await crearSuscripcionVigente(token, vehiculo.id);
  const entrada = await registrarEntradaApi(token, vehiculo.placa, "CARRO");
  expect(entrada.status).toBe(201);

  await sesionAdmin(page);
  await irASeccion(page, "Panel principal");
  await expect(page.locator(".page-heading h2")).toHaveText("Panel principal");

  const base = db();
  const totalCeldas = Number(base.valor("SELECT COUNT(*) FROM celdas WHERE activa=1"));
  const vehiculosDentro = Number(
    base.valor("SELECT COUNT(*) FROM movimientos WHERE fecha_salida IS NULL"),
  );
  const totalMovimientos = Number(base.valor("SELECT COUNT(*) FROM movimientos"));
  const celdasLibres = totalCeldas - vehiculosDentro; // misma fórmula del backend

  const indicador = (etiqueta) =>
    page.locator(".stat-card").filter({ hasText: etiqueta }).locator(".stat-number");

  await expect(indicador("Capacidad total")).toHaveText(String(totalCeldas));
  await expect(indicador("Vehículos en el parqueadero")).toHaveText(String(vehiculosDentro));
  await expect(indicador("Celdas disponibles")).toHaveText(String(celdasLibres));
  await expect(indicador("Movimientos registrados")).toHaveText(String(totalMovimientos));

  // Coherencia interna: celdas ocupadas por vehículos dentro.
  expect(celdasLibres).toBe(totalCeldas - vehiculosDentro);
  expect(vehiculosDentro).toBeGreaterThan(0);

  await capturar(page, "M-15_panel_principal.png");
});
