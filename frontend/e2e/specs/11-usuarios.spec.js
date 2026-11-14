// M-04 · Gestión de usuarios: creación, suspensión con sesión activa, suspensión y reactivación.
// M-16 · Menú y permisos del perfil operador.
// M-17 · Contraseñas temporales: emisión, desbloqueo de cuenta y cambio obligatorio.

import { api, capturar, db, expect, test } from "../support/fixtures.js";
import { CREDENCIALES } from "../support/env.js";
import {
  documentoUnico,
  entrarOperadorApi,
  sesionAdmin,
  tokenAdmin,
  crearClienteConVehiculo,
  crearOperadorApi,
} from "./apoyo.js";

const CERRAR_SESION = /Cerrar sesión/;

async function abrirGestionUsuarios(page) {
  await page.locator(".nav-item", { hasText: "Gestión de usuarios" }).click();
  await expect(page.locator(".page-heading h2")).toHaveText("Gestión de usuarios");
}

// Registra un usuario desde la interfaz. Si no se envía contraseña, el backend
// emite una contraseña temporal de cambio obligatorio.
async function registrarUsuarioPorUI(page, { documento, nombre, apellidos, email, telefono = "3001234567" }) {
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  const dialogo = page.getByRole("dialog", { name: "Registrar usuario" });
  await expect(dialogo).toBeVisible();

  await dialogo.locator("label.field", { hasText: "Nombres" }).locator("input").fill(nombre);
  await dialogo.locator("label.field", { hasText: "Apellidos" }).locator("input").fill(apellidos);
  await dialogo.locator("label.field", { hasText: "Documento" }).locator("input").fill(documento);
  await dialogo.locator("label.field", { hasText: "Correo" }).locator("input").fill(email);
  await dialogo.locator("label.field", { hasText: "Teléfono" }).locator("input").fill(telefono);

  await dialogo.getByRole("button", { name: "Crear usuario" }).click();
  return dialogo;
}

// Filtra la tabla de usuarios por documento y devuelve la fila resultante.
async function filaDeUsuario(page, documento) {
  await page.getByPlaceholder("Documento...").fill(documento);
  const fila = page.locator("table.movement-table tbody tr").filter({ hasText: documento });
  await expect(fila).toHaveCount(1);
  return fila;
}

async function cambiarEstadoPorUI(page, { nombre, motivo }) {
  const dialogo = page.getByRole("dialog", { name: `Cambiar estado de ${nombre}` });
  await expect(dialogo).toBeVisible();
  await dialogo.locator("label.field", { hasText: "Motivo" }).locator("input").fill(motivo);
  await dialogo.getByRole("button", { name: "Confirmar cambio" }).click();
  return dialogo;
}

test("M-04a · creación de usuario con contraseña temporal", async ({ page }) => {
  await sesionAdmin(page);
  await abrirGestionUsuarios(page);

  const documento = documentoUnico();
  const dialogo = await registrarUsuarioPorUI(page, {
    documento,
    nombre: "Usuario",
    apellidos: "Creado",
    email: `usuario.${documento}@example.test`,
  });

  await expect(dialogo).toBeHidden();
  const mensaje = page.locator(".form-message.success[role='alert']");
  await expect(mensaje).toContainText(`Operador creado. Contraseña temporal:`);

  const fila = await filaDeUsuario(page, documento);
  await expect(fila).toContainText("Usuario Creado");
  await expect(fila).toContainText("Operador");
  await capturar(page, "M-04a_usuario_creado.png");

  const base = db();
  expect(base.contar("operadores", `documento='${documento}'`)).toBe(1);
  expect(base.valor(`SELECT password_temporal FROM operadores WHERE documento='${documento}'`)).toBe("1");
});

test("M-04b · suspensión rechazada mientras el operador tiene sesión activa", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const password = "SesionActiva2026";
  const nombre = "SesionActiva";
  await crearOperadorApi(token, { documento, password, nombre, apellidos: "Prueba" });

  // El operador abre una sesión válida antes de intentar suspenderlo.
  await entrarOperadorApi(documento, password);

  await sesionAdmin(page);
  await abrirGestionUsuarios(page);
  const fila = await filaDeUsuario(page, documento);
  await fila.getByRole("button", { name: "Estado" }).click();

  const dialogo = await cambiarEstadoPorUI(page, { nombre, motivo: "Suspensión de prueba E2E" });
  await expect(dialogo.locator(".form-message.error[role='alert']")).toContainText(
    "No se puede suspender o desvincular: el operador tiene una sesión activa.",
  );
  await capturar(page, "M-04b_suspension_con_sesion_activa.png");

  expect(db().valor(`SELECT estado FROM operadores WHERE documento='${documento}'`)).toBe("ACTIVO");
});

