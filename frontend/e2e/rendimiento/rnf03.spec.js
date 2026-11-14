// RNF-03 · Benchmark de rendimiento (hallazgo H-08).
//
// Condiciones definidas y documentadas en `Documentacion/09_Matriz_Pruebas.md`:
//   - Consulta funcional evaluada: historial de movimientos (GET /api/movimientos?limite=200),
//     la lectura más costosa de la operación diaria (4 JOIN + ORDER BY + LIMIT).
//     Se reportan además el panel (GET /api/dashboard) y la auditoría
//     (GET /api/auditoria/eventos?limite=100) como referencias complementarias.
//   - Volumen: 400 vehículos, 4.000 movimientos finalizados, 4.000 eventos de auditoría
//     y 400 suscripciones sintéticas; 80 celdas del esquema.
//   - Concurrencia: 1 (secuencial) y 10 (paralela).
//   - Percentil: p95 y p100 (máximo).
//   - Entorno: equipo local del desarrollador, MySQL 8.4, Node 24, backend en 3311,
//     base efímera `autoscolombia_e2e_<pid>`. Nunca la base real `autoscolombia`.
//   - Límite EA2 (RNF-03): 3.000 ms por consulta.
//
// El benchmark no reemplaza la puerta funcional: se ejecuta con
// `npm run rendimiento:rnf03` desde `frontend`.

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { API_ORIGIN, ARTIFACTS_DIR, CREDENCIALES } from "../support/env.js";
import { api, db, entrarPorApi } from "../support/fixtures.js";

const LIMITE_EA2_MS = 3000;
const CALENTAMIENTO = 5;
const ITERACIONES = 50;
const TAMANO_LOTE_CONCURRENTE = 10;
const LOTES_CONCURRENTES = 5;

const VOLUMEN = { clientes: 400, vehiculos: 400, movimientos: 4000, suscripciones: 400 };

// Consulta representativa del historial, sin filtros (peor caso de lectura).
const CONSULTA_HISTORIAL = `SELECT
    m.id,
    v.placa,
    v.tipo,
    m.celda_id,
    COALESCE(m.codigo_celda_snapshot, c.codigo) AS celda,
    COALESCE(m.tipo_celda_snapshot, c.tipo) AS tipo_celda,
    m.codigo_celda_snapshot,
    m.tipo_celda_snapshot,
    m.fecha_entrada,
    m.fecha_salida,
    m.acceso_entrada,
    m.acceso_salida,
    m.observaciones,
    m.operador_entrada_id,
    m.operador_salida_id,
    oe.nombre AS operador_entrada,
    os.nombre AS operador_salida,
    m.anulado_en,
    m.motivo_anulacion
  FROM movimientos m
  INNER JOIN vehiculos v ON v.id = m.vehiculo_id
  LEFT JOIN celdas c ON c.id = m.celda_id
  LEFT JOIN operadores oe ON oe.id = m.operador_entrada_id
  LEFT JOIN operadores os ON os.id = m.operador_salida_id
  ORDER BY m.fecha_entrada DESC, m.id DESC
  LIMIT 200`;

