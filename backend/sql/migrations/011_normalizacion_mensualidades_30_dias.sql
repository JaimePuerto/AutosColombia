-- AutosColombia - Iteración 2: normalización de mensualidades a 30 días calendario.
-- Paso de instalación; aditivo e idempotente. No elimina registros históricos.
--
-- Regla obligatoria de EA2 (RF-28 / RF-29): cada mensualidad dura 30 días calendario,
-- es decir fecha_fin = fecha_inicio + 29 días. La fecha de inicio nunca se modifica.
--
-- Comportamiento:
--   * Instalación limpia: se ejecuta sin efectos, porque no hay mensualidades que corregir.
--   * Instalación existente: corrige los períodos cuya duración no es de 30 días.
--       - Deja respaldo verificable en `suscripciones_respaldo_normalizacion`.
--       - Deja trazabilidad en `auditoria_eventos` (valor anterior, valor nuevo, motivo,
--         responsable y fecha).
--       - Recalcula el estado con las fechas corregidas (sin tocar las canceladas).
--       - Si el período corregido se cruzaría con otra mensualidad del mismo vehículo,
--         NO se modifica y el caso queda registrado en `mensualidades_sin_conciliar`
--         para decisión manual. No se inventan fechas.
--   * El procedimiento se puede ejecutar varias veces sin efectos adicionales:
--     una vez normalizadas, las filas dejan de cumplir la condición de corrección.
--
-- Orden en una actualización de una base existente: ejecutar este paso (011) ANTES de
-- la migración 010, porque 010 incorpora la restricción `chk_suscripcion_30_dias`.
USE autoscolombia;

DELIMITER $$

