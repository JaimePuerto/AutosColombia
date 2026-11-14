-- AutosColombia - Iteración 2: tipo de vehículo CAMIONETA (RF-01).
-- El documento EA2 exige registrar carros, motos y camionetas; las camionetas
-- ocupan celdas de tipo CARRO (no existe un tipo de celda propio).
-- Paso 7 de 7 del orden de instalación limpia (ver backend/sql/schema.sql).
-- Migración ADITIVA e IDEMPOTENTE: amplía el ENUM de vehiculos.tipo sin eliminar
-- filas, columnas ni índices. No modifica los valores existentes ('CARRO', 'MOTO').
USE autoscolombia;

SET @db := DATABASE();

-- Ampliar el ENUM de vehiculos.tipo para admitir CAMIONETA.
-- Guarda: sólo se ejecuta si la definición actual todavía no incluye CAMIONETA.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'vehiculos' AND COLUMN_NAME = 'tipo'
      AND COLUMN_TYPE NOT LIKE '%CAMIONETA%') > 0,
  "ALTER TABLE vehiculos MODIFY COLUMN tipo ENUM('CARRO','MOTO','CAMIONETA') NOT NULL",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