function construirSemilla() {
  const { clientes, vehiculos, movimientos, suscripciones } = VOLUMEN;
  return [
    // El CTE recursivo supera el tope por defecto (1.000) al generar los movimientos.
    "SET SESSION cte_max_recursion_depth = 20000",
    // Los identificadores de celda no son contiguos tras las migraciones (los ALTER TABLE
    // de 004/010 recrean la tabla y saltan ids): se resuelven por posición mediante una
    // tabla temporal, no por aritmética sobre el id.
    `CREATE TEMPORARY TABLE mapa_celdas (
       posicion INT PRIMARY KEY, celda_id INT UNSIGNED NOT NULL, codigo VARCHAR(20) NOT NULL)`,
    `INSERT INTO mapa_celdas (posicion, celda_id, codigo)
     SELECT ROW_NUMBER() OVER (ORDER BY id), id, codigo FROM celdas WHERE tipo = 'CARRO'`,
    "SET @totalCeldas := (SELECT COUNT(*) FROM mapa_celdas)",
    `INSERT INTO clientes
       (tipo_cliente, tipo_documento, numero_documento, nombre_razon_social,
        nombres, apellidos, telefono, correo, direccion, autorizacion_datos)
     WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < ${clientes})
     SELECT 'PERSONA', 'CC', CONCAT('90', LPAD(i, 8, '0')), CONCAT('Cliente sintético ', i),
            CONCAT('Cliente', i), 'Sintético', '3000000000',
            CONCAT('cliente', i, '@example.test'), 'Calle 1 # 2-3', 1
     FROM n`,
    `INSERT INTO vehiculos (cliente_id, placa, tipo, marca, modelo, color, anio)
     WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < ${vehiculos})
     SELECT i, CONCAT('PRF', LPAD(i, 4, '0')), 'CARRO', 'Marca sintética',
            'Modelo sintético', 'Gris', 2020
     FROM n`,
    // La restricción de EA2 exige períodos de exactamente 30 días (fecha_fin = inicio + 29).
    `INSERT INTO suscripciones (vehiculo_id, valor, estado, fecha_inicio, fecha_fin)
     WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < ${suscripciones})
     SELECT i, 120000, 'VENCIDA',
            DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 31 DAY) FROM n`,
    // Movimientos finalizados: no ocupan celda ni vehículo, así el volumen no rompe
    // las restricciones de unicidad de movimientos activos.
    `INSERT INTO movimientos
       (vehiculo_id, celda_id, operador_entrada_id, operador_salida_id,
        acceso_entrada, acceso_salida, fecha_entrada, fecha_salida,
        codigo_celda_snapshot, tipo_celda_snapshot)
     WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < ${movimientos})
     SELECT ((i - 1) % ${vehiculos}) + 1,
            mc.celda_id,
            1, 2, 'PRINCIPAL', 'PRINCIPAL',
            DATE_SUB(NOW(), INTERVAL (i * 60) MINUTE),
            DATE_SUB(NOW(), INTERVAL (i * 60 - 180) MINUTE),
            mc.codigo,
            'CARRO'
     FROM n
     JOIN mapa_celdas mc ON mc.posicion = ((i - 1) % @totalCeldas) + 1`,
    `INSERT INTO auditoria_eventos (operador_id, entidad, entidad_id, accion, motivo, fecha_hora)
     WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < ${movimientos})
     SELECT 1, 'MOVIMIENTO', i, 'ENTRADA', 'Carga sintética de rendimiento',
            DATE_SUB(NOW(), INTERVAL (i * 60) MINUTE) FROM n`,
    "ANALYZE TABLE movimientos, vehiculos, celdas, operadores, auditoria_eventos",
  ].join(";\n");
}

function percentil(valores, p) {
  const orden = [...valores].sort((a, b) => a - b);
  const indice = Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1);
  return orden[Math.max(indice, 0)];
}

function resumir(valores) {
  const suma = valores.reduce((total, valor) => total + valor, 0);
  return {
    iteraciones: valores.length,
    mediaMs: Number((suma / valores.length).toFixed(2)),
    p50Ms: Number(percentil(valores, 50).toFixed(2)),
    p95Ms: Number(percentil(valores, 95).toFixed(2)),
    maxMs: Number(Math.max(...valores).toFixed(2)),
  };
}

async function medirConcurrencia(token, ruta, peso, lotes) {
  const latencias = [];
  for (let lote = 0; lote < lotes; lote += 1) {
    const promesas = Array.from({ length: peso }, async () => {
      const inicio = performance.now();
      const respuesta = await api("GET", ruta, { token });
      const duracion = performance.now() - inicio;
      expect(respuesta.status).toBe(200);
      latencias.push(duracion);
    });
    await Promise.all(promesas);
  }
  return latencias;
}

