-- AutosColombia - Migración incremental Iteración 2 (RF-35 a RF-38 y soporte histórico)
-- Ejecutar sobre una copia/backup de autoscolombia. No elimina tablas ni registros.
--
-- Orden de instalación limpia (obligatorio):
--   1) backend/sql/schema.sql
--   2) backend/sql/migrations/002_autenticacion_operadores.sql
--   3) backend/sql/migrations/003_gestion_celdas_auditoria.sql
--   4) backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql  (este archivo)
--   5) backend/sql/migrations/005_cierre_iteracion2_seguridad.sql
--
-- Este script REQUIERE la migración 003 aplicada. Las definiciones de
-- auditoria_eventos e historial_celdas se repiten aquí, idénticas a las de 003,
-- para que el script sea seguro en cualquier orden: gracias a "IF NOT EXISTS"
-- nunca recrean ni alteran tablas ya existentes (la estructura canónica es la de 003).
USE autoscolombia;

CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  operador_id INT UNSIGNED NULL,
  entidad VARCHAR(40) NOT NULL,
  entidad_id BIGINT UNSIGNED NULL,
  accion VARCHAR(50) NOT NULL,
  motivo VARCHAR(500) NULL,
  valor_anterior JSON NULL,
  valor_nuevo JSON NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auditoria_eventos_fecha (fecha_hora),
  KEY idx_auditoria_eventos_usuario (operador_id, fecha_hora),
  KEY idx_auditoria_eventos_entidad (entidad, entidad_id),
  CONSTRAINT fk_auditoria_eventos_operador FOREIGN KEY (operador_id) REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_celdas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  celda_id INT UNSIGNED NOT NULL,
  operador_id INT UNSIGNED NULL,
  accion ENUM('CREAR','MODIFICAR','BLOQUEAR','DESBLOQUEAR') NOT NULL,
  motivo VARCHAR(500) NULL,
  valor_anterior JSON NULL,
  valor_nuevo JSON NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_historial_celda_fecha (celda_id, fecha_hora),
  CONSTRAINT fk_historial_celda FOREIGN KEY (celda_id) REFERENCES celdas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_historial_celda_operador FOREIGN KEY (operador_id) REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar columnas de anulación y snapshot solo si no existen.
SET @db := DATABASE();
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND COLUMN_NAME='anulado_en')=0,
  'ALTER TABLE movimientos ADD COLUMN anulado_en DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND COLUMN_NAME='anulado_por')=0,
  'ALTER TABLE movimientos ADD COLUMN anulado_por INT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND COLUMN_NAME='motivo_anulacion')=0,
  'ALTER TABLE movimientos ADD COLUMN motivo_anulacion VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND COLUMN_NAME='codigo_celda_snapshot')=0,
  'ALTER TABLE movimientos ADD COLUMN codigo_celda_snapshot VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND COLUMN_NAME='tipo_celda_snapshot')=0,
  'ALTER TABLE movimientos ADD COLUMN tipo_celda_snapshot VARCHAR(10) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill snapshots sin sobrescribir datos existentes.
UPDATE movimientos m
INNER JOIN celdas c ON c.id=m.celda_id
SET m.codigo_celda_snapshot=COALESCE(m.codigo_celda_snapshot,c.codigo),
    m.tipo_celda_snapshot=COALESCE(m.tipo_celda_snapshot,c.tipo)
WHERE m.codigo_celda_snapshot IS NULL OR m.tipo_celda_snapshot IS NULL;

-- Índice auxiliar para consultas de auditoría/movimientos.
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='movimientos' AND INDEX_NAME='idx_movimientos_anulados')=0,
  'CREATE INDEX idx_movimientos_anulados ON movimientos (anulado_en, fecha_entrada)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
