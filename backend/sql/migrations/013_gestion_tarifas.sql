-- AutosColombia - Iteración 3
-- Gestión de tarifas por tipo de vehículo.
-- Ejecutar UNA SOLA VEZ sobre la base autoscolombia.

USE autoscolombia;

CREATE TABLE tipos_vehiculo (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tipos_vehiculo_codigo (codigo),
    UNIQUE KEY uq_tipos_vehiculo_nombre (nombre)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO tipos_vehiculo (codigo, nombre)
VALUES
    ('CARRO', 'Carro'),
    ('MOTO', 'Moto'),
    ('CAMIONETA', 'Camioneta');

CREATE TABLE tarifas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tipo_vehiculo_id INT UNSIGNED NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE DEFAULT NULL,
    estado ENUM('ACTIVA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_tarifas_tipo_estado (
        tipo_vehiculo_id,
        estado
    ),

    KEY idx_tarifas_vigencia (
        fecha_inicio,
        fecha_fin
    ),

    CONSTRAINT fk_tarifas_tipo_vehiculo
        FOREIGN KEY (tipo_vehiculo_id)
        REFERENCES tipos_vehiculo(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_tarifas_valor
        CHECK (valor > 0),

    CONSTRAINT chk_tarifas_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO tarifas (tipo_vehiculo_id, valor, fecha_inicio, fecha_fin, estado)
VALUES
    (1, 250000.00, '2020-01-01', '2099-12-31', 'ACTIVA'),
    (2, 100000.00, '2020-01-01', '2099-12-31', 'ACTIVA'),
    (3, 250000.00, '2020-01-01', '2099-12-31', 'ACTIVA');
