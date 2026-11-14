// Pruebas de integración de AutosColombia - Iteración 2.
//
// Se ejecutan contra una base de datos INDEPENDIENTE y temporal (no toca `autoscolombia`):
//   1) crea la base `autoscolombia_test_<pid>`;
//   2) aplica el orden de instalación limpia real (schema.sql + migraciones 002..011);
//   3) apunta los servicios del backend a esa base;
//   4) ejecuta operaciones críticas (entrada, salida, anulación, suscripción, auditoría,
//      restricciones y atomicidad) y verifica sus efectos en la base;
//   5) elimina la base al terminar.
//
// Si MySQL o el cliente `mysql` no están disponibles, las pruebas se marcan como omitidas
// en lugar de fallar, para no romper `npm test` en entornos sin base de datos.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(__dirname, "../../sql");
const TEST_DB = `autoscolombia_test_${process.pid}`;

// Cuenta administrativa para el arnés: crear/eliminar la base efímera y aplicar los
// scripts (DDL) requiere privilegios que la cuenta de ejecución de la app no tiene.
// El backend (RF/RNF de runtime) sigue operando con DB_USER/DB_PASSWORD.
const DB = {
  host: process.env.DB_HOST || "localhost",
  port: String(process.env.DB_PORT || 3306),
  user: process.env.DB_ADMIN_USER || process.env.DB_USER,
  password: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD,
};

const SCRIPTS = [
  "schema.sql",
  "migrations/002_autenticacion_operadores.sql",
  "migrations/003_gestion_celdas_auditoria.sql",
  "migrations/004_iteracion2_auditoria_movimientos.sql",
  "migrations/005_cierre_iteracion2_seguridad.sql",
  "migrations/006_estados_suscripcion_ea2.sql",
  "migrations/007_tipo_vehiculo_camioneta.sql",
  "migrations/008_datos_obligatorios_clientes.sql",
  "migrations/009_historicos_append_only.sql",
  "migrations/011_normalizacion_mensualidades_30_dias.sql",
  "migrations/010_integridad_campos_ea2.sql",
];

function localizarMysql() {
  const candidatos = [
    process.env.MYSQL_BIN,
    "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
    "C:\\xampp\\mysql\\bin\\mysql.exe",
  ].filter(Boolean);

  for (const candidato of candidatos) {
    try {
      if (fs.existsSync(candidato)) return candidato;
    } catch { /* se ignora y se continúa */ }
  }

  const enPath = spawnSync("mysql", ["--version"], { encoding: "utf8" });
  return enPath.status === 0 ? "mysql" : null;
}

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const MYSQL_BIN = localizarMysql();

// Disponibilidad del entorno: requiere MySQL accesible y el cliente `mysql` para aplicar
// los scripts con DELIMITER (migración 003).
let disponible = true;
let motivoOmision = "";

if (!MYSQL_BIN) {
  disponible = false;
  motivoOmision = "Cliente `mysql` no encontrado: se omiten las pruebas de integración.";
} else {
  try {
    const probe = await mysql.createConnection({
      host: DB.host, port: Number(DB.port), user: DB.user, password: DB.password,
    });
    await probe.query("SELECT 1");
    await probe.end();
  } catch (error) {
    disponible = false;
    motivoOmision = `MySQL no disponible: ${error.message}`;
  }
}

const omitir = disponible ? false : motivoOmision;

const ctx = {};

async function conexionTestDb() {
  return mysql.createConnection({
    host: DB.host, port: Number(DB.port), user: DB.user, password: DB.password,
    database: TEST_DB, dateStrings: true,
  });
}

function aplicarScript(rutaRelativa) {
  const ruta = path.join(SQL_DIR, rutaRelativa);
  const sql = fs.readFileSync(ruta, "utf8").replace(/autoscolombia/g, TEST_DB);
  const resultado = spawnSync(
    MYSQL_BIN,
    ["--host", DB.host, "--port", DB.port, "--user", DB.user, "--default-character-set=utf8mb4"],
    { input: sql, env: { ...process.env, MYSQL_PWD: DB.password }, encoding: "utf8" },
  );
  if (resultado.status !== 0) {
    throw new Error(
      `No fue posible aplicar ${path.basename(rutaRelativa)}: ` +
      `${(resultado.stderr || resultado.stdout || "").trim()}`,
    );
  }
}

