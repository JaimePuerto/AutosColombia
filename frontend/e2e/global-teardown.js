// Desmontaje global: detiene el backend y el servidor web de prueba y elimina la base efímera.
// Nunca toca la base real `autoscolombia`.

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { STATE_FILE } from "./support/env.js";
import { eliminarBase } from "./support/database.js";

function terminarArbol(pid) {
  if (!pid) return;
  spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { encoding: "utf8" });
}

export default async function globalTeardown() {
  if (!fs.existsSync(STATE_FILE)) return;

  let estado;
  try {
    estado = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return;
  }

  terminarArbol(estado.webPid);
  terminarArbol(estado.backendPid);

  try {
    eliminarBase(estado.dbName);
    console.log(`[e2e] Base efímera eliminada: ${estado.dbName}`);
  } catch (error) {
    console.warn(`[e2e] No fue posible eliminar ${estado.dbName}: ${error.message}`);
  }
}