test("RNF-03 · benchmark de consultas funcionales con datos sintéticos", async () => {
  const base = db();

  // --- Datos sintéticos ----------------------------------------------------------------
  base.filas(construirSemilla());
  const totalMovimientos = Number(base.valor("SELECT COUNT(*) FROM movimientos"));
  expect(totalMovimientos).toBe(VOLUMEN.movimientos);

  const token = await entrarPorApi(CREDENCIALES.adminDocumento, CREDENCIALES.adminPassword);

  // --- Calentamiento (se descarta) ------------------------------------------------------
  for (let i = 0; i < CALENTAMIENTO; i += 1) {
    await api("GET", "/movimientos?limite=200", { token });
  }

  // --- Concurrencia 1 -------------------------------------------------------------------
  const secuencialHistorial = [];
  for (let i = 0; i < ITERACIONES; i += 1) {
    const inicio = performance.now();
    const respuesta = await api("GET", "/movimientos?limite=200", { token });
    secuencialHistorial.push(performance.now() - inicio);
    expect(respuesta.status).toBe(200);
    expect(respuesta.json.data.length).toBe(200);
  }

  // --- Tiempo de consulta SQL (plan real con EXPLAIN ANALYZE) ---------------------------
  const plan = base.filas(`EXPLAIN ANALYZE ${CONSULTA_HISTORIAL}`)
    .map((fila) => fila.join(" "))
    .join("\n");
  const coincidencia = plan.match(/actual time=([\d.]+)\.\.([\d.]+)/);
  expect(coincidencia, "EXPLAIN ANALYZE no reportó tiempos").not.toBeNull();
  const tiempoSqlMs = Number(Number(coincidencia[2]).toFixed(2));

  // --- Concurrencia 10 ------------------------------------------------------------------
  const concurrenteHistorial = await medirConcurrencia(
    token,
    "/movimientos?limite=200",
    TAMANO_LOTE_CONCURRENTE,
    LOTES_CONCURRENTES,
  );

  // --- Referencias complementarias (concurrencia 1) --------------------------------------
  const panel = [];
  for (let i = 0; i < 10; i += 1) {
    const inicio = performance.now();
    const respuesta = await api("GET", "/dashboard", { token });
    panel.push(performance.now() - inicio);
    expect(respuesta.status).toBe(200);
  }

  const reporte = {
    generadoEn: new Date().toISOString(),
    limiteEa2Ms: LIMITE_EA2_MS,
    entorno: {
      base: base.nombre,
      api: API_ORIGIN,
      consultaEvaluada: "GET /api/movimientos?limite=200 (historial de movimientos)",
      percentil: "p95",
      metodoSql: "EXPLAIN ANALYZE (tiempo real del plan)",
    },
    volumen: {
      clientes: Number(base.valor("SELECT COUNT(*) FROM clientes")),
      vehiculos: VOLUMEN.vehiculos,
      movimientos: totalMovimientos,
      eventosAuditoria: Number(base.valor("SELECT COUNT(*) FROM auditoria_eventos")),
      suscripciones: Number(base.valor("SELECT COUNT(*) FROM suscripciones")),
      celdas: Number(base.valor("SELECT COUNT(*) FROM celdas")),
    },
    calentamiento: CALENTAMIENTO,
    historialSecuencialC1: resumir(secuencialHistorial),
    historialConcurrenteC10: resumir(concurrenteHistorial),
    panelC1: resumir(panel),
    tiempoSqlMs,
    plan: plan.split("\n").slice(0, 12),
  };

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const destino = path.join(ARTIFACTS_DIR, "rnf03-rendimiento.json");
  fs.writeFileSync(destino, JSON.stringify(reporte, null, 2));

  console.log("\n[e2e] Informe RNF-03:", destino);
  console.log(
    `[e2e] Historial C1  → p50 ${reporte.historialSecuencialC1.p50Ms} ms · p95 ${reporte.historialSecuencialC1.p95Ms} ms · máx ${reporte.historialSecuencialC1.maxMs} ms`,
  );
  console.log(
    `[e2e] Historial C10 → p50 ${reporte.historialConcurrenteC10.p50Ms} ms · p95 ${reporte.historialConcurrenteC10.p95Ms} ms · máx ${reporte.historialConcurrenteC10.maxMs} ms`,
  );
  console.log(`[e2e] Tiempo SQL (plan real) → ${tiempoSqlMs} ms`);

  expect(reporte.historialSecuencialC1.p95Ms).toBeLessThan(LIMITE_EA2_MS);
  expect(reporte.historialConcurrenteC10.p95Ms).toBeLessThan(LIMITE_EA2_MS);
  expect(tiempoSqlMs).toBeLessThan(LIMITE_EA2_MS);
});
