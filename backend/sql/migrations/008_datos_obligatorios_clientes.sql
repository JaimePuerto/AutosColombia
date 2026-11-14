-- AutosColombia - Iteración 2: datos explícitos para persona y contacto de empresa.
-- Paso 8 de instalación; aditivo e idempotente. No divide ni modifica datos existentes.
USE autoscolombia;

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='clientes' AND COLUMN_NAME='nombres')=0,
  'ALTER TABLE clientes ADD COLUMN nombres VARCHAR(100) NULL AFTER nombre_razon_social',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='clientes' AND COLUMN_NAME='apellidos')=0,
  'ALTER TABLE clientes ADD COLUMN apellidos VARCHAR(100) NULL AFTER nombres',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
