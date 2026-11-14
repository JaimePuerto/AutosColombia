-- AutosColombia - Iteración 2: cierre de seguridad y trazabilidad.
-- Cubre RF-10, RF-12, RF-13, RF-16 a RF-21, RF-23, RF-27 a RF-29, RF-37 y RF-38.
-- Paso 5 de 7 del orden de instalación limpia (ver backend/sql/schema.sql).
-- Migración ADITIVA e IDEMPOTENTE: no elimina, no reconstruye y no modifica datos existentes.
USE autoscolombia;

SET @db := DATABASE();

-- 1) Datos de operadores exigidos por RF-16/RF-18 y soporte de contraseña temporal (RF-10/RF-13/RF-21).
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='operadores' AND COLUMN_NAME='apellidos')=0,
  'ALTER TABLE operadores ADD COLUMN apellidos VARCHAR(100) NULL AFTER nombre', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='operadores' AND COLUMN_NAME='email')=0,
  'ALTER TABLE operadores ADD COLUMN email VARCHAR(150) NULL AFTER documento', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='operadores' AND COLUMN_NAME='password_temporal')=0,
  'ALTER TABLE operadores ADD COLUMN password_temporal BOOLEAN NOT NULL DEFAULT FALSE AFTER password_hash', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='operadores' AND COLUMN_NAME='actualizado_en')=0,
  'ALTER TABLE operadores ADD COLUMN actualizado_en DATETIME NULL AFTER ultimo_ingreso', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- El correo es único cuando está presente (MySQL admite varios NULL en un índice UNIQUE).
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='operadores' AND INDEX_NAME='uq_operadores_email')=0,
  'ALTER TABLE operadores ADD UNIQUE KEY uq_operadores_email (email)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Recuperación de contraseña por correo (RF-12): se almacena únicamente el hash del token.
CREATE TABLE IF NOT EXISTS recuperacion_password (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  operador_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_en DATETIME NOT NULL,
  usado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recuperacion_token (token_hash),
  KEY idx_recuperacion_operador (operador_id, expira_en),
  CONSTRAINT fk_recuperacion_operador FOREIGN KEY (operador_id) REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Historial de titulares (RF-27): conserva el vínculo con el titular anterior sin sobrescribirlo.
CREATE TABLE IF NOT EXISTS historial_titulares_vehiculo (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  cliente_anterior_id BIGINT UNSIGNED NULL,
  cliente_nuevo_id BIGINT UNSIGNED NOT NULL,
  operador_id INT UNSIGNED NULL,
  motivo VARCHAR(500) NULL,
  fecha_cambio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_titulares_vehiculo (vehiculo_id, fecha_cambio),
  CONSTRAINT fk_titulares_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_titulares_cliente_anterior FOREIGN KEY (cliente_anterior_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_titulares_cliente_nuevo FOREIGN KEY (cliente_nuevo_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_titulares_operador FOREIGN KEY (operador_id) REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Suscripciones (RF-28/RF-29): motivo de cancelación y sello de actualización.
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='suscripciones' AND COLUMN_NAME='motivo_cancelacion')=0,
  'ALTER TABLE suscripciones ADD COLUMN motivo_cancelacion VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='suscripciones' AND COLUMN_NAME='actualizado_en')=0,
  'ALTER TABLE suscripciones ADD COLUMN actualizado_en DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Auditoría de autenticación (RF-10/RF-12/RF-13/RF-37): ampliar las acciones soportadas.
--    Los valores existentes (LOGIN_*, CIERRE_SESION, CUENTA_BLOQUEADA) se conservan.
ALTER TABLE auditoria_autenticacion
  MODIFY COLUMN accion ENUM(
    'LOGIN_EXITOSO','LOGIN_FALLIDO','CIERRE_SESION','CUENTA_BLOQUEADA',
    'CAMBIO_PASSWORD','PASSWORD_TEMPORAL_ASIGNADA','RECUPERACION_SOLICITADA',
    'PASSWORD_RESTABLECIDA','DESBLOQUEO_CUENTA'
  ) NOT NULL;
