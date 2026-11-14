# Inventario de soportes de la entrega — AutosColombia (Iteración 2)

Fecha de revisión: 2026-11-13
Alcance revisado: documentación, scripts de base de datos, respaldos y código fuente del repositorio.

> El inventario inicial de las secciones 1–4 es histórico. La sección 5 recoge el estado post-auditoría: las 52 pruebas automatizadas pasan, las pruebas M-01…M-18 quedaron automatizadas (33/33) y RNF-03 cuenta con benchmark representativo en banco de pruebas local. El dictamen vigente está en `Documentacion/17_Informe_Cierre_Final_EA2.md`.

## 1. Soporte revisado del repositorio

| Soporte existente | Ruta | Tipo | Utilidad para la entrega |
|---|---|---|---|
| README general | `README.md` | Documento | Base de instalación/configuración; requería actualización (puerto y migraciones) |
| README del frontend | `frontend/README.md` | Documento | Plantilla genérica de Vite/React; **no aporta** a la entrega académica |
| Documento de implementación | `Implementaciones/IMPLEMENTACION_AUTENTICACION_ITERACION_2.md` | Documento | Describe la implementación de autenticación y gestión de usuarios; soporte parcial |
| Esquema y migraciones | `backend/sql/schema.sql`, `backend/sql/migrations/002…011` | SQL | Definen la base de datos con orden de instalación documentado en [`07_Orden_Migraciones.md`](07_Orden_Migraciones.md) |
| Diagnóstico de codificación | `Implementaciones/DIAGNOSTICO_CODIFICACION_20261113_055603.txt` | Evidencia | Evidencia técnica de la corrección de codificación |
| Migraciones auxiliares | `Implementaciones/Migracion_Historial_Suscripciones_Iteracion2*.sql` | SQL | Cambio de índices de `suscripciones`; soporte técnico |
| Scripts de instalación/diagnóstico | `Implementaciones/*.ps1`, `*.py` | Script | Automatizaciones puntuales; soporte técnico, no documentación |
| Evidencias de base de datos | `Implementaciones/*.csv` | Evidencia | Salidas `SELECT`/`SHOW CREATE TABLE` usadas como evidencia |
| Respaldos de código y BD | `Respaldo/**` | Respaldo | Permiten revertir cambios; incluye `Respaldo/BD/AutosColombia_Antes_Migracion_004.sql` |
| Pruebas automatizadas | `backend/test/*.test.js` + `backend/test/integracion/` | Código | Pruebas `node:test`; 52 casos pasan al 2026-11-13 en la suite actual |

## 2. Documentos de la entrega: estado inicial

| # | Documento solicitado | Estado inicial | Acción |
|---|---|---|---|
| 1 | README (instalación/configuración/ejecución) | Parcial (desactualizado) | **Actualizado** |
| 2 | Funcionalidades implementadas | Faltante | **Creado** |
| 3 | Matriz de requisitos y criterios de aceptación | Faltante | **Creado** |
| 4 | Historias de usuario | Faltante | **Creado** |
| 5 | Diagramas (casos de uso, actividades, secuencia) | Faltante | **Creado** |
| 6 | Modelo entidad-relación | Faltante | **Creado** |
| 7 | Diccionario de datos | Faltante | **Creado** |
| 8 | Orden de ejecución de migraciones | Parcial (solo comentarios) | **Creado** |
| 9 | Manual de usuario | Faltante | **Creado** |
| 10 | Matriz de pruebas | Parcial (solo enunciada) | **Creado** |

## 3. Documentos generados en esta entrega

Todos en la carpeta `Documentacion/`:

