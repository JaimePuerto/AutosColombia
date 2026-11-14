-- AutosColombia - Iteración 2: defensa en profundidad para auditoría e históricos.
-- Paso 9 de instalación; los triggers rechazan UPDATE/DELETE a nivel de base de datos.
-- No reemplazan una cuenta runtime de mínimo privilegio ni protegen frente a un DBA.
USE autoscolombia;

CREATE TRIGGER IF NOT EXISTS trg_auditoria_eventos_no_update
BEFORE UPDATE ON auditoria_eventos FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='auditoria_eventos es append-only';

CREATE TRIGGER IF NOT EXISTS trg_auditoria_eventos_no_delete
BEFORE DELETE ON auditoria_eventos FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='auditoria_eventos es append-only';

CREATE TRIGGER IF NOT EXISTS trg_auditoria_autenticacion_no_update
BEFORE UPDATE ON auditoria_autenticacion FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='auditoria_autenticacion es append-only';

CREATE TRIGGER IF NOT EXISTS trg_auditoria_autenticacion_no_delete
BEFORE DELETE ON auditoria_autenticacion FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='auditoria_autenticacion es append-only';

CREATE TRIGGER IF NOT EXISTS trg_historial_celdas_no_update
BEFORE UPDATE ON historial_celdas FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='historial_celdas es append-only';

CREATE TRIGGER IF NOT EXISTS trg_historial_celdas_no_delete
BEFORE DELETE ON historial_celdas FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='historial_celdas es append-only';

CREATE TRIGGER IF NOT EXISTS trg_historial_titulares_no_update
BEFORE UPDATE ON historial_titulares_vehiculo FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='historial_titulares_vehiculo es append-only';

CREATE TRIGGER IF NOT EXISTS trg_historial_titulares_no_delete
BEFORE DELETE ON historial_titulares_vehiculo FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='historial_titulares_vehiculo es append-only';
