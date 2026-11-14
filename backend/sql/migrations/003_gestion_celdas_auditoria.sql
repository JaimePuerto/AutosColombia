-- AutosColombia Iteración 2 - gestión de celdas y auditoría operativa.
-- Paso 3 de 7 del orden de instalación limpia (ver backend/sql/schema.sql).
-- MySQL 8.0+. Migración aditiva: no elimina ni reconstruye datos.
-- Estructura canónica de auditoria_eventos e historial_celdas (usada por los servicios).
USE autoscolombia;

CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_cliente ENUM('PERSONA','EMPRESA') NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL,
  numero_documento VARCHAR(30) NOT NULL,
  nombre_razon_social VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NULL,
  correo VARCHAR(150) NULL,
  direccion VARCHAR(200) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  autorizacion_datos BOOLEAN NOT NULL DEFAULT FALSE,
  autorizacion_fecha DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clientes_documento (tipo_documento, numero_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_iteracion2_003$$
CREATE PROCEDURE migrar_iteracion2_003()
BEGIN
  -- Si `clientes` ya existía (base de una iteración anterior), el CREATE TABLE IF NOT EXISTS
  -- no añade las columnas de la autorización de datos: se agregan aquí de forma idempotente.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='clientes' AND column_name='autorizacion_datos') THEN
    ALTER TABLE clientes ADD COLUMN autorizacion_datos BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='clientes' AND column_name='autorizacion_fecha') THEN
    ALTER TABLE clientes ADD COLUMN autorizacion_fecha DATETIME NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='clientes' AND column_name='actualizado_en') THEN
    ALTER TABLE clientes ADD COLUMN actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehiculos' AND column_name='cliente_id') THEN
    ALTER TABLE vehiculos ADD COLUMN cliente_id BIGINT UNSIGNED NULL AFTER id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vehiculos' AND column_name='activo') THEN
    ALTER TABLE vehiculos ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name='vehiculos' AND constraint_name='fk_vehiculo_cliente') THEN
    ALTER TABLE vehiculos ADD CONSTRAINT fk_vehiculo_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;
  END IF;
END$$
CALL migrar_iteracion2_003()$$
DROP PROCEDURE migrar_iteracion2_003$$
DELIMITER ;

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

-- Los índices principales están definidos en la creación de las tablas.
