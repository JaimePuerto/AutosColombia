// Acceso a la base efímera del arnés E2E mediante el cliente `mysql`.
// No se importa `mysql2` desde el frontend: se usa el ejecutable del servidor MySQL.

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { credencialesMysql, localizarMysql, rutaArchivo, SCRIPTS } from "./env.js";

export function construirCliente() {
  const cliente = localizarMysql();
  if (!cliente) {
    throw new Error("No se encontró el cliente `mysql`. Configure MYSQL_BIN o instálelo en el PATH.");
  }
  return cliente;
}

function opcionesBase() {
  const { host, port, user, password } = credencialesMysql();
  return { host, port, user, password };
}

// Ejecuta SQL libre y devuelve las filas como arreglos de texto.
export function ejecutarSql(dbName, sql) {
  const cliente = construirCliente();
  const { host, port, user, password } = opcionesBase();
  const resultado = spawnSync(
    cliente,
    [
      "--host", host,
      "--port", port,
      "--user", user,
      "--batch", "--raw", "--skip-column-names",
      "--default-character-set=utf8mb4",
      dbName,
      "-e", sql,
    ],
    { env: { ...process.env, MYSQL_PWD: password }, encoding: "utf8" },
  );

  if (resultado.status !== 0) {
    throw new Error(`SQL falló: ${(resultado.stderr || resultado.stdout || "").trim()}`);
  }

  const salida = (resultado.stdout || "").replace(/\r/g, "").trim();
  if (!salida) return [];
  return salida.split("\n").map((linea) => linea.split("\t"));
}

// Devuelve el primer valor (primera fila, primera columna) como texto.
export function primerValor(dbName, sql) {
  const filas = ejecutarSql(dbName, sql);
  return filas.length ? filas[0][0] : null;
}

export function contar(dbName, tabla, condicion = "") {
  const where = condicion ? ` WHERE ${condicion}` : "";
  return Number(primerValor(dbName, `SELECT COUNT(*) FROM ${tabla}${where}`));
}

function ejecutarAdmin(sql) {
  const cliente = construirCliente();
  const { host, port, user, password } = opcionesBase();
  const resultado = spawnSync(
    cliente,
    ["--host", host, "--port", port, "--user", user, "--default-character-set=utf8mb4", "-e", sql],
    { env: { ...process.env, MYSQL_PWD: password }, encoding: "utf8" },
  );

  if (resultado.status !== 0) {
    throw new Error(`SQL administrativo falló: ${(resultado.stderr || resultado.stdout || "").trim()}`);
  }
  return resultado.stdout || "";
}

export function crearBase(dbName) {
  ejecutarAdmin(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
  ejecutarAdmin(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
}

export function eliminarBase(dbName) {
  ejecutarAdmin(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
}

export function aplicarScripts(dbName) {
  const cliente = construirCliente();
  const { host, port, user, password } = opcionesBase();

  for (const script of SCRIPTS) {
    const sql = fs.readFileSync(rutaArchivo(script), "utf8").replace(/autoscolombia/g, dbName);
    const resultado = spawnSync(
      cliente,
      ["--host", host, "--port", port, "--user", user, "--default-character-set=utf8mb4"],
      { input: sql, env: { ...process.env, MYSQL_PWD: password }, encoding: "utf8" },
    );

    if (resultado.status !== 0) {
      throw new Error(
        `No fue posible aplicar ${script}: ${(resultado.stderr || resultado.stdout || "").trim()}`,
      );
    }
  }
}

export { SCRIPTS };
