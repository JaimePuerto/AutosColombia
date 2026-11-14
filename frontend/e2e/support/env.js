// Configuración compartida del arnés E2E de AutosColombia (Iteración 2).
//
// El arnés NUNCA usa la base real `autoscolombia`:
//   - crea una base efímera `autoscolombia_e2e_<pid>`;
//   - levanta un backend propio en un puerto aislado;
//   - intercepta en el navegador cualquier llamada a localhost:3001 y la redirige
//     al backend de pruebas, abortando si la redirección no es posible.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const supportDir = path.dirname(fileURLToPath(import.meta.url));

export const FRONTEND_DIR = path.resolve(supportDir, "..", "..");
export const PROJECT_DIR = path.resolve(FRONTEND_DIR, "..");
export const BACKEND_DIR = path.join(PROJECT_DIR, "backend");
export const SQL_DIR = path.join(BACKEND_DIR, "sql");
export const ARTIFACTS_DIR = path.join(FRONTEND_DIR, "e2e", ".artifacts");
export const EVIDENCE_DIR = path.join(PROJECT_DIR, "Documentacion", "Evidencias", "Iteracion_2");

export const BACKEND_LOG = path.join(ARTIFACTS_DIR, "backend.log");
export const WEB_LOG = path.join(ARTIFACTS_DIR, "frontend.log");
export const STATE_FILE = path.join(ARTIFACTS_DIR, "estado.json");

export const API_PORT = Number(process.env.E2E_API_PORT || 3311);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5219);
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

// Mismo orden de instalación limpia documentado en `Documentacion/07_Orden_Migraciones.md`.
// La migración 011 (conciliación de mensualidades a 30 días) precede a 010: así la
// restricción `chk_suscripcion_30_dias` de 010 se valida sobre datos ya normalizados.
// En una instalación limpia 011 se ejecuta sin efectos.
export const SCRIPTS = [
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

// Credenciales de prueba usadas por los escenarios M-01…M-18.
export const CREDENCIALES = {
  adminDocumento: "1000001",
  adminPassword: "AdminE2E2026",
  operadorDocumento: "1000002",
  operadorPassword: "OperE2E2026",
};

// Lee `backend/.env` sin sobrescribir variables ya definidas en el entorno.
export function cargarEnvBackend() {
  const archivo = path.join(BACKEND_DIR, ".env");
  if (!fs.existsSync(archivo)) return false;

  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;

    const indice = limpia.indexOf("=");
    if (indice === -1) continue;

    const clave = limpia.slice(0, indice).trim();
    let valor = limpia.slice(indice + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (process.env[clave] === undefined) process.env[clave] = valor;
  }

  return true;
}

// Credenciales administrativas de MySQL. El arnés crea una base efímera y aplica
// migraciones (DDL), por lo que requiere una cuenta con privilegios administrativos.
// Prefiere DB_ADMIN_* y, si no existen, cae a DB_USER/DB_PASSWORD.
export function credencialesMysqlAdmin() {
  return {
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD,
  };
}

export function credencialesMysql() {
  const { user, password } = credencialesMysqlAdmin();
  return {
    host: process.env.DB_HOST || "localhost",
    port: String(process.env.DB_PORT || 3306),
    user,
    password,
  };
}

// Localiza el cliente `mysql` (necesario para aplicar scripts con DELIMITER).
export function localizarMysql() {
  const candidatos = [
    process.env.MYSQL_BIN,
    "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
    "C:\\xampp\\mysql\\bin\\mysql.exe",
  ].filter(Boolean);

  for (const candidato of candidatos) {
    if (fs.existsSync(candidato)) return candidato;
  }

  const enPath = spawnSync("mysql", ["--version"], { encoding: "utf8" });
  return enPath.status === 0 ? "mysql" : null;
}

export function rutaArchivo(rutaRelativa) {
  return path.join(SQL_DIR, rutaRelativa);
}
