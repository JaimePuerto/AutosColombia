// Aprovisiona las cuentas MySQL de AutosColombia separando privilegios:
//   * Cuenta administrativa: ejecuta migraciones (DDL). Se usa solo en mantenimiento.
//   * Cuenta de ejecución: la que usa el backend en runtime, con mínimo privilegio.
//
// La cuenta de ejecución recibe privilegios POR TABLA: sobre las tablas de auditoría e
// históricos solo obtiene SELECT e INSERT, por lo que no puede modificarlas ni eliminarlas
// (append-only) a nivel de privilegios, como defensa en profundidad frente a los triggers
// de la migración 009.
//
// Uso (las contraseñas se leen de variables de entorno y NUNCA se versionan):
//   DB_ADMIN_USER=root DB_ADMIN_PASSWORD='...' \
//   ADMIN_DB_USER=autoscolombia_admin ADMIN_DB_PASSWORD='...' \
//   APP_DB_USER=autoscolombia_app APP_DB_PASSWORD='...' \
//   npm run crear-usuarios-bd
//
// Requiere que el esquema ya exista (las tablas determinan los privilegios). Conectar como
// root/DBA es necesario para crear usuarios; en operación normal el backend usa solo APP_DB_USER.
import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME || "autoscolombia";

const ADMIN_CONN = {
  host: HOST,
  port: PORT,
  user: process.env.DB_ADMIN_USER || "root",
  password: process.env.DB_ADMIN_PASSWORD,
};

const ADMIN_USER = process.env.ADMIN_DB_USER || "autoscolombia_admin";
const ADMIN_PASSWORD = process.env.ADMIN_DB_PASSWORD;
const APP_USER = process.env.APP_DB_USER || "autoscolombia_app";
const APP_PASSWORD = process.env.APP_DB_PASSWORD;

// Tablas de auditoría e históricos (append-only): la cuenta de ejecución no puede
// modificarlas ni eliminarlas.
const TABLAS_APPEND_ONLY = new Set([
  "auditoria_eventos",
  "auditoria_autenticacion",
  "historial_celdas",
  "historial_titulares_vehiculo",
]);

const HOSTS = ["localhost", "127.0.0.1"];

function validar() {
  if (!APP_PASSWORD || !ADMIN_PASSWORD) {
    throw new Error(
      "Defina APP_DB_PASSWORD y ADMIN_DB_PASSWORD (y el acceso DBA en DB_ADMIN_USER/DB_ADMIN_PASSWORD).",
    );
  }
  if (/\s/.test(APP_PASSWORD) || APP_PASSWORD.length < 10) {
    throw new Error("La contraseña de ejecución requiere >=10 caracteres sin espacios.");
  }
  if (/\s/.test(ADMIN_PASSWORD) || ADMIN_PASSWORD.length < 12) {
    throw new Error("La contraseña administrativa requiere >=12 caracteres sin espacios.");
  }
}

async function aprovisionar() {
  validar();
  const conexion = await mysql.createConnection(ADMIN_CONN);
  try {
    const [tablas] = await conexion.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [DB_NAME],
    );
    if (!tablas.length) {
      throw new Error(
        `La base \`${DB_NAME}\` no tiene tablas. Instale el esquema (schema.sql + migraciones) antes de aprovisionar.`,
      );
    }

    for (const host of HOSTS) {
      // Recreación limpia: garantiza idempotencia y ausencia de privilegios heredados.
      await conexion.query(`DROP USER IF EXISTS ?@?`, [ADMIN_USER, host]);
      await conexion.query(`DROP USER IF EXISTS ?@?`, [APP_USER, host]);
      await conexion.query(`CREATE USER ?@? IDENTIFIED BY ?`, [ADMIN_USER, host, ADMIN_PASSWORD]);
      await conexion.query(`CREATE USER ?@? IDENTIFIED BY ?`, [APP_USER, host, APP_PASSWORD]);

      // Cuenta administrativa: DDL sobre el esquema (solo mantenimiento/migraciones).
      await conexion.query(`GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO ?@?`, [ADMIN_USER, host]);

      // Cuenta de ejecución: DML por tabla; sin UPDATE/DELETE en las tablas append-only.
      for (const { TABLE_NAME: tabla } of tablas) {
        const privilegios = TABLAS_APPEND_ONLY.has(tabla)
          ? "SELECT, INSERT"
          : "SELECT, INSERT, UPDATE, DELETE";
        await conexion.query(`GRANT ${privilegios} ON \`${DB_NAME}\`.\`${tabla}\` TO ?@?`, [APP_USER, host]);
      }
    }

    await conexion.query("FLUSH PRIVILEGES");

    const [grants] = await conexion.query(`SHOW GRANTS FOR ?@?`, [APP_USER, "localhost"]);
    console.log(`Cuentas aprovisionadas en ${HOST}:${PORT} sobre la base \`${DB_NAME}\`.`);
    console.log(`Tablas con privilegios restringidos (solo SELECT, INSERT): ${[...TABLAS_APPEND_ONLY].join(", ")}`);
    console.log(`\nPrivilegios efectivos de ${APP_USER}@localhost:`);
    for (const fila of grants.slice(0, 6)) console.log("  " + Object.values(fila)[0]);
    console.log(`  ... (${grants.length} grants en total)`);
  } finally {
    await conexion.end();
  }
}

aprovisionar()
  .then(() => console.log("\nListo. Configure DB_USER/DB_PASSWORD del backend con la cuenta de ejecución."))
  .catch((error) => {
    console.error(`No fue posible aprovisionar las cuentas: ${error.message}`);
    process.exitCode = 1;
  });