before(async () => {
  if (!disponible) return;

  // 1) Crear una base de datos independiente y limpia.
  const admin = await mysql.createConnection({
    host: DB.host, port: Number(DB.port), user: DB.user, password: DB.password,
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  // 2) Aplicar el orden de instalación limpia.
  for (const script of SCRIPTS) aplicarScript(script);

  // 3) Apuntar los servicios del backend a la base de pruebas y cargarlos.
  // La base efímera tiene un nombre distinto de `autoscolombia`, por lo que las concesiones
  // por tabla de la cuenta de ejecución no aplican: el arnés usa la cuenta administrativa.
  process.env.DB_NAME = TEST_DB;
  process.env.DB_USER = DB.user;
  process.env.DB_PASSWORD = DB.password;
  const [clientes, vehiculos, suscripciones, movimientos, adminMov, operadores, auditoria, celdas, poolMod] =
    await Promise.all([
      import("../../src/services/clientes.service.js"),
      import("../../src/services/vehiculos.service.js"),
      import("../../src/services/suscripciones.service.js"),
      import("../../src/services/movimientos.service.js"),
      import("../../src/services/movimientos.admin.service.js"),
      import("../../src/services/operadores.service.js"),
      import("../../src/services/auditoria.service.js"),
      import("../../src/services/celdas.service.js"),
      import("../../src/config/database.js"),
    ]);

  ctx.servicios = { clientes, vehiculos, suscripciones, movimientos, adminMov, operadores, auditoria, celdas };
  ctx.pool = poolMod.default;

  // 4) Sembrar datos mínimos.
  const admin1 = await operadores.crearOperador(
    {
      nombre: "Admin", apellidos: "Pruebas", documento: "900000001",
      email: "admin.integracion@example.test", telefono: "3000000001",
      rol: "ADMINISTRADOR", password: "Prueba1234",
    },
    null,
  );
  ctx.operadorId = admin1.id;

  const cliente = await clientes.registrarClienteConVehiculos(
    {
      cliente: {
        tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "1000000001",
        nombres: "Cliente", apellidos: "Integración", correo: "cliente.integracion@example.test",
        telefono: "3000000002",
      },
      vehiculos: [{ placa: "ABC123", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Azul" }],
      autorizacion: true,
    },
    ctx.operadorId,
  );
  ctx.clienteId = cliente.id;
  ctx.vehiculoId = cliente.vehiculos[0].id;

  await celdas.crearCelda({ codigo: "C-01", tipo: "CARRO", ubicacion: "Nivel 1" }, ctx.operadorId);
  await celdas.crearCelda({ codigo: "C-02", tipo: "CARRO", ubicacion: "Nivel 1" }, ctx.operadorId);
  await celdas.crearCelda({ codigo: "M-01", tipo: "MOTO", ubicacion: "Nivel 2" }, ctx.operadorId);

  const conexion = await conexionTestDb();
  const [filasHoy] = await conexion.query("SELECT CURRENT_DATE() AS hoy");
  conexion.destroy();
  ctx.hoy = String(filasHoy[0].hoy).slice(0, 10);
  ctx.fin30 = sumarDias(ctx.hoy, 29);

  const suscripcion = await suscripciones.crearSuscripcion(
    { vehiculo_id: ctx.vehiculoId, fecha_inicio: ctx.hoy, fecha_fin: ctx.fin30 }, ctx.operadorId,
  );
  ctx.suscripcionId = suscripcion.id;
  await suscripciones.cambiarEstadoSuscripcion(ctx.suscripcionId, "VIGENTE", ctx.operadorId);
});

after(async () => {
  if (!disponible) return;
  try { await ctx.pool?.end(); } catch { /* la base se elimina de todas formas */ }
  try {
    const admin = await mysql.createConnection({
      host: DB.host, port: Number(DB.port), user: DB.user, password: DB.password,
    });
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin.end();
  } catch { /* limpieza best-effort */ }
});

test("esquema: los 11 scripts crean tablas, campos y restricciones EA2", { skip: omitir }, async () => {
  const conexion = await conexionTestDb();
  try {
    const [tablas] = await conexion.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN
       ('clientes','vehiculos','celdas','movimientos','suscripciones','operadores',
        'auditoria_eventos','auditoria_autenticacion','historial_celdas',
        'historial_titulares_vehiculo','recuperacion_password')`,
      [TEST_DB],
    );
    assert.equal(tablas.length, 11, "deben existir las 11 tablas clave de la iteración");

    const [tipoVehiculo] = await conexion.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vehiculos' AND COLUMN_NAME = 'tipo'`,
      [TEST_DB],
    );
    assert.match(tipoVehiculo[0].COLUMN_TYPE, /CAMIONETA/, "RF-01: el ENUM de vehiculos.tipo debe incluir CAMIONETA");

    const [estadoSuscripcion] = await conexion.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'suscripciones' AND COLUMN_NAME = 'estado'`,
      [TEST_DB],
    );
    assert.match(estadoSuscripcion[0].COLUMN_TYPE, /VIGENTE/, "RF-28: los estados deben usar la nomenclatura EA2");
    assert.doesNotMatch(estadoSuscripcion[0].COLUMN_TYPE, /PENDIENTE/, "RF-28 no debe conservar la nomenclatura anterior");

    const [camposCliente] = await conexion.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clientes'
         AND COLUMN_NAME IN ('nombres', 'apellidos')`,
      [TEST_DB],
    );
    assert.equal(camposCliente.length, 2, "la migración 008 debe agregar nombres y apellidos");

    aplicarScript("migrations/008_datos_obligatorios_clientes.sql");
    const [camposTrasReejecucion] = await conexion.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clientes'
         AND COLUMN_NAME IN ('nombres', 'apellidos')`,
      [TEST_DB],
    );
    assert.equal(camposTrasReejecucion.length, 2, "la migración 008 debe ser idempotente");

    aplicarScript("migrations/009_historicos_append_only.sql");
    aplicarScript("migrations/010_integridad_campos_ea2.sql");
    const [triggers] = await conexion.query(
      `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME IN (
         'trg_auditoria_eventos_no_update','trg_auditoria_eventos_no_delete',
         'trg_auditoria_autenticacion_no_update','trg_auditoria_autenticacion_no_delete',
         'trg_historial_celdas_no_update','trg_historial_celdas_no_delete',
         'trg_historial_titulares_no_update','trg_historial_titulares_no_delete'
       )`,
      [TEST_DB],
    );
    assert.equal(triggers.length, 8, "las migraciones 009 y 010 deben ser idempotentes");

    const [integridad] = await conexion.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'suscripciones'
         AND CONSTRAINT_NAME = 'chk_suscripcion_30_dias'`,
      [TEST_DB],
    );
    assert.equal(integridad.length, 1, "la migración 010 debe agregar CHECK de 30 días");

    // Migración 011: conciliación de mensualidades (tablas de respaldo y sin conciliar).
    const [tablas011] = await conexion.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN
       ('suscripciones_respaldo_normalizacion','mensualidades_sin_conciliar')`,
      [TEST_DB],
    );
    assert.equal(tablas011.length, 2, "la migración 011 debe crear las tablas de respaldo y sin conciliar");

    aplicarScript("migrations/011_normalizacion_mensualidades_30_dias.sql");
    const [tablas011TrasReejecucion] = await conexion.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN
       ('suscripciones_respaldo_normalizacion','mensualidades_sin_conciliar')`,
      [TEST_DB],
    );
    assert.equal(tablas011TrasReejecucion.length, 2, "la migración 011 debe ser idempotente");
  } finally {
    conexion.destroy();
  }
});