DROP PROCEDURE IF EXISTS normalizar_mensualidades_011$$
CREATE PROCEDURE normalizar_mensualidades_011()
BEGIN
  DECLARE v_admin INT DEFAULT NULL;
  DECLARE v_corregidas INT DEFAULT 0;
  DECLARE v_sin_conciliar INT DEFAULT 0;

  SET v_admin = (
    SELECT id FROM operadores
    WHERE rol = 'ADMINISTRADOR' AND estado = 'ACTIVO'
    ORDER BY id LIMIT 1
  );

  -- Respaldo verificable de cada registro modificado (valores anterior y nuevo).
  CREATE TABLE IF NOT EXISTS suscripciones_respaldo_normalizacion (
    id BIGINT UNSIGNED NOT NULL,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    estado_anterior VARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin_anterior DATE NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    fecha_fin_nueva DATE NOT NULL,
    respaldado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, respaldado_en)
  ) ENGINE = InnoDB;

  -- Casos que no se pueden corregir sin alterar otros registros.
  -- Una sola fila por suscripción (PK estable) para que la migración sea idempotente.
  CREATE TABLE IF NOT EXISTS mensualidades_sin_conciliar (
    suscripcion_id BIGINT UNSIGNED NOT NULL,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo VARCHAR(300) NOT NULL,
    detectado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (suscripcion_id)
  ) ENGINE = InnoDB;

  DROP TEMPORARY TABLE IF EXISTS tmp_normalizables;
  CREATE TEMPORARY TABLE tmp_normalizables (
    id BIGINT UNSIGNED PRIMARY KEY,
    vehiculo_id BIGINT UNSIGNED NOT NULL,
    estado_anterior VARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin_anterior DATE NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    fecha_fin_nueva DATE NOT NULL
  ) ENGINE = InnoDB;

  -- Períodos corregibles: duración distinta de 30 días y sin cruce con otro período
  -- no cancelado del mismo vehículo.
  INSERT INTO tmp_normalizables
  SELECT s.id,
         s.vehiculo_id,
         s.estado,
         s.fecha_inicio,
         s.fecha_fin,
         CASE
           WHEN CURRENT_DATE() < s.fecha_inicio THEN 'PROGRAMADA'
           WHEN CURRENT_DATE() > DATE_ADD(s.fecha_inicio, INTERVAL 29 DAY) THEN 'VENCIDA'
           ELSE 'VIGENTE'
         END,
         DATE_ADD(s.fecha_inicio, INTERVAL 29 DAY)
  FROM suscripciones s
  WHERE s.estado <> 'CANCELADA'
    AND DATEDIFF(s.fecha_fin, s.fecha_inicio) <> 29
    AND NOT EXISTS (
      SELECT 1 FROM suscripciones o
      WHERE o.vehiculo_id = s.vehiculo_id
        AND o.id <> s.id
        AND o.estado <> 'CANCELADA'
        AND o.fecha_inicio <= DATE_ADD(s.fecha_inicio, INTERVAL 29 DAY)
        AND o.fecha_fin >= s.fecha_inicio
    );

  -- Períodos con duración distinta de 30 días que sí presentan cruce: se documentan
  -- sin modificarlos. El INSERT es idempotente por la PK (suscripcion_id).
  INSERT INTO mensualidades_sin_conciliar
    (suscripcion_id, vehiculo_id, fecha_inicio, fecha_fin, motivo)
  SELECT s.id, s.vehiculo_id, s.fecha_inicio, s.fecha_fin,
         CONCAT('El período corregido (', s.fecha_inicio, ' a ',
                DATE_ADD(s.fecha_inicio, INTERVAL 29 DAY),
                ') se cruzaría con la mensualidad #', o.id,
                '. Requiere decisión manual; no se modifica automáticamente.')
  FROM suscripciones s
  JOIN suscripciones o
    ON o.vehiculo_id = s.vehiculo_id
   AND o.id <> s.id
   AND o.estado <> 'CANCELADA'
   AND o.fecha_inicio <= DATE_ADD(s.fecha_inicio, INTERVAL 29 DAY)
   AND o.fecha_fin >= s.fecha_inicio
  WHERE s.estado <> 'CANCELADA'
    AND DATEDIFF(s.fecha_fin, s.fecha_inicio) <> 29
  ON DUPLICATE KEY UPDATE suscripcion_id = mensualidades_sin_conciliar.suscripcion_id;

  START TRANSACTION;

  INSERT INTO suscripciones_respaldo_normalizacion
    (id, vehiculo_id, estado_anterior, fecha_inicio, fecha_fin_anterior,
     estado_nuevo, fecha_fin_nueva, respaldado_en)
  SELECT id, vehiculo_id, estado_anterior, fecha_inicio, fecha_fin_anterior,
         estado_nuevo, fecha_fin_nueva, NOW()
  FROM tmp_normalizables
  ON DUPLICATE KEY UPDATE id = suscripciones_respaldo_normalizacion.id;

  INSERT INTO auditoria_eventos
    (operador_id, entidad, entidad_id, accion, motivo, valor_anterior, valor_nuevo, fecha_hora)
  SELECT v_admin,
         'SUSCRIPCION',
         t.id,
         'CONCILIACION_MENSUALIDAD_30_DIAS',
         CONCAT('Normalización administrativa a 30 días calendario (fecha_fin = fecha_inicio + 29). ',
                'Motivo: la mensualidad no cumplía la regla de duración de EA2.'),
         JSON_OBJECT('estado', t.estado_anterior,
                     'fecha_inicio', t.fecha_inicio,
                     'fecha_fin', t.fecha_fin_anterior),
         JSON_OBJECT('estado', t.estado_nuevo,
                     'fecha_inicio', t.fecha_inicio,
                     'fecha_fin', t.fecha_fin_nueva),
         NOW()
  FROM tmp_normalizables t;

  UPDATE suscripciones s
  JOIN tmp_normalizables t ON t.id = s.id
  SET s.fecha_fin = t.fecha_fin_nueva,
      s.estado = t.estado_nuevo,
      s.actualizado_en = CURRENT_TIMESTAMP;

  COMMIT;

  SELECT COUNT(*) INTO v_corregidas FROM tmp_normalizables;

  SELECT COUNT(*) INTO v_sin_conciliar
  FROM suscripciones s
  WHERE s.estado <> 'CANCELADA'
    AND DATEDIFF(s.fecha_fin, s.fecha_inicio) <> 29
    AND s.id NOT IN (SELECT id FROM tmp_normalizables);

  DROP TEMPORARY TABLE tmp_normalizables;

  SELECT v_corregidas AS mensualidades_normalizadas,
         v_sin_conciliar AS mensualidades_sin_conciliar;
END$$

CALL normalizar_mensualidades_011()$$
DROP PROCEDURE normalizar_mensualidades_011$$
DELIMITER ;
