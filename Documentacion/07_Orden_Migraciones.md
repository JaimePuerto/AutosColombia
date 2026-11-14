# Orden de ejecución de migraciones — AutosColombia

Instalación limpia sobre un servidor MySQL 8.0.29+ con las extensiones/privilegios habituales
(`innodb`, `SET GLOBAL log_bin_trust_function_creators` no requerido). Base de datos: `autoscolombia`, `utf8mb4`.

## 1. Secuencia única y coherente

| Paso | Archivo | Qué crea / modifica | Idempotente |
|---|---|---|---|
| 1 | `backend/sql/schema.sql` | Tablas base: `operadores`, `vehiculos`, `celdas`, `movimientos`, `suscripciones` + datos iniciales de celdas | No (ejecutar una vez) |
| 2 | `backend/sql/migrations/002_autenticacion_operadores.sql` | Añade columnas de autenticación a `operadores`; crea `sesiones_operadores` y `auditoria_autenticacion` | No (ejecutar una vez) |
| 3 | `backend/sql/migrations/003_gestion_celdas_auditoria.sql` | Crea `clientes`; añade `vehiculos.cliente_id/activo` + FK; crea `historial_celdas` y `auditoria_eventos` (estructura canónica) | Sí |
| 4 | `backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql` | Añade `movimientos.anulado_en/anulado_por/motivo_anulacion/codigo_celda_snapshot/tipo_celda_snapshot`; índice `idx_movimientos_anulados` | Sí |
| 5 | `backend/sql/migrations/005_cierre_iteracion2_seguridad.sql` | Añade datos y contraseña temporal a `operadores` (`apellidos`, `email` + `uq_operadores_email`, `password_temporal`, `actualizado_en`); crea `recuperacion_password` e `historial_titulares_vehiculo`; añade `suscripciones.motivo_cancelacion/actualizado_en`; amplía el ENUM de `auditoria_autenticacion.accion` | Sí |
| 6 | `backend/sql/migrations/006_estados_suscripcion_ea2.sql` | Alinea la nomenclatura de estados de suscripción con EA2 (RF-28): amplía el ENUM y traduce `PENDIENTE → PROGRAMADA` y `ACTIVA → VIGENTE`; fija la definición definitiva `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` | Sí |
| 7 | `backend/sql/migrations/007_tipo_vehiculo_camioneta.sql` | Amplía el ENUM `vehiculos.tipo` para admitir `CAMIONETA` (RF-01); conserva `CARRO` y `MOTO` | Sí |
| 8 | `backend/sql/migrations/008_datos_obligatorios_clientes.sql` | Añade `clientes.nombres` y `clientes.apellidos` como campos aditivos; mantiene intactos los datos históricos | Sí |
| 9 | `backend/sql/migrations/009_historicos_append_only.sql` | Agrega triggers que rechazan `UPDATE`/`DELETE` en auditoría e historiales canónicos | Sí |
| 10 | `backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql` | Normaliza las mensualidades a 30 días calendario (`fecha_fin = fecha_inicio + 29`); crea `suscripciones_respaldo_normalizacion` y `mensualidades_sin_conciliar`; deja auditoría | Sí |
| 11 | `backend/sql/migrations/010_integridad_campos_ea2.sql` | Preflight y `NOT NULL` para datos obligatorios; CHECK `chk_suscripcion_30_dias` de suscripciones | Sí, si el preflight pasa |

> Los scripts `002` a `007` mantienen sus comentarios de versión originales; `008` a `011` son extensiones aditivas. `009` usa `CREATE TRIGGER IF NOT EXISTS`, disponible desde MySQL 8.0.29.
>
> **`011` precede a `010` de forma intencional.** `011` concilia los datos (mensualidades a 30 días) y `010` incorpora la restricción `chk_suscripcion_30_dias`; si `010` se aplicara antes sobre una base con datos irregulares, su preflight abortaría y la restricción nunca llegaría a crearse. En una instalación limpia `011` se ejecuta sin efectos.

## 2. Preparación y ejecución

```bash
# 1. Crear la base con la codificación correcta
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS autoscolombia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Ejecutar en orden
mysql -u root -p autoscolombia < backend/sql/schema.sql
mysql -u root -p autoscolombia < backend/sql/migrations/002_autenticacion_operadores.sql
mysql -u root -p autoscolombia < backend/sql/migrations/003_gestion_celdas_auditoria.sql
mysql -u root -p autoscolombia < backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql
mysql -u root -p autoscolombia < backend/sql/migrations/005_cierre_iteracion2_seguridad.sql
mysql -u root -p autoscolombia < backend/sql/migrations/006_estados_suscripcion_ea2.sql
mysql -u root -p autoscolombia < backend/sql/migrations/007_tipo_vehiculo_camioneta.sql
mysql -u root -p autoscolombia < backend/sql/migrations/008_datos_obligatorios_clientes.sql
mysql -u root -p autoscolombia < backend/sql/migrations/009_historicos_append_only.sql
# 011 concilia las mensualidades a 30 días y debe ir ANTES de 010.
mysql -u root -p autoscolombia < backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql
# Ejecutar 010 solo después de revisar el preflight y aprobar el estado de datos.
mysql -u root -p autoscolombia < backend/sql/migrations/010_integridad_campos_ea2.sql
```

