-- AutosColombia - Iteración 2: alineación de la nomenclatura de estados de suscripción
-- con el documento oficial EA2 (RF-28): PROGRAMADA / VIGENTE / VENCIDA / CANCELADA.
-- Paso 6 de 7 del orden de instalación limpia (ver backend/sql/schema.sql).
-- Migración ADITIVA e IDEMPOTENTE: amplía el ENUM, traduce los valores de la nomenclatura
-- anterior (PENDIENTE -> PROGRAMADA, ACTIVA -> VIGENTE) y fija la definición definitiva.
-- No elimina filas, columnas ni índices y conserva las reglas de duración y traslapes.
USE autoscolombia;

SET @db := DATABASE();

-- 1) Ampliar el ENUM para admitir ambas nomenclaturas mientras se traducen los valores.
--    Guarda: sólo se ejecuta si la definición actual todavía contiene la nomenclatura anterior.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'suscripciones' AND COLUMN_NAME = 'estado'
      AND COLUMN_TYPE LIKE '%PENDIENTE%') > 0,
  "ALTER TABLE suscripciones MODIFY COLUMN estado ENUM('PENDIENTE','ACTIVA','PROGRAMADA','VIGENTE','VENCIDA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Traducir los valores existentes a la nomenclatura del documento (sin perder filas).
UPDATE suscripciones SET estado = 'PROGRAMADA' WHERE estado = 'PENDIENTE';
UPDATE suscripciones SET estado = 'VIGENTE'   WHERE estado = 'ACTIVA';

-- 3) Fijar la definición definitiva del ENUM.
--    Guarda: sólo se ejecuta si aún queda la nomenclatura anterior.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'suscripciones' AND COLUMN_NAME = 'estado'
      AND (COLUMN_TYPE LIKE '%PENDIENTE%' OR COLUMN_TYPE LIKE '%ACTIVA%')) > 0,
  "ALTER TABLE suscripciones MODIFY COLUMN estado ENUM('PROGRAMADA','VIGENTE','VENCIDA','CANCELADA') NOT NULL DEFAULT 'PROGRAMADA'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
