// Preparación global del arnés E2E:
//   1) crea una base efímera y aplica schema.sql + migraciones 002..010;
//   2) siembra un administrador y un operador de prueba;
//   3) levanta un backend propio (puerto aislado) apuntando a esa base;
//   4) levanta un servidor Vite propio para la interfaz;
//   5) guarda el estado para el desmontaje.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  API_PORT,
  API_ORIGIN,
  ARTIFACTS_DIR,
  BACKEND_DIR,
  BACKEND_LOG,
  CREDENCIALES,
  FRONTEND_DIR,
  STATE_FILE,
  WEB_LOG,
  WEB_ORIGIN,
  WEB_PORT,
  cargarEnvBackend,
  credencialesMysqlAdmin,
} from "./support/env.js";
import { aplicarScripts, crearBase, eliminarBase, ejecutarSql } from "./support/database.js";
import { generarHashPassword } from "./support/passwords.js";

const hijos = [];

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarHttp(url, etiqueta, intentos = 60) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const respuesta = await fetch(url);
      if (respuesta.ok) return;
    } catch { /* aún no responde */ }
    await dormir(1000);
  }
  throw new Error(`El servicio ${etiqueta} no respondió en ${url} tras ${intentos} intentos.`);
}

function ultimasLineas(archivo, cantidad = 25) {
  try {
    return fs.readFileSync(archivo, "utf8").split(/\r?\n/).slice(-cantidad).join("\n");
  } catch {
    return "(sin registro disponible)";
  }
}

function arrancar(nombre, comando, argumentos, cwd, env, archivoLog) {
  const flujo = fs.createWriteStream(archivoLog, { flags: "w" });
  const hijo = spawn(comando, argumentos, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  hijo.stdout.pipe(flujo);
  hijo.stderr.pipe(flujo);
  hijo.on("exit", (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      console.error(`[e2e] ${nombre} terminó con código ${codigo}.`);
    }
  });

  hijos.push(hijo);
  return hijo;
}

export default async function globalSetup() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  cargarEnvBackend();

  const dbName = `autoscolombia_e2e_${process.pid}`;
  const estado = {
    dbName,
    apiPort: API_PORT,
    webPort: WEB_PORT,
    apiOrigin: API_ORIGIN,
    webOrigin: WEB_ORIGIN,
    backendPid: null,
    webPid: null,
    creadoEn: new Date().toISOString(),
  };

  try {
    crearBase(dbName);
    aplicarScripts(dbName);

    const hashAdmin = generarHashPassword(CREDENCIALES.adminPassword);
    const hashOperador = generarHashPassword(CREDENCIALES.operadorPassword);
    ejecutarSql(
      dbName,
      `INSERT INTO operadores
         (nombre, apellidos, documento, email, password_hash, password_temporal, telefono, rol, estado, activo)
       VALUES
         ('Administrador', 'Arnés E2E', '${CREDENCIALES.adminDocumento}', 'admin.e2e@example.test', '${hashAdmin}', 0, '3000000001', 'ADMINISTRADOR', 'ACTIVO', 1),
         ('Operador', 'Arnés E2E', '${CREDENCIALES.operadorDocumento}', 'operador.e2e@example.test', '${hashOperador}', 0, '3000000002', 'OPERADOR', 'ACTIVO', 1)`,
    );

    const credencialesAdmin = credencialesMysqlAdmin();
    const backend = arrancar(
      "backend",
      process.execPath,
      ["src/app.js"],
      BACKEND_DIR,
      {
        ...process.env,
        DB_USER: credencialesAdmin.user,
        DB_PASSWORD: credencialesAdmin.password,
        DB_NAME: dbName,
        PORT: String(API_PORT),
        MAIL_PROVIDER: "consola",
        APP_BASE_URL: WEB_ORIGIN,
      },
      BACKEND_LOG,
    );
    estado.backendPid = backend.pid;

    const viteBin = path.join(FRONTEND_DIR, "node_modules", "vite", "bin", "vite.js");
    const web = arrancar(
      "vite",
      process.execPath,
      [viteBin, "--host", "127.0.0.1", "--port", String(WEB_PORT), "--strictPort"],
      FRONTEND_DIR,
      { ...process.env },
      WEB_LOG,
    );
    estado.webPid = web.pid;

    await esperarHttp(`${API_ORIGIN}/api/health`, "backend de pruebas");
    await esperarHttp(`${WEB_ORIGIN}/`, "servidor Vite");

    fs.writeFileSync(STATE_FILE, JSON.stringify(estado, null, 2));
    console.log(`[e2e] Base efímera: ${dbName}`);
    console.log(`[e2e] Backend de pruebas: ${API_ORIGIN}  ·  Interfaz: ${WEB_ORIGIN}`);
  } catch (error) {
    console.error("[e2e] Falló la preparación:", error.message);
    console.error("[e2e] Últimas líneas del backend:\n" + ultimasLineas(BACKEND_LOG));
    console.error("[e2e] Últimas líneas del servidor web:\n" + ultimasLineas(WEB_LOG));
    for (const hijo of hijos) {
      try { hijo.kill(); } catch { /* ya terminó */ }
    }
    try { eliminarBase(dbName); } catch { /* limpieza best-effort */ }
    throw error;
  }
}