| Documento | Archivo |
|---|---|
| Inventario de soportes | `Documentacion/00_Inventario_Soportes.md` |
| Funcionalidades implementadas | `Documentacion/01_Funcionalidades_Implementadas.md` |
| Matriz de requisitos y criterios de aceptación | `Documentacion/02_Matriz_Requisitos.md` |
| Historias de usuario | `Documentacion/03_Historias_Usuario.md` |
| Diagramas (casos de uso, actividades, secuencia) | `Documentacion/04_Diagramas.md` |
| Modelo entidad-relación | `Documentacion/05_Modelo_Entidad_Relacion.md` |
| Diccionario de datos | `Documentacion/06_Diccionario_Datos.md` |
| Orden de ejecución de migraciones | `Documentacion/07_Orden_Migraciones.md` |
| Manual de usuario | `Documentacion/08_Manual_Usuario.md` |
| Matriz de pruebas | `Documentacion/09_Matriz_Pruebas.md` |
| Matriz de trazabilidad de requisitos (EA2) | `Documentacion/10_Auditoria_Cumplimiento_EA2.md` |
| Informe final de la Iteración 2 | `Documentacion/11_Informe_Final_Iteracion2.md` |
| Evidencias de pruebas manuales | `Documentacion/13_Evidencias_Pruebas_Manuales.md` |
| Acta de cierre de la Iteración 2 | `Documentacion/14_Acta_Cierre_Iteracion2.md` |
| Auditoría final EA2 | `Documentacion/15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md` |
| Plan de correcciones | `Documentacion/Plan_Correcciones_Post_Auditoria_EA2.md` |
| Informe post-correcciones | `Documentacion/16_Informe_Final_Correcciones_EA2.md` |
| Informe de cierre final EA2 | `Documentacion/17_Informe_Cierre_Final_EA2.md` |

## 4. Soportes faltantes o pendientes

| Pendiente | Motivo | Recomendación |
|---|---|---|
| Diagramas en formato editable (draw.io/StarUML) | Los diagramas se entregan en Mermaid (texto) | Exportar a imagen si el docente lo exige |
| Capturas de pantalla de la interfaz | El registro previo reporta 46; la auditoría contó 43 PNG y detectó duplicados | **Resuelto:** el arnés E2E regeneró 43 capturas únicas en `Documentacion/Evidencias/Iteracion_2/`, una por subcaso |
| Pruebas manuales M-01 a M-18 | El registro previo las reporta aprobadas; requerían reejecución reproducible | **Resuelto:** reejecutadas con el arnés Playwright versionado `frontend/e2e/` (`npm run test:e2e`); corrida 33/33 sobre base efímera |
| Benchmark RNF-03 | La medida histórica corresponde a `/api/health`, no a consulta funcional bajo carga | **Resuelto:** `frontend/e2e/rendimiento/rnf03.spec.js`; condiciones y resultado en `09_Matriz_Pruebas.md` §4.1 (p95 87,02 ms en C1, 249,36 ms en C10) |
| Manual de despliegue en servidor | Fuera del alcance de la Iteración 2 | No aplica |

## 5. Registro de la revisión post-auditoría (2026-11-13)

| Propiedad | Valor |
|---|---|
| Documentos Markdown en `Documentacion/` | 18 (00–11, 13–17 y plan de correcciones) |
| Documentos eliminados | 0 |
| Cambios funcionales de esta corrección | Consentimiento estricto; acciones del historial una vez por movimiento |
| Cambios aplicados a base real `autoscolombia` | Ninguno |
| Pruebas automatizadas actuales | 52/52 aprobadas; MySQL temporal |
| Build / lint frontend | Build correcto; 0 errores y 14 advertencias |
| Pruebas manuales M-01 a M-18 | **33/33 automatizadas y aprobadas** (arnés Playwright versionado; base efímera; 43 capturas únicas) |
| RNF-03 | **Medido con benchmark representativo:** p95 87,02 ms (concurrencia 1) y 249,36 ms (concurrencia 10) sobre el historial con 400 clientes, 400 vehículos y 4.000 movimientos; límite 3.000 ms |
| Commits/push realizados | 0 (pendientes de autorización) |