test("M-04c · suspensión de usuario sin sesión activa", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const nombre = "Suspendible";
  await crearOperadorApi(token, { documento, password: "Suspendible2026", nombre, apellidos: "Prueba" });

  await sesionAdmin(page);
  await abrirGestionUsuarios(page);
  const fila = await filaDeUsuario(page, documento);
  await fila.getByRole("button", { name: "Estado" }).click();

  const dialogo = await cambiarEstadoPorUI(page, { nombre, motivo: "Suspensión controlada E2E" });
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Estado del operador actualizado.",
  );
  const filaSuspendida = await filaDeUsuario(page, documento);
  await expect(filaSuspendida).toContainText("SUSPENDIDO");
  await capturar(page, "M-04c_usuario_suspendido.png");

  expect(db().valor(`SELECT estado FROM operadores WHERE documento='${documento}'`)).toBe("SUSPENDIDO");
});

test("M-04d · reactivación de usuario con nueva contraseña temporal", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const nombre = "Reactivado";
  const creado = await crearOperadorApi(token, {
    documento,
    password: "Reactivado2026",
    nombre,
    apellidos: "Prueba",
  });
  const suspendido = await api("PATCH", `/operadores/${creado.data.id}/estado`, {
    token,
    body: { estado: "SUSPENDIDO", motivo: "Suspensión previa para prueba de reactivación" },
  });
  expect(suspendido.status).toBe(200);

  await sesionAdmin(page);
  await abrirGestionUsuarios(page);
  const fila = await filaDeUsuario(page, documento);
  await fila.getByRole("button", { name: "Estado" }).click();

  const dialogo = await cambiarEstadoPorUI(page, { nombre, motivo: "Reactivación controlada E2E" });
  await expect(dialogo).toBeHidden();

  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Estado actualizado. Contraseña temporal:",
  );
  const filaActiva = await filaDeUsuario(page, documento);
  await expect(filaActiva).toContainText("ACTIVO");
  await capturar(page, "M-04d_usuario_reactivado.png");

  const base = db();
  expect(base.valor(`SELECT estado FROM operadores WHERE documento='${documento}'`)).toBe("ACTIVO");
  expect(base.valor(`SELECT password_temporal FROM operadores WHERE documento='${documento}'`)).toBe("1");
});