test("RNF-07: auditoría e históricos permiten insertar y rechazan modificar o borrar", { skip: omitir }, async () => {
  const conexion = await conexionTestDb();
  try {
    const [[evento]] = await conexion.query(
      "SELECT id FROM auditoria_eventos ORDER BY id LIMIT 1",
    );
    const [[historialCelda]] = await conexion.query(
      "SELECT id FROM historial_celdas ORDER BY id LIMIT 1",
    );
    assert.ok(evento?.id);
    assert.ok(historialCelda?.id);

    await assert.rejects(
      conexion.execute("UPDATE auditoria_eventos SET motivo = 'cambio no permitido' WHERE id = ?", [evento.id]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
    await assert.rejects(
      conexion.execute("DELETE FROM auditoria_eventos WHERE id = ?", [evento.id]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
    await assert.rejects(
      conexion.execute("UPDATE historial_celdas SET motivo = 'cambio no permitido' WHERE id = ?", [historialCelda.id]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
    await assert.rejects(
      conexion.execute("DELETE FROM historial_celdas WHERE id = ?", [historialCelda.id]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );

    const [insertado] = await conexion.execute(
      `INSERT INTO auditoria_autenticacion (operador_id, documento_intentado, accion, detalle)
       VALUES (?, '900000001', 'LOGIN_FALLIDO', 'evento sintético de prueba')`,
      [ctx.operadorId],
    );
    await assert.rejects(
      conexion.execute("UPDATE auditoria_autenticacion SET detalle = 'editado' WHERE id = ?", [insertado.insertId]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
    await assert.rejects(
      conexion.execute("DELETE FROM auditoria_autenticacion WHERE id = ?", [insertado.insertId]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );

    const [titular] = await conexion.execute(
      `INSERT INTO historial_titulares_vehiculo
         (vehiculo_id, cliente_anterior_id, cliente_nuevo_id, operador_id, motivo)
       VALUES (?, ?, ?, ?, 'registro sintético de prueba')`,
      [ctx.vehiculoId, ctx.clienteId, ctx.clienteId, ctx.operadorId],
    );
    await assert.rejects(
      conexion.execute("UPDATE historial_titulares_vehiculo SET motivo = 'editado' WHERE id = ?", [titular.insertId]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
    await assert.rejects(
      conexion.execute("DELETE FROM historial_titulares_vehiculo WHERE id = ?", [titular.insertId]),
      { code: "ER_SIGNAL_EXCEPTION" },
    );
  } finally {
    conexion.destroy();
  }
});

test("RNF-02/RNF-09: MySQL rechaza campos nulos y períodos distintos de 30 días", { skip: omitir }, async () => {
  const conexion = await conexionTestDb();
  try {
    await assert.rejects(
      conexion.execute(
        `INSERT INTO operadores (nombre, apellidos, documento, email, telefono)
         VALUES ('Operador', NULL, '900000099', 'operador.null@example.test', '3000000099')`,
      ),
      { code: "ER_BAD_NULL_ERROR" },
    );
    await assert.rejects(
      conexion.execute(
        `INSERT INTO vehiculos (cliente_id, placa, tipo, marca, modelo, color)
         VALUES (?, 'REQ111', 'CARRO', NULL, 'Modelo', 'Azul')`,
        [ctx.clienteId],
      ),
      { code: "ER_BAD_NULL_ERROR" },
    );
    await assert.rejects(
      conexion.execute(
        `INSERT INTO suscripciones (vehiculo_id, valor, estado, fecha_inicio, fecha_fin)
         VALUES (?, 10000, 'PROGRAMADA', ?, ?)`,
        [ctx.vehiculoId, ctx.hoy, sumarDias(ctx.hoy, 30)],
      ),
      { code: "ER_CHECK_CONSTRAINT_VIOLATED" },
    );
  } finally {
    conexion.destroy();
  }
});

test("entrada: asigna una celda disponible y audita dentro de la transacción", { skip: omitir }, async () => {
  const { movimientos, auditoria } = ctx.servicios;
  const resultado = await movimientos.registrarEntrada({
    placa: "ABC123", tipo: "CARRO", operadorId: ctx.operadorId,
  });

  assert.ok(resultado.celda, "la entrada debe devolver la celda asignada");

  const conexion = await conexionTestDb();
  const [filas] = await conexion.query(
    "SELECT id, fecha_salida FROM movimientos WHERE vehiculo_id = ? ORDER BY id DESC LIMIT 1",
    [ctx.vehiculoId],
  );
  conexion.destroy();

  assert.equal(filas.length, 1);
  assert.equal(filas[0].fecha_salida, null, "el movimiento debe quedar activo");

  const eventos = await auditoria.consultarAuditoria({ entidad: "MOVIMIENTO", accion: "ENTRADA" });
  assert.ok(eventos.length >= 1, "la entrada debe registrar auditoría ENTRADA");
});

test("entrada: rechaza un vehículo no registrado y no lo crea automáticamente", { skip: omitir }, async () => {
  const { movimientos, vehiculos } = ctx.servicios;
  await assert.rejects(
    movimientos.registrarEntrada({ placa: "XYZ999", tipo: "CARRO", operadorId: ctx.operadorId }),
    /no se encuentra registrado/i,
  );

  const conexion = await conexionTestDb();
  const [filas] = await conexion.query("SELECT id FROM vehiculos WHERE placa = 'XYZ999'");
  conexion.destroy();
  assert.equal(filas.length, 0, "no debe crearse el vehículo desconocido");
  assert.ok(vehiculos, "servicio de vehículos disponible");
});

test("entrada: impide el doble ingreso de un vehículo que ya está parqueado", { skip: omitir }, async () => {
  const { movimientos } = ctx.servicios;
  await assert.rejects(
    movimientos.registrarEntrada({ placa: "ABC123", tipo: "CARRO", operadorId: ctx.operadorId }),
    /ya está parqueado/i,
  );
});

test("salida: registra la salida, libera la celda y audita", { skip: omitir }, async () => {
  const { movimientos, auditoria } = ctx.servicios;
  const resultado = await movimientos.registrarSalida({ placa: "ABC123", operadorId: ctx.operadorId });
  assert.equal(resultado.placa, "ABC123");

  const conexion = await conexionTestDb();
  const [filas] = await conexion.query(
    "SELECT id, fecha_salida, operador_salida_id FROM movimientos WHERE vehiculo_id = ? ORDER BY id DESC LIMIT 1",
    [ctx.vehiculoId],
  );
  conexion.destroy();

  assert.ok(filas[0].fecha_salida, "el movimiento debe quedar finalizado");
  assert.equal(filas[0].operador_salida_id, ctx.operadorId);

  const eventos = await auditoria.consultarAuditoria({ entidad: "MOVIMIENTO", accion: "SALIDA" });
  assert.ok(eventos.length >= 1, "la salida debe registrar auditoría SALIDA");
});

test("salida: rechaza cuando no existe una entrada abierta", { skip: omitir }, async () => {
  const { movimientos } = ctx.servicios;
  await assert.rejects(
    movimientos.registrarSalida({ placa: "ABC123", operadorId: ctx.operadorId }),
    /No hay una entrada abierta/i,
  );
});

test("entrada: exige suscripción vigente", { skip: omitir }, async () => {
  const { clientes, vehiculos, movimientos } = ctx.servicios;
  const cliente = await clientes.registrarClienteConVehiculos(
    {
      cliente: {
        tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "1000000002",
        nombres: "Cliente", apellidos: "Sin Suscripción", correo: "cliente.sin-suscripcion@example.test",
        telefono: "3000000003",
      },
      vehiculos: [{ placa: "DEF456", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Rojo" }],
      autorizacion: true,
    },
    ctx.operadorId,
  );

  await assert.rejects(
    movimientos.registrarEntrada({ placa: "DEF456", tipo: "CARRO", operadorId: ctx.operadorId }),
    /no tiene una suscripción vigente/i,
  );
});

test("suscripción: exige exactamente 30 días calendario y rechaza traslapes", { skip: omitir }, async () => {
  const { suscripciones } = ctx.servicios;

  await assert.rejects(
    suscripciones.crearSuscripcion(
      { vehiculo_id: ctx.vehiculoId, fecha_inicio: ctx.hoy, fecha_fin: sumarDias(ctx.hoy, 28) },
      ctx.operadorId,
    ),
    /30 días calendario/i,
  );

  await assert.rejects(
    suscripciones.crearSuscripcion(
      { vehiculo_id: ctx.vehiculoId, fecha_inicio: ctx.hoy, fecha_fin: ctx.fin30 },
      ctx.operadorId,
    ),
    /se cruza/i,
  );
});

test("anulación: exige motivo y conserva la trazabilidad del movimiento", { skip: omitir }, async () => {
  const { movimientos, adminMov, auditoria } = ctx.servicios;

  const entrada = await movimientos.registrarEntrada({
    placa: "ABC123", tipo: "CARRO", operadorId: ctx.operadorId,
  });

  await assert.rejects(
    adminMov.anularMovimiento(entrada.id, "abc", ctx.operadorId),
    /motivo de anulación/i,
  );

  const anulado = await adminMov.anularMovimiento(entrada.id, "Anulación de prueba con motivo válido", ctx.operadorId);
  assert.equal(anulado.anulado, true);

  const conexion = await conexionTestDb();
  const [filas] = await conexion.query(
    "SELECT anulado_en, motivo_anulacion FROM movimientos WHERE id = ?", [entrada.id],
  );
  conexion.destroy();

  assert.ok(filas[0].anulado_en, "el movimiento debe quedar anulado");
  assert.match(filas[0].motivo_anulacion, /prueba/i);

  await assert.rejects(
    adminMov.anularMovimiento(entrada.id, "Segundo intento de anulación", ctx.operadorId),
    /ya se encuentra anulado/i,
  );

  const eventos = await auditoria.consultarAuditoria({ entidad: "MOVIMIENTO", accion: "ANULAR" });
  assert.ok(eventos.length >= 1, "la anulación debe registrar auditoría ANULAR");
});

test("RF-01: una camioneta ingresa ocupando una celda de tipo CARRO", { skip: omitir }, async () => {
  const { vehiculos, suscripciones, movimientos } = ctx.servicios;

  const camioneta = await vehiculos.crearVehiculo(
    {
      placa: "CAM123", tipo: "CAMIONETA", cliente_id: ctx.clienteId,
      marca: "Marca", modelo: "Modelo", color: "Blanco",
    }, ctx.operadorId,
  );
  const susc = await suscripciones.crearSuscripcion(
    { vehiculo_id: camioneta.id, fecha_inicio: ctx.hoy, fecha_fin: ctx.fin30 }, ctx.operadorId,
  );
  await suscripciones.cambiarEstadoSuscripcion(susc.id, "VIGENTE", ctx.operadorId);

  const entrada = await movimientos.registrarEntrada({
    placa: "CAM123", tipo: "CAMIONETA", operadorId: ctx.operadorId,
  });

  const conexion = await conexionTestDb();
  const [celda] = await conexion.query("SELECT tipo FROM celdas WHERE codigo = ?", [entrada.celda]);
  conexion.destroy();

  assert.equal(celda[0].tipo, "CARRO", "la camioneta debe ocupar una celda de tipo CARRO");
});

test("restricción: no se registran dos vehículos con la misma placa", { skip: omitir }, async () => {
  const { vehiculos } = ctx.servicios;
  await assert.rejects(
    vehiculos.crearVehiculo({
      placa: "abc123", tipo: "CARRO", cliente_id: ctx.clienteId,
      marca: "Marca", modelo: "Modelo", color: "Azul",
    }, ctx.operadorId),
    /Ya existe un vehículo/i,
  );
});

test("RF-23: la ruta de alta transicional rechaza el registro sin vehículo o consentimiento", { skip: omitir }, async () => {
  const { clientes } = ctx.servicios;
  const cliente = {
    tipo_cliente: "PERSONA",
    tipo_documento: "CC",
    numero_documento: "1000000099",
    nombres: "Cliente",
    apellidos: "Incompleto",
    correo: "cliente.incompleto@example.test",
    telefono: "3000000099",
  };
  const vehiculo = { placa: "ZZZ999", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Gris" };

  await assert.rejects(
    clientes.crearCliente(cliente, ctx.operadorId),
    { status: 400 },
  );
  await assert.rejects(
    clientes.crearCliente({ ...cliente, vehiculos: [vehiculo] }, ctx.operadorId),
    { status: 400 },
  );

  const conexion = await conexionTestDb();
  const [filas] = await conexion.query(
    "SELECT id FROM clientes WHERE numero_documento = ?", [cliente.numero_documento],
  );
  conexion.destroy();
  assert.equal(filas.length, 0, "las solicitudes rechazadas no deben insertar clientes");
});

test("atomicidad: el registro de cliente + vehículos revierte todo si un vehículo es inválido", { skip: omitir }, async () => {
  const { clientes } = ctx.servicios;

  await assert.rejects(
    clientes.registrarClienteConVehiculos(
      {
        cliente: {
          tipo_cliente: "PERSONA", tipo_documento: "CC",
          numero_documento: "1000000003", nombres: "Cliente", apellidos: "Atómico",
          correo: "cliente.atomico@example.test", telefono: "3000000004",
        },
        vehiculos: [
          { placa: "AAA111", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Verde" },
          { placa: "INVALIDA", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Negro" },
        ],
        autorizacion: true,
      },
      ctx.operadorId,
    ),
  );

  const conexion = await conexionTestDb();
  const [clientesCreados] = await conexion.query(
    "SELECT id FROM clientes WHERE numero_documento = '1000000003'",
  );
  const [vehiculosCreados] = await conexion.query("SELECT id FROM vehiculos WHERE placa = 'AAA111'");
  conexion.destroy();

  assert.equal(clientesCreados.length, 0, "el cliente debe revertirse por atomicidad (RNF-10)");
  assert.equal(vehiculosCreados.length, 0, "el vehículo válido tampoco debe persistir");
});

test("consentimiento: el texto false no permite crear cliente ni vehículo", { skip: omitir }, async () => {
  const { clientes } = ctx.servicios;
  await assert.rejects(
    clientes.registrarClienteConVehiculos(
      {
        cliente: {
          tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "1000000004",
          nombres: "Cliente", apellidos: "Sin Consentimiento",
          correo: "cliente.sin-consentimiento@example.test", telefono: "3000000005",
        },
        vehiculos: [{ placa: "BBB222", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Negro" }],
        autorizacion: "false",
      },
      ctx.operadorId,
    ),
    { status: 400 },
  );

  const conexion = await conexionTestDb();
  const [clientesCreados] = await conexion.query(
    "SELECT id FROM clientes WHERE numero_documento = ?", ["1000000004"],
  );
  const [vehiculosCreados] = await conexion.query(
    "SELECT id FROM vehiculos WHERE placa = ?", ["BBB222"],
  );
  conexion.destroy();

  assert.equal(clientesCreados.length, 0);
  assert.equal(vehiculosCreados.length, 0);
});

test("consentimiento: revocar autorización actualiza y audita el valor anterior y nuevo", { skip: omitir }, async () => {
  const { clientes } = ctx.servicios;
  const cliente = await clientes.registrarClienteConVehiculos(
    {
      cliente: {
        tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "1000000005",
        nombres: "Cliente", apellidos: "Revocación",
        correo: "cliente.revocacion@example.test", telefono: "3000000006",
      },
      vehiculos: [{ placa: "CCC333", tipo: "CARRO", marca: "Marca", modelo: "Modelo", color: "Blanco" }],
      autorizacion: true,
    },
    ctx.operadorId,
  );

  await clientes.actualizarCliente(cliente.id, {
    tipo_cliente: "PERSONA", tipo_documento: "CC", numero_documento: "1000000005",
    nombres: "Cliente", apellidos: "Revocación",
    correo: "cliente.revocacion@example.test", telefono: "3000000006",
    autorizacion_datos: "false",
  }, ctx.operadorId);

  const conexion = await conexionTestDb();
  const [[actual]] = await conexion.query(
    "SELECT autorizacion_datos, autorizacion_fecha FROM clientes WHERE id = ?", [cliente.id],
  );
  const [[evento]] = await conexion.query(
    "SELECT valor_anterior, valor_nuevo FROM auditoria_eventos WHERE entidad = 'CLIENTE' AND entidad_id = ? AND accion = 'MODIFICAR_CLIENTE' ORDER BY id DESC LIMIT 1",
    [cliente.id],
  );
  conexion.destroy();

  const anterior = typeof evento.valor_anterior === "string"
    ? JSON.parse(evento.valor_anterior)
    : evento.valor_anterior;
  const nuevo = typeof evento.valor_nuevo === "string"
    ? JSON.parse(evento.valor_nuevo)
    : evento.valor_nuevo;
  assert.equal(Number(actual.autorizacion_datos), 0);
  assert.equal(actual.autorizacion_fecha, null);
  assert.equal(anterior.autorizacion_datos, true);
  assert.equal(nuevo.autorizacion_datos, false);
  assert.equal(nuevo.autorizacion_fecha, null);
});