> En Windows PowerShell con `mysql` en el PATH, el operador `<` funciona igual. Si se usa el cliente integrado, ejecutar cada archivo desde su menú «Abrir script SQL».

## 3. Verificación posterior

```sql
USE autoscolombia;
SHOW TABLES;
-- Deben aparecer: operadores, vehiculos, celdas, movimientos, suscripciones,
-- clientes, sesiones_operadores, auditoria_autenticacion, historial_celdas, auditoria_eventos,
-- recuperacion_password, historial_titulares_vehiculo

SELECT COUNT(*) FROM celdas;                 -- 80 celdas iniciales
SHOW COLUMNS FROM movimientos LIKE 'anulado_en';   -- confirma la migración 004
SHOW COLUMNS FROM auditoria_eventos;                -- confirmar valor_anterior / valor_nuevo / fecha_hora
SHOW COLUMNS FROM operadores LIKE 'password_temporal';  -- confirma la migración 005
SHOW TABLES LIKE 'recuperacion_password';               -- confirma la migración 005
SHOW TABLES LIKE 'historial_titulares_vehiculo';        -- confirma la migración 005
SHOW COLUMNS FROM suscripciones LIKE 'estado';          -- migración 006: ENUM('PROGRAMADA','VIGENTE','VENCIDA','CANCELADA')
SHOW COLUMNS FROM vehiculos LIKE 'tipo';                -- migración 007: ENUM('CARRO','MOTO','CAMIONETA')
SHOW COLUMNS FROM clientes LIKE 'nombres';              -- migración 008: nombre separado, nullable para históricos
SHOW COLUMNS FROM clientes LIKE 'apellidos';            -- migración 008: apellido separado, nullable para históricos
SHOW TRIGGERS;                                           -- migración 009: defensas append-only
SHOW TABLES LIKE 'suscripciones_respaldo_normalizacion'; -- migración 011: respaldo verificable de la normalización
SHOW TABLES LIKE 'mensualidades_sin_conciliar';          -- migración 011: casos que requieren decisión manual
SHOW CREATE TABLE suscripciones;                         -- migración 010: CHECK chk_suscripcion_30_dias
```

En una base con datos, tras `011`:

```sql
-- 011 deja 0 filas aquí cuando todos los períodos quedan a 30 días.
SELECT COUNT(*) FROM mensualidades_sin_conciliar;
-- Respaldo de cada mensualidad normalizada (valores anterior y nuevo).
SELECT id, estado_anterior, fecha_inicio, fecha_fin_anterior, estado_nuevo, fecha_fin_nueva
FROM suscripciones_respaldo_normalizacion;
-- Trazabilidad de la conciliación.
SELECT entidad_id, accion, operador_id, fecha_hora FROM auditoria_eventos
WHERE accion = 'CONCILIACION_MENSUALIDAD_30_DIAS';
```

## 4. Garantías de seguridad

