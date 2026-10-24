
-- Creación de AUTOSCOLOMBIA
-- Motor: MySQL 8.0.16+
-- Base de datos limpia para la primera iteracion


CREATE DATABASE IF NOT EXISTS autoscolombia
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE autoscolombia;

-- Creación de operadores

CREATE TABLE operadores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

-- Creación de Vehiculos

CREATE TABLE vehiculos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(10) NOT NULL UNIQUE,
    tipo ENUM('CARRO', 'MOTO') NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    color VARCHAR(30),
    anio SMALLINT UNSIGNED,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_anio_vehiculo
        CHECK (anio IS NULL OR anio BETWEEN 1886 AND 2100)
) ENGINE = InnoDB;

-- Creación de Celdas

CREATE TABLE celdas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    tipo ENUM('CARRO', 'MOTO') NOT NULL,
    ubicacion VARCHAR(100),
    activa BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

-- Creación de Movimientos (Entradas y Salidas) y los 2 accesos

CREATE TABLE movimientos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    vehiculo_id BIGINT UNSIGNED NOT NULL,
    celda_id INT UNSIGNED NOT NULL,
    operador_entrada_id INT UNSIGNED NOT NULL,
    operador_salida_id INT UNSIGNED NULL,

    acceso_entrada ENUM('PRINCIPAL', 'SECUNDARIO')
        NOT NULL DEFAULT 'PRINCIPAL',
    acceso_salida ENUM('PRINCIPAL', 'SECUNDARIO') NULL,

    fecha_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_salida DATETIME NULL,
    observaciones VARCHAR(500),

    vehiculo_activo BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE
                WHEN fecha_salida IS NULL THEN vehiculo_id
                ELSE NULL
            END
        ) STORED,

    celda_activa INT UNSIGNED
        GENERATED ALWAYS AS (
            CASE
                WHEN fecha_salida IS NULL THEN celda_id
                ELSE NULL
            END
        ) STORED,

    CONSTRAINT fk_movimiento_vehiculo
        FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id),

    CONSTRAINT fk_movimiento_celda
        FOREIGN KEY (celda_id)
        REFERENCES celdas(id),

    CONSTRAINT fk_movimiento_operador_entrada
        FOREIGN KEY (operador_entrada_id)
        REFERENCES operadores(id),

    CONSTRAINT fk_movimiento_operador_salida
        FOREIGN KEY (operador_salida_id)
        REFERENCES operadores(id),

    CONSTRAINT uq_vehiculo_movimiento_activo
        UNIQUE (vehiculo_activo),

    CONSTRAINT uq_celda_movimiento_activo
        UNIQUE (celda_activa),

    CONSTRAINT chk_fechas_movimiento
        CHECK (
            fecha_salida IS NULL
            OR fecha_salida >= fecha_entrada
        ),

    INDEX idx_movimientos_vehiculo (vehiculo_id),
    INDEX idx_movimientos_operador (operador_entrada_id),
    INDEX idx_movimientos_celda (celda_id),
    INDEX idx_movimientos_fecha_entrada (fecha_entrada)
) ENGINE = InnoDB;


-- Creación de Suscripciones
-- Estructura inicial para validar el acceso comercial.
-- El modulo completo de pagos se desarrollara despues.


CREATE TABLE suscripciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    estado ENUM('PENDIENTE', 'ACTIVA', 'VENCIDA', 'CANCELADA')
        NOT NULL DEFAULT 'PENDIENTE',
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_suscripcion_vehiculo
        FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id),

    CONSTRAINT chk_valor_suscripcion
        CHECK (valor >= 0),

    CONSTRAINT chk_fechas_suscripcion
        CHECK (fecha_fin >= fecha_inicio),

    INDEX idx_suscripcion_vehiculo (vehiculo_id),
    INDEX idx_suscripcion_estado_fechas (estado, fecha_fin)
) ENGINE = InnoDB;

-- Creamos las 70 celdas para automoviles 

INSERT INTO celdas (codigo, tipo, ubicacion)
WITH RECURSIVE numeros AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numeros WHERE n < 70
)
SELECT
    CONCAT('C', LPAD(n, 2, '0')),
    'CARRO',
    'Zona carros'
FROM numeros;

-- Creamos las 10 celdas para motos

INSERT INTO celdas (codigo, tipo, ubicacion)
WITH RECURSIVE numeros AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numeros WHERE n < 10
)
SELECT
    CONCAT('M', LPAD(n, 2, '0')),
    'MOTO',
    'Zona motos'
FROM numeros;


