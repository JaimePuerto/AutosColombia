-- AutosColombia - Iteración 2: restricciones de integridad para campos EA2.
-- Paso 10; preflight estricto y sin backfill. Resolver datos heredados antes de reintentar.
-- No ejecutar sobre producción sin respaldo, ventana aprobada y revisión de resultados.
USE autoscolombia;

DELIMITER $$
DROP PROCEDURE IF EXISTS validar_integridad_ea2_010$$
CREATE PROCEDURE validar_integridad_ea2_010()
BEGIN
  IF EXISTS (
    SELECT 1 FROM operadores
    WHERE NULLIF(TRIM(nombre), '') IS NULL
       OR NULLIF(TRIM(apellidos), '') IS NULL
       OR NULLIF(TRIM(documento), '') IS NULL
       OR NULLIF(TRIM(email), '') IS NULL
       OR NULLIF(TRIM(telefono), '') IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight 010: completar datos obligatorios de operadores antes de aplicar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM clientes
    WHERE NULLIF(TRIM(nombres), '') IS NULL
       OR NULLIF(TRIM(apellidos), '') IS NULL
       OR NULLIF(TRIM(numero_documento), '') IS NULL
       OR NULLIF(TRIM(correo), '') IS NULL
       OR NULLIF(TRIM(telefono), '') IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight 010: completar datos obligatorios de clientes antes de aplicar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM vehiculos
    WHERE cliente_id IS NULL
       OR NULLIF(TRIM(marca), '') IS NULL
       OR NULLIF(TRIM(modelo), '') IS NULL
       OR NULLIF(TRIM(color), '') IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight 010: completar titular, marca, modelo y color de vehículos antes de aplicar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM suscripciones
    WHERE fecha_inicio IS NULL
       OR fecha_fin IS NULL
       OR DATEDIFF(fecha_fin, fecha_inicio) <> 29
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight 010: conciliar suscripciones que no duran 30 días antes de aplicar';
  END IF;
END$$
CALL validar_integridad_ea2_010()$$
DROP PROCEDURE validar_integridad_ea2_010$$
DELIMITER ;

ALTER TABLE operadores
  MODIFY COLUMN nombre VARCHAR(100) NOT NULL,
  MODIFY COLUMN apellidos VARCHAR(100) NOT NULL,
  MODIFY COLUMN documento VARCHAR(30) NOT NULL,
  MODIFY COLUMN email VARCHAR(150) NOT NULL,
  MODIFY COLUMN telefono VARCHAR(20) NOT NULL;

ALTER TABLE clientes
  MODIFY COLUMN nombres VARCHAR(100) NOT NULL,
  MODIFY COLUMN apellidos VARCHAR(100) NOT NULL,
  MODIFY COLUMN numero_documento VARCHAR(30) NOT NULL,
  MODIFY COLUMN correo VARCHAR(150) NOT NULL,
  MODIFY COLUMN telefono VARCHAR(20) NOT NULL;

ALTER TABLE vehiculos
  MODIFY COLUMN cliente_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN marca VARCHAR(50) NOT NULL,
  MODIFY COLUMN modelo VARCHAR(50) NOT NULL,
  MODIFY COLUMN color VARCHAR(30) NOT NULL;

SET @db := DATABASE();
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='suscripciones'
     AND CONSTRAINT_NAME='chk_suscripcion_30_dias')=0,
  'ALTER TABLE suscripciones ADD CONSTRAINT chk_suscripcion_30_dias CHECK (DATEDIFF(fecha_fin, fecha_inicio) = 29)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