- **003 a 009 y 011 son aditivas e idempotentes**; 010 puede reejecutarse si ya pasó el preflight y sus definiciones siguen presentes.
- **011 es una migración de conciliación de datos**: deja respaldo verificable en `suscripciones_respaldo_normalizacion` y trazabilidad en `auditoria_eventos` (`accion = 'CONCILIACION_MENSUALIDAD_30_DIAS'`, con valor anterior/nuevo, responsable y fecha). Recalcula el estado de cada mensualidad corregida. Si un período corregido se cruzaría con otra mensualidad no cancelada del mismo vehículo, **no se modifica** y queda en `mensualidades_sin_conciliar` para decisión manual: **no se inventan fechas**. Es idempotente: una vez normalizadas, las filas dejan de cumplir la condición de corrección y una nueva ejecución no altera nada.
- **010 no hace backfill ni modifica filas**. Antes de alterar columnas comprueba operadores, clientes, vehículos y suscripciones. Si hay valores vacíos o períodos distintos de 30 días, emite un error y se detiene. Por eso debe ejecutarse **después** de `011`.
- Los triggers protegen contra modificaciones accidentales, pero no reemplazan los grants de mínimo privilegio ni protegen frente a una cuenta DBA capaz de retirar los triggers.
- **002 no es idempotente** (usa `ALTER TABLE ... ADD COLUMN` y `CREATE TABLE` sin `IF NOT EXISTS`): si se re-ejecuta sobre una base ya migrada dará error de columna/tabla duplicada, **sin alterar ni borrar datos**. Para bases ya migradas no debe volverse a ejecutar.
- **Ninguna migración contiene `DROP TABLE`, `DELETE` ni `TRUNCATE`.**
- **Separación de cuentas:** las migraciones (DDL) las aplica la cuenta **administrativa** (`root`/DBA o `autoscolombia_admin`). El backend opera con la cuenta de **ejecución** (`autoscolombia_app`), que no tiene DDL y, sobre las tablas de auditoría e históricos, solo `SELECT`/`INSERT`. Ver `README.md` (sección «Cuentas de MySQL y mínimo privilegio») y `backend/scripts/crear-usuarios-bd.js`.
- Antes de tocar una base con datos, tomar respaldo:
  ```bash
  mysqldump -u root -p autoscolombia > Respaldo/BD/autoscolombia_$(date +%Y%m%d).sql
  ```
  Ya existe `Respaldo/BD/AutosColombia_Antes_Migracion_004.sql` como referencia. Para la normalización `011` se tomó además `Respaldo/autoscolombia_pre_011_20261113.sql`.

## 5. Instalaciones que ya aplicaron las migraciones

No requieren acción: la estructura resultante es la misma. Los servicios no dependen de re-ejecutar migraciones; solo se valida el esquema al arrancar el backend.

## 6. Ajuste de índices de suscripciones (no incluido en el orden base)

El histórico del proyecto incluye `Implementaciones/Migracion_Historial_Suscripciones_Iteracion2_CORREGIDA.sql`, que elimina el índice único `uq_suscripcion_vehiculo` y crea los índices `idx_suscripciones_vehiculo_fechas` y `idx_suscripcion_estado_fechas`. Es un ajuste posterior a la instalación base y **no forma parte de los 11 pasos**; ejecutarlo solo si la base presenta el índice único antiguo.

> **Nota de publicación:** la carpeta `Implementaciones/` (al igual que `Respaldo/`) **no forma parte del repositorio publicado** (está en `.gitignore`). El ajuste de índices ya está incorporado en la definición de la tabla dentro de las migraciones base, por lo que una instalación limpia con los 11 pasos no requiere ese script adicional.

## 7. Validación de la instalación limpia

La suite de integración crea una base temporal independiente y aplica los **11 scripts en orden** (con `011` antes de `010`). La última ejecución, el 13-11-2026 con MySQL 8.4.13, aprobó **52/52 pruebas**. Incluyó el rerun de `008`–`011`, rechazo SQL de `UPDATE`/`DELETE` sobre los cuatro históricos, restricciones `NOT NULL`, la restricción `chk_suscripcion_30_dias` y la normalización de mensualidades. Las pruebas manuales M-01 a M-18 se reejecutaron por separado con el arnés Playwright (ver `Documentacion/13_Evidencias_Pruebas_Manuales.md`).

### 7.1 Comprobación manual de instalación desde cero

Se realizó una instalación limpia **independiente** sobre una base temporal (`autoscolombia_instcheck`, recreando los nombres con reescritura del `USE` de cada script) y se verificaron las siguientes comprobaciones. **No se tocó la base real `autoscolombia`.**

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Creación de la base con `CHARACTER SET utf8mb4` / `utf8mb4_unicode_ci` | Correcto |
| 2 | Aplicación del `schema.sql` (paso 1) | `exit=0` |
| 3 | Aplicación de migraciones `002` → `007` en orden (pasos 2–7, validación histórica) | 7/7 `exit=0` |
| 4 | Tablas creadas | 12 (11 clave + `sesiones_operadores`) |
| 5 | ENUM `vehiculos.tipo` incluye `CAMIONETA` | Correcto (migración `007`) |
| 6 | ENUM `suscripciones.estado` = `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` | Correcto (migración `006`) |
| 7 | Celdas sembradas | 80 |
| 8 | Claves foráneas e índices generados | Correcto |
| 9 | Idempotencia de `003`–`007` (re-ejecución sin error) | Correcto |
| 10 | Base temporal eliminada y base real intacta (14 tablas) | Correcto |

> **Observación técnica:** los scripts fijan la base con `USE autoscolombia;`. Para instalarlos sobre otra base (p. ej. una de pruebas) debe reescribirse ese nombre; la suite de integración lo hace mediante `.replace(/autoscolombia/g, <base>)`. La migración `008` añade columnas nullable deliberadamente: la aplicación valida los campos para altas/ediciones y los clientes históricos sin esos datos no son modificados ni divididos automáticamente.