test("M-16 · menú y permisos del perfil operador", async ({ page }) => {
  // Se asegura al menos un cliente registrado para comprobar el directorio.
  const token = await tokenAdmin();
  await crearClienteConVehiculo(token);

  await page.goto("/");
  await page.getByPlaceholder("Número de documento").fill(CREDENCIALES.operadorDocumento);
  await page.getByPlaceholder("Tu contraseña").fill(CREDENCIALES.operadorPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();

  // El operador solo ve las cinco secciones no administrativas.
  await expect(page.locator(".nav-item")).toHaveCount(5);
  await expect(page.locator(".nav-item", { hasText: "Auditoría" })).toHaveCount(0);
  await expect(page.locator(".nav-item", { hasText: "Gestión de usuarios" })).toHaveCount(0);
  await expect(page.locator(".nav-item", { hasText: "Mi cuenta" })).toHaveCount(0);

  // «Mi cuenta» vive en el menú del perfil, no en el menú lateral.
  await page.locator(".user-menu-trigger").click();
  await expect(page.locator(".user-dropdown[role='menu']").getByRole("menuitem", { name: /Mi cuenta/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // El directorio de clientes es de consulta: las acciones de edición están deshabilitadas.
  await page.locator(".nav-item", { hasText: "Gestión de clientes" }).click();
  const fila = page.locator("table.movement-table tbody tr").first();
  await expect(fila).toBeVisible();
  await expect(fila.getByRole("button", { name: "Editar" })).toBeDisabled();
  await expect(fila.getByRole("button", { name: /Inactivar|Activar/ })).toBeDisabled();
  await capturar(page, "M-16_menu_y_clientes_operador.png");

  // La auditoría es exclusiva del administrador: la API responde 403.
  const operadorToken = await entrarOperadorApi(CREDENCIALES.operadorDocumento, CREDENCIALES.operadorPassword);
  const auditoria = await api("GET", "/auditoria", { token: operadorToken });
  expect(auditoria.status).toBe(403);
});

test("M-17a · emisión de contraseña temporal al crear el usuario", async ({ page }) => {
  await sesionAdmin(page);
  await abrirGestionUsuarios(page);

  const documento = documentoUnico();
  await registrarUsuarioPorUI(page, {
    documento,
    nombre: "Temporal",
    apellidos: "Emitida",
    email: `temporal.${documento}@example.test`,
  });

  const mensaje = page.locator(".form-message.success[role='alert']");
  await expect(mensaje).toContainText("Contraseña temporal:");
  await capturar(page, "M-17a_operador_con_temporal.png");

  const texto = await mensaje.textContent();
  const temporal = /Contraseña temporal:\s*(\S+)/.exec(texto || "")?.[1];
  expect(temporal, "El mensaje debe incluir la contraseña temporal emitida").toBeTruthy();
  expect(db().valor(`SELECT password_temporal FROM operadores WHERE documento='${documento}'`)).toBe("1");
});

test("M-17b · desbloqueo de una cuenta bloqueada", async ({ page }) => {
  const token = await tokenAdmin();
  const documento = documentoUnico();
  const nombre = "Bloqueado";
  await crearOperadorApi(token, { documento, password: "Bloqueado2026", nombre, apellidos: "Prueba" });

  // Cinco intentos fallidos dejan la cuenta bloqueada.
  for (let intento = 1; intento <= 5; intento += 1) {
    await api("POST", "/auth/login", { body: { documento, password: `Erronea${intento}2026` } });
  }
  const base = db();
  expect(base.valor(`SELECT bloqueado FROM operadores WHERE documento='${documento}'`)).toBe("1");

  await sesionAdmin(page);
  await abrirGestionUsuarios(page);
  const fila = await filaDeUsuario(page, documento);
  await expect(fila).toContainText("Bloqueado");

  page.on("dialog", (dialogo) => dialogo.accept());
  await fila.getByRole("button", { name: "Desbloquear" }).click();

  await expect(page.locator(".form-message.success[role='alert']")).toContainText(
    "Cuenta desbloqueada. Contraseña temporal:",
  );
  await capturar(page, "M-17b_desbloqueo_cuenta.png");

  expect(base.valor(`SELECT bloqueado FROM operadores WHERE documento='${documento}'`)).toBe("0");
  expect(base.valor(`SELECT password_temporal FROM operadores WHERE documento='${documento}'`)).toBe("1");
});

test("M-17c y M-17d · cambio obligatorio de la contraseña temporal", async ({ page }) => {
  await sesionAdmin(page);
  await abrirGestionUsuarios(page);

  const documento = documentoUnico();
  await registrarUsuarioPorUI(page, {
    documento,
    nombre: "Obligatorio",
    apellidos: "Cambio",
    email: `obligatorio.${documento}@example.test`,
  });
  const texto = await page.locator(".form-message.success[role='alert']").textContent();
  const temporal = /Contraseña temporal:\s*(\S+)/.exec(texto || "")?.[1];
  expect(temporal, "Debe emitirse una contraseña temporal").toBeTruthy();

  // El administrador cierra su sesión para ingresar con la cuenta temporal.
  await page.locator(".user-menu-trigger").click();
  await page.getByRole("menuitem", { name: CERRAR_SESION }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();

  await page.getByPlaceholder("Número de documento").fill(documento);
  await page.getByPlaceholder("Tu contraseña").fill(temporal);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("heading", { name: "Cambio de contraseña obligatorio" })).toBeVisible();
  await capturar(page, "M-17c_cambio_obligatorio.png");

  // En la pantalla forzada solo existen los campos «Nueva contraseña» y
  // «Confirmar nueva contraseña»; sus etiquetas se solapan, por eso se usan posiciones.
  const nueva = "Definitiva2026";
  const campos = page.locator(".auth-card input[type='password']");
  await campos.nth(0).fill(nueva);
  await campos.nth(1).fill(nueva);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();

  // El cambio libera la cuenta: la aplicación queda disponible y la contraseña
  // temporal deja de ser válida.
  await expect(page.locator(".sidebar")).toBeVisible();
  const base = db();
  expect(base.valor(`SELECT password_temporal FROM operadores WHERE documento='${documento}'`)).toBe("0");
  expect(
    Number(base.valor(`SELECT COUNT(*) FROM auditoria_autenticacion WHERE accion='CAMBIO_PASSWORD'`)),
  ).toBeGreaterThanOrEqual(1);
  await capturar(page, "M-17d_password_cambiada.png");

  await page.locator(".user-menu-trigger").click();
  await page.getByRole("menuitem", { name: CERRAR_SESION }).click();
  await page.getByPlaceholder("Número de documento").fill(documento);
  await page.getByPlaceholder("Tu contraseña").fill(temporal);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator(".form-message.error[role='alert']")).toContainText("No fue posible iniciar sesión.");
});
