-- AutosColombia - Iteración 2: autenticación y sesiones.
-- Ejecutar UNA SOLA VEZ sobre la base autoscolombia.
-- No elimina ni reconstruye tablas ni registros existentes.
USE autoscolombia;

ALTER TABLE operadores
  ADD COLUMN documento VARCHAR(30) NULL AFTER nombre,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER documento,
  ADD COLUMN rol ENUM('ADMINISTRADOR','OPERADOR') NOT NULL DEFAULT 'OPERADOR' AFTER password_hash,
  ADD COLUMN estado ENUM('ACTIVO','SUSPENDIDO','DESVINCULADO') NOT NULL DEFAULT 'ACTIVO' AFTER rol,
  ADD COLUMN intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER estado,
  ADD COLUMN bloqueado BOOLEAN NOT NULL DEFAULT FALSE AFTER intentos_fallidos,
  ADD COLUMN ultimo_ingreso DATETIME NULL AFTER bloqueado;

ALTER TABLE operadores
  ADD UNIQUE KEY uq_operadores_documento (documento);

CREATE TABLE sesiones_operadores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operador_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ultima_actividad DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revocada_en DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesion_token_hash (token_hash),
  KEY idx_sesiones_operador (operador_id),
  CONSTRAINT fk_sesion_operador FOREIGN KEY (operador_id)
    REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auditoria_autenticacion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operador_id INT UNSIGNED NULL,
  documento_intentado VARCHAR(30) NULL,
  accion ENUM('LOGIN_EXITOSO','LOGIN_FALLIDO','CIERRE_SESION','CUENTA_BLOQUEADA') NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_auditoria_auth_fecha (fecha_hora),
  KEY idx_auditoria_auth_operador (operador_id),
  CONSTRAINT fk_auditoria_auth_operador FOREIGN KEY (operador_id)
    REFERENCES operadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
