-- AutosColombia - Iteración 3: registro, validación e historial de pagos.
-- Ejecutar sobre la base autoscolombia.

USE autoscolombia;

DROP TABLE IF EXISTS pagos;

CREATE TABLE pagos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    numero_comprobante VARCHAR(32) NULL,
    suscripcion_id BIGINT UNSIGNED NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metodo_pago ENUM('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO') NOT NULL,
    referencia VARCHAR(120) NULL,
    estado ENUM('APROBADO', 'ANULADO') NOT NULL DEFAULT 'APROBADO',
    responsable_id INT UNSIGNED NOT NULL,
    estado_suscripcion_anterior ENUM(
        'PROGRAMADA', 'VIGENTE', 'VENCIDA', 'CANCELADA'
    ) NULL,
    motivo_anulacion VARCHAR(500) NULL,
    anulado_por INT UNSIGNED NULL,
    anulado_en DATETIME NULL,

    pago_aprobado_activo BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE
                WHEN estado = 'APROBADO' THEN suscripcion_id
                ELSE NULL
            END
        ) STORED,

    PRIMARY KEY (id),
    UNIQUE KEY uq_pagos_comprobante (numero_comprobante),
    UNIQUE KEY uq_pagos_suscripcion_aprobada (pago_aprobado_activo),

    KEY idx_pagos_suscripcion (suscripcion_id),
    KEY idx_pagos_responsable (responsable_id),
    KEY idx_pagos_anulado_por (anulado_por),
    KEY idx_pagos_fecha (fecha_pago),
    KEY idx_pagos_estado (estado),

    CONSTRAINT fk_pagos_suscripcion
        FOREIGN KEY (suscripcion_id)
        REFERENCES suscripciones(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pagos_responsable
        FOREIGN KEY (responsable_id)
        REFERENCES operadores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pagos_anulado_por
        FOREIGN KEY (anulado_por)
        REFERENCES operadores(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_pagos_valor
        CHECK (valor > 0),

    CONSTRAINT chk_pagos_anulacion
        CHECK (
            (
                estado = 'APROBADO'
                AND motivo_anulacion IS NULL
                AND anulado_en IS NULL
            )
            OR
            (
                estado = 'ANULADO'
                AND motivo_anulacion IS NOT NULL
                AND anulado_en IS NOT NULL
            )
        )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;