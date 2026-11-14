# Reporte de Conciliación de Mensualidades (EA2)

**Fecha del procedimiento:** 2026-11-13
**Base intervenida:** `autoscolombia` (instancia local, versión 007 + paso 011)
**Responsable de sistema registrado en auditoría:** operador `1` (ADMINISTRADOR)
**Migración aplicada:** `backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql`

---

## 1. Regla aplicada

Cada mensualidad dura **30 días calendario**, es decir `fecha_fin = fecha_inicio + 29 días`.
La **fecha de inicio nunca se modifica**; solo se ajusta el vencimiento para cumplir la regla de EA2
(RF-28 / RF-29). El estado se recalcula con las fechas corregidas.

## 2. Respaldo previo (verificable)

| Elemento | Ubicación |
|---|---|
| Volcado completo previo | `Respaldo/autoscolombia_pre_011_20261113.sql` |
| Tabla de respaldo en base | `suscripciones_respaldo_normalizacion` |
| Trazabilidad del cambio | `auditoria_eventos` (evento `CONCILIACION_MENSUALIDAD_30_DIAS`) |

El volcado conserva la fila original con `fecha_fin = 2027-11-03`, por lo que el estado anterior es recuperable.

## 3. Valores anteriores y nuevos

| Suscripción | Vehículo | Estado | Inicio | Vencimiento anterior | Días antes | Vencimiento nuevo | Días después |
|---|---|---|---|---|---|---|---|
| 1 | 2 | VIGENTE | 2026-11-04 | 2027-11-03 | 365 | **2026-12-03** | **30** |
| 2 | 1 | VIGENTE | 2026-11-13 | 2026-12-12 | 30 | 2026-12-12 (sin cambio) | 30 |

La suscripción `2` ya cumplía la regla y no fue modificada.

## 4. Evidencia del respaldo en base

| id | estado_anterior | fecha_inicio | fecha_fin_anterior | estado_nuevo | fecha_fin_nueva | respaldado_en |
|---|---|---|---|---|---|---|
| 1 | VIGENTE | 2026-11-04 | 2027-11-03 | VIGENTE | 2026-12-03 | 2026-11-13 21:58:32 |

## 5. Evidencia de auditoría

| Evento | operador_id | entidad | entidad_id | acción | valor_anterior | valor_nuevo | fecha_hora |
|---|---|---|---|---|---|---|---|
| 10 | 1 | SUSCRIPCION | 1 | `CONCILIACION_MENSUALIDAD_30_DIAS` | `{"estado":"VIGENTE","fecha_inicio":"2026-11-04","fecha_fin":"2027-11-03"}` | `{"estado":"VIGENTE","fecha_inicio":"2026-11-04","fecha_fin":"2026-12-03"}` | 2026-11-13 21:58:32 |

## 6. Casos sin conciliar

`mensualidades_sin_conciliar` = **0**. Ninguna mensualidad quedó pendiente de decisión manual:
no existen traslapos irresolubles en la base real y no se inventó ninguna fecha.

## 7. Validación previa en base de pruebas

Antes de tocar la base real se ejecutó la migración 011 en dos bases temporales aisladas:

| Escenario | Descripción | Resultado |
|---|---|---|
| A | Instalación existente (schema + 002…007) con una mensualidad de 365 días y otra correcta. | 1 normalizada, 0 sin conciliar. Respaldo y auditoría correctos. **Idempotente** (segunda ejecución sin cambios). Tras la 011, las migraciones 008/009/010 se aplican en orden sin error de preflight. |
| B | Instalación con dos mensualidades de 365 días solapadas en el mismo vehículo. | 0 normalizadas, 2 registradas en `mensualidades_sin_conciliar` sin modificar. **Idempotente** (segunda ejecución: 2 → 2). |

Las bases temporales (`autoscolombia_conc_011a`, `autoscolombia_conc_011b`) fueron eliminadas al finalizar.

## 8. Nota de conciliación pendiente

El volcado `autoscolombia_pre_011_20261113.sql` documenta además una separación de datos de cliente
en `nombre_razon_social` (campo heredado) frente al esquema EA2 que usa `nombres` + `apellidos`
(columnas creadas por la migración 008). La aplicación de 008–010 sobre la base real requiere
completar datos obligatorios reales de clientes y operadores; ver `Documentacion/07_Orden_Migraciones.md`
y la sección de estado de base de datos en `Documentacion/17_Informe_Cierre_Final_EA2.md`.
