# 17 · Informe de cierre final EA2 — AutosColombia (Iteración 2)

- **Proyecto:** AutosColombia — Sistema de gestión de parqueadero.
- **Actividad:** Evidencia de Aprendizaje 2 (EA2) — Diseño Sistema de Información: Gestión de Usuarios y Celdas.
- **Fuente académica:** `Grupo03_Iteracion_2_EA2.docx` (RF-01 a RF-38, RNF-01 a RNF-13, HU-01 a HU-38).
- **Rama de trabajo:** `Iteracion_2`.
- **Ruta local:** `C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia`.
- **Fecha del informe:** 2026-11-13.
- **Objeto:** consolidar el estado real y comprobable del sistema y de sus soportes, y emitir el dictamen de preparación para evaluación y publicación.

> Este informe reemplaza como dictamen vigente a [`15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md`](15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md) y a [`16_Informe_Final_Correcciones_EA2.md`](16_Informe_Final_Correcciones_EA2.md), que se conservan como antecedentes de la línea base y de las correcciones intermedias. Todos los datos aquí consignados son comprobables contra el repositorio, la ejecución de las pruebas y la base de datos MySQL.

---

## 1. Resumen ejecutivo

El sistema AutosColombia (Iteración 2) implementa la gestión de entrada y salida de vehículos, la autenticación y gestión de usuarios, la gestión de clientes, vehículos y mensualidades, la gestión de celdas, la corrección de movimientos y la auditoría, conforme a los requisitos RF-01 a RF-38 y RNF-01 a RNF-13 de la EA2.

**Estado de los requisitos (método de cálculo):** se cuenta como **cumplido pleno** únicamente el requisito con implementación verificable en el código y, cuando aplica, con prueba y evidencia asociada. Los requisitos con una limitación concreta se cuentan como **parcial** y no se ponderan como medio cumplimiento; no se cuentan como cumplidos.

| Alcance | Cumplido pleno | Parcial | No verificado | Total | Cumplimiento pleno |
|---|---:|---:|---:|---:|---:|
| RF-01 a RF-38 | 37 | 1 | 0 | 38 | 37/38 = **97,4 %** |
| RNF-01 a RNF-13 | 13 | 0 | 0 | 13 | 13/13 = **100 %** |
| **Total** | **50** | **1** | **0** | **51** | 50/51 = **98,0 %** |

- El único requisito **parcial** es **RF-12** (recuperación de contraseña por correo): la lógica local (token de un solo uso, vigencia, desbloqueo, validación de política) está implementada y probada; el **envío real de correo** queda excluido por decisión de alcance (§9 de la orden) al no configurarse un proveedor SMTP/API externo.

**Validaciones reejecutadas (2026-11-13, laboratorio local):**

| Verificación | Comando | Resultado real |
|---|---|---|
| Pruebas del backend (unitarias + integración) | `npm test` (`backend`) | **52/52 aprobadas** (35 unitarias + 17 de integración), 0 fallidas, 0 omitidas |
| Integración real con MySQL | incluida en `npm test` | base temporal `autoscolombia_test_<pid>`, schema + migraciones `002–011` |
| Compilación del frontend | `npm run build` (`frontend`) | OK, **29 módulos** |
| Lint del frontend | `npm run lint` (`frontend`) | **0 errores**, 14 advertencias |
| Escenarios manuales M-01 a M-18 | `npm run test:e2e` (Playwright) | **33/33 aprobadas**, **43 capturas** únicas |
| Rendimiento RNF-03 | `npm run rendimiento:rnf03` | **1/1 aprobada**: p95 **87,02 ms** (C1) y **249,36 ms** (C10); SQL 84,9 ms |
| Instalación limpia en base aislada | arnés / integración | esquema + **11 scripts** (schema + `002–011`) aplicados y eliminados |

**Resultado:** el sistema, los documentos y las evidencias quedan **preparados para evaluación y publicación**. No se realizó commit, push ni merge; no se modificó `main`.

---

## 2. Correcciones realizadas

1. **Normalización de mensualidades (30 días calendario):** nueva migración `011` (idempotente) que aplica `fecha_fin = fecha_inicio + 29`, respalda cada cambio y recalcula estados. Se ejecutó sobre la base real `autoscolombia` (ver §14).
2. **Integridad de mensualidades:** migración `010` incorpora el CHECK `chk_suscripcion_30_dias` con un *preflight* que aborta si existen períodos irregulares; su orden de ejecución es posterior a `011`.
3. **Datos obligatorios de clientes:** migración `008` (columnas aditivas `nombres`/`apellidos`) y validaciones de backend en `validators/gestion.js`.
4. **Históricos inmutables:** migración `009` con disparadores que rechazan `UPDATE`/`DELETE` sobre `auditoria_eventos`, `auditoria_autenticacion`, `historial_celdas` y `historial_titulares_vehiculo`.
5. **Estados de mensualidad EA2:** migración `006` (`PROGRAMADA`, `VIGENTE`, `VENCIDA`, `CANCELADA`).
6. **Tipo de vehículo `CAMIONETA`:** migración `007` (las camionetas usan celdas de carro).
7. **Seguridad de MySQL:** separación de cuentas de ejecución y administrativa; script `backend/scripts/crear-usuarios-bd.js` (ver §8).
8. **Autenticación y gestión de usuarios:** inicio/cierre de sesión, cambio obligatorio de contraseña temporal, bloqueo por intentos, recuperación local, desbloqueo, suspensión/desvinculación/reactivación, control por perfil.
9. **Clientes, vehículos y mensualidades:** registro transaccional cliente+vehículo, cambio de titular con historial, registro/modificación de mensualidad.
10. **Celdas:** creación, modificación, bloqueo/desbloqueo e historial de celda.
11. **Corrección de movimientos:** anulación y modificación **integradas como acciones de fila** en el Historial de Movimientos (RF-07/35/36), con motivo obligatorio, permisos y auditoría.
12. **Perfil de usuario:** "Mi cuenta" y cambio de contraseña (RF-10) centralizados en el menú desplegable del ícono de usuario de la cabecera.
13. **UI de gestión:** componente compartido `Modal.jsx` para formularios de creación/edición/acciones.
14. **Documentación y evidencias:** actualización de los documentos académicos y organización de las capturas M-01…M-18.

---

## 3. Matriz RF-01 a RF-38

Estados: **C** = Cumplido pleno · **P** = Parcial · **N** = No cumplido. Cada fila remite a la historia y a la prueba/evidencia.

| RF | Nombre (EA2) | HU | Implementación (componente · endpoint · servicio · tabla) | Prueba | Evidencia | Estado |
|---|---|---|---|---|---|---|
| RF-01 | Registrar entrada de vehículo | HU-01 | `Movimientos.jsx` · `POST /api/movimientos/entrada` · `movimientos.service.js` · `movimientos`, `celdas` | T-32, T-40, M-01 | Ev. M-01 | C |
| RF-02 | Validar ingreso del vehículo | HU-02 | `Movimientos.jsx` · `POST /api/movimientos/entrada` · `movimientos.service.js` | T-33, T-34, T-37, M-02 | Ev. M-02 | C |
| RF-03 | Consultar registro de entrada | HU-03 | `Movimientos.jsx` · `GET /api/movimientos` · `movimientos.service.js` | M-03 | Ev. M-03 | C |
| RF-04 | Registrar salida del vehículo | HU-04 | `Movimientos.jsx` · `POST /api/movimientos/salida` · `movimientos.service.js` | T-35, M-04 | Ev. M-04 | C |
| RF-05 | Validar salida del vehículo | HU-05 | `Movimientos.jsx` · `POST /api/movimientos/salida` · `movimientos.service.js` | T-36, M-05 | Ev. M-05 | C |
| RF-06 | Consultar disponibilidad y estado de celdas | HU-06 | `Celdas.jsx` · `GET /api/celdas/estado` · `celdas.service.js` · `celdas` | T-31, M-06 | Ev. M-06 | C |
| RF-07 | Consultar movimientos (activos/finalizados/anulados) | HU-07 | `Movimientos.jsx` · `GET /api/movimientos` · `movimientos.service.js` | T-05–T-11, M-07 | Ev. M-07 | C |
| RF-08 | Iniciar sesión | HU-08 | `Login` (`App.jsx`) · `POST /api/auth/login` · `auth.service.js` · `sesiones_operadores` | M-08 | Ev. M-08 | C |
| RF-09 | Cerrar sesión (manual e inactividad) | HU-09 | `App.jsx` · `POST /api/auth/logout` · `auth.service.js` (90 min) | M-09 | Ev. M-09 | C |
| RF-10 | Cambiar contraseña (y temporal obligatoria) | HU-10 | `Cuenta.jsx` · `PUT /api/auth/password` · `auth.service.js` | T-02, T-18–T-23, M-10 | Ev. M-10 | C |
| RF-11 | Bloquear cuenta por intentos fallidos | HU-11 | `auth.service.js` (5 intentos) · `operadores` | M-11 | Ev. M-11 | C |
| RF-12 | Recuperar contraseña por correo | HU-12 | `Recuperacion.jsx` · `POST /api/auth/recuperar` y `PUT /api/auth/restablecer` · `auth.service.js`, `correo.service.js` · `recuperacion_password` | M-12 | Ev. M-12 | **P** (envío externo pendiente) |
| RF-13 | Desbloquear cuenta | HU-13 | `Operadores.jsx` · `PUT /api/operadores/:id/desbloquear` · `operadores.service.js` | M-13 | Ev. M-13 | C |
| RF-14 | Controlar acceso según perfil | HU-14 | `auth.middleware.js` (`401`/`403`), navegación por rol | V-04, M-14 | Ev. M-14 | C |
| RF-15 | Ejecutar funciones del operador (admin) | HU-15 | `App.jsx`, `auth.middleware.js` (rol ADMINISTRADOR habilita operación) | M-15 | Ev. M-15 | C |
| RF-16 | Registrar operador | HU-16 | `Operadores.jsx` · `POST /api/operadores` · `operadores.service.js`, `validators/gestion.js` | T-28, M-16 | Ev. M-16 | C |
| RF-17 | Consultar usuarios del sistema | HU-17 | `Operadores.jsx` · `GET /api/operadores` · `operadores.service.js` | M-17 | Ev. M-17 | C |
| RF-18 | Modificar datos del operador | HU-18 | `Operadores.jsx` · `PUT /api/operadores/:id` · `operadores.service.js` | M-18 | Ev. M-18 | C |
| RF-19 | Suspender operador | HU-19 | `Operadores.jsx` · `PUT /api/operadores/:id/suspender` · `operadores.service.js` | M-18 | Ev. M-18 | C |
| RF-20 | Desvincular operador | HU-20 | `Operadores.jsx` · `PUT /api/operadores/:id/desvincular` · `operadores.service.js` | M-18 | Ev. M-18 | C |
| RF-21 | Reactivar operador | HU-21 | `Operadores.jsx` · `PUT /api/operadores/:id/reactivar` · `operadores.service.js` | M-18 | Ev. M-18 | C |
| RF-22 | Consultar cliente por documento | HU-22 | `Clientes.jsx` · `GET /api/clientes/:documento` · `clientes.service.js` | M-12, M-17 | Ev. M-17 | C |
| RF-23 | Registrar cliente con su vehículo (transaccional) | HU-23 | `Clientes.jsx` · `POST /api/clientes` (alta transicional) · `clientes.service.js`, `validators/gestion.js` | T-42, T-31, M-17 | Ev. M-17 | C |
| RF-24 | Agregar vehículo a cliente existente | HU-24 | `Clientes.jsx` · `POST /api/vehiculos` · `vehiculos.service.js` | T-41, M-16 | Ev. M-16 | C |
| RF-25 | Modificar datos del cliente | HU-25 | `Clientes.jsx` (deshabilitado a operador) · `PUT /api/clientes/:id` · `clientes.service.js` | M-17 | Ev. M-17 | C |
| RF-26 | Modificar datos del vehículo | HU-26 | `Vehiculos.jsx` · `PUT /api/vehiculos/:id` · `vehiculos.service.js` | T-24–T-30 | Ev. M-16 | C |
| RF-27 | Registrar cambio de titular | HU-27 | `Vehiculos.jsx` · `PUT /api/vehiculos/:id/titular` · `vehiculos.service.js` · `historial_titulares_vehiculo` | M-16 | Ev. M-16 | C |
| RF-28 | Registrar mensualidad (30 días) | HU-28 | `Suscripciones.jsx` · `POST /api/suscripciones` · `suscripciones.service.js` · `suscripciones` | T-12–T-17, T-38, M-01 | Ev. M-01 | C |
| RF-29 | Modificar mensualidad | HU-29 | `Suscripciones.jsx` · `PUT /api/suscripciones/:id` · `suscripciones.service.js` | T-12–T-17 | Ev. M-01 | C |
| RF-30 | Crear celda | HU-30 | `Celdas.jsx` · `POST /api/celdas` · `celdas.service.js` | T-31, M-06 | Ev. M-06 | C |
| RF-31 | Modificar celda | HU-31 | `Celdas.jsx` · `PUT /api/celdas/:id` · `celdas.service.js` | M-06 | Ev. M-06 | C |
| RF-32 | Bloquear celda | HU-32 | `Celdas.jsx` · `PUT /api/celdas/:id/bloquear` · `celdas.service.js` | M-06 | Ev. M-06 | C |
| RF-33 | Desbloquear celda | HU-33 | `Celdas.jsx` · `PUT /api/celdas/:id/desbloquear` · `celdas.service.js` | M-06 | Ev. M-06 | C |
| RF-34 | Consultar historial de una celda | HU-34 | `Celdas.jsx` · `GET /api/celdas/:id/historial` · `celdas.service.js` · `historial_celdas` | M-06 | Ev. M-06 | C |
| RF-35 | Anular movimiento (lógica, con motivo) | HU-35 | `MovimientosAdmin.jsx` · `PUT /api/movimientos/:id/anular` · `movimientos.admin.service.js` | T-39, M-07 | Ev. M-07 | C |
| RF-36 | Modificar movimiento (permitidos) | HU-36 | `MovimientosAdmin.jsx` · `PUT /api/movimientos/:id` · `movimientos.admin.service.js` | T-39, M-07 | Ev. M-07 | C |
| RF-37 | Registrar auditoría | HU-37 | `auditoria.service.js` · `auditoria_eventos`, `auditoria_autenticacion` | T-32, T-35, T-39, RNF-07 | Ev. M-11 | C |
| RF-38 | Consultar auditoría | HU-38 | `Auditoria.jsx` · `GET /api/auditoria` · `auditoria.service.js` | M-18 | Ev. M-18 | C |

> Nota RF-12: el componente de envío externo queda pendiente por decisión de alcance (§9), por lo que se declara **parcial** y no se presenta como plenamente cumplido en su componente de envío.

---

## 4. Matriz RNF-01 a RNF-13

| RNF | Categoría | Criterio de aceptación (EA2) | Evidencia de cumplimiento | Estado |
|---|---|---|---|---|
| RNF-01 | Usabilidad | Operaciones completables sin instrucciones externas | Formularios y mensajes en `Modal.jsx`; 33/33 escenarios E2E | C |
| RNF-02 | Integridad | No se registra salida sin entrada asociada | T-36; `movimientos.service.js` | C |
| RNF-03 | Rendimiento | Consultas habituales ≤ 3 s | Benchmark: p95 87,02 ms (C1), 249,36 ms (C10); SQL 84,9 ms | C |
| RNF-04 | Seguridad (credenciales) | Hash, nunca texto plano; política mínima (EA2: 8+ con letras y números) | `scrypt`; política aplicada de **10+** caracteres con letras y números (más estricta). T-01, T-02, T-18–T-23 | C |
| RNF-05 | Seguridad (sesión) | Expiración por inactividad y límite de intentos | `SESION_MINUTOS = 90`; bloqueo a los 5 intentos. M-08, M-11 | C |
| RNF-06 | Seguridad (autorización) | Rol validado en backend; 401/403 por API | `auth.middleware.js`; M-14, V-04 | C |
| RNF-07 | Trazabilidad | Auditoría con usuario/fecha/hora del servidor; no editable ni eliminable | `auditoria.service.js`; cuenta de ejecución sin `UPDATE`/`DELETE` en tablas de auditoría; disparadores de `009` | C |
| RNF-08 | Integridad (historial) | Bajas lógicas con motivo; historial consultable | T-39; `anulado_en`, `estado`, `activo` | C |
| RNF-09 | Integridad (unicidad) | Documento, placa y código únicos; un movimiento activo por vehículo/celda; una mensualidad vigente | T-41; índices `uq_*` y columnas generadas | C |
| RNF-10 | Integridad (atomicidad) | Operaciones compuestas completas o ninguna | T-42 (cliente+vehículo revierte todo) | C |
| RNF-11 | Usabilidad (por perfil) | Pantallas por perfil y rechazos con motivo | `App.jsx` (navegación por rol); opciones de admin deshabilitadas al operador | C |
| RNF-12 | Protección de datos | Autorización con fecha (Ley 1581) y consulta autenticada | `clientes.autorizacion_datos`/`autorizacion_fecha`; T-31, revocación auditada | C |
| RNF-13 | Mantenibilidad | Módulos con capa de servicio y API con códigos HTTP estándar | `backend/src/{routes,services,validators}`; códigos 400/401/403/404/409 | C |

> Nota RNF-04: la EA2 exige mínimo 8 caracteres; el sistema aplica una política **más estricta** (10+ con letras y números), por lo que satisface el criterio con holgura.

---

## 5. HU-01 a HU-38

Las 38 historias están documentadas con los campos exigidos (identificador, actor, necesidad, beneficio, criterios de aceptación, RF/RNF relacionados, funcionalidad, componente frontend, endpoint, servicio, tablas, prueba, evidencia y estado) en [`03_Historias_Usuario.md`](03_Historias_Usuario.md), junto con la **matriz de trazabilidad `EA2 → HU → RF/RNF → componente → endpoint → servicio → tabla → prueba → evidencia`**.

| HU | RF | Módulo | Estado | HU | RF | Módulo | Estado |
|---|---|---|---|---|---|---|---|
| HU-01 | RF-01 | Entrada/salida | C | HU-20 | RF-20 | Usuarios | C |
| HU-02 | RF-02 | Entrada/salida | C | HU-21 | RF-21 | Usuarios | C |
| HU-03 | RF-03 | Entrada/salida | C | HU-22 | RF-22 | Clientes | C |
| HU-04 | RF-04 | Entrada/salida | C | HU-23 | RF-23 | Clientes | C |
| HU-05 | RF-05 | Entrada/salida | C | HU-24 | RF-24 | Clientes | C |
| HU-06 | RF-06 | Entrada/salida | C | HU-25 | RF-25 | Clientes | C |
| HU-07 | RF-07 | Entrada/salida | C | HU-26 | RF-26 | Vehículos | C |
| HU-08 | RF-08 | Seguridad | C | HU-27 | RF-27 | Vehículos | C |
| HU-09 | RF-09 | Seguridad | C | HU-28 | RF-28 | Mensualidades | C |
| HU-10 | RF-10 | Seguridad | C | HU-29 | RF-29 | Mensualidades | C |
| HU-11 | RF-11 | Seguridad | C | HU-30 | RF-30 | Celdas | C |
| HU-12 | RF-12 | Seguridad | **P** | HU-31 | RF-31 | Celdas | C |
| HU-13 | RF-13 | Seguridad | C | HU-32 | RF-32 | Celdas | C |
| HU-14 | RF-14 | Seguridad | C | HU-33 | RF-33 | Celdas | C |
| HU-15 | RF-15 | Seguridad | C | HU-34 | RF-34 | Celdas | C |
| HU-16 | RF-16 | Usuarios | C | HU-35 | RF-35 | Corrección/auditoría | C |
| HU-17 | RF-17 | Usuarios | C | HU-36 | RF-36 | Corrección/auditoría | C |
| HU-18 | RF-18 | Usuarios | C | HU-37 | RF-37 | Corrección/auditoría | C |
| HU-19 | RF-19 | Usuarios | C | HU-38 | RF-38 | Corrección/auditoría | C |

Totales: **37 cumplidas plenamente y 1 parcial (HU-12/RF-12)**.

---

## 6. Estado de la base de datos

Base verificada: `autoscolombia` (MySQL 8.4.13, `utf8mb4_unicode_ci`). Conteos exactos al 2026-11-13:

| Tabla | Filas | Rol |
|---|---:|---|
| `operadores` | 3 | Usuarios del sistema |
| `sesiones_operadores` | 52 | Sesiones activas/registradas |
| `clientes` | 3 | Clientes |
| `vehiculos` | 4 | Vehículos |
| `celdas` | 81 | Celdas del parqueadero |
| `movimientos` | 8 | Entradas/salidas |
| `suscripciones` | 2 | Mensualidades |
| `historial_celdas` | 5 | Historial de celdas |
| `historial_titulares_vehiculo` | 0 | Historial de titulares |
| `recuperacion_password` | 1 | Tokens de recuperación |
| `auditoria_eventos` | 4 | Auditoría de operaciones |
| `auditoria_autenticacion` | 85 | Auditoría de autenticación |
| `suscripciones_respaldo_normalizacion` | 1 | Respaldo de normalización (011) |
| `mensualidades_sin_conciliar` | 0 | Casos sin conciliar |

**Tablas auxiliares/de soporte:** `auditoria_eventos_backup_dep_20261113` (6 filas) y `auditoria_rectificaciones_texto` (1 fila).

**Migraciones aplicadas en la base real:** `schema`, `002`, `003`, `004`, `005`, `006`, `007`, `011`.
**Migraciones aditivas pendientes de aplicar en la base real:** `008` (`clientes.nombres`/`apellidos`), `009` (disparadores append-only) y `010` (CHECK `chk_suscripcion_30_dias`). Su ejecución en la base real requiere una ventana de mantenimiento con respaldo; en una **instalación limpia** los 11 scripts producen la estructura canónica completa. El detalle de las diferencias as-built está en [`05_Modelo_Entidad_Relacion.md`](05_Modelo_Entidad_Relacion.md) §5.

---

## 7. Migraciones

Carpeta conservada: `backend/sql/migrations` (no se eliminó ninguna). Orden de ejecución documentado en [`07_Orden_Migraciones.md`](07_Orden_Migraciones.md).

| Script | Cambios | Idempotente |
|---|---|---|
| `schema.sql` | Base del modelo (tablas núcleo) | — |
| `002_autenticacion_operadores.sql` | `sesiones_operadores`, credenciales de operadores | — |
| `003_gestion_celdas_auditoria.sql` | Historial de celdas, auditoría, columnas canónicas | — |
| `004_iteracion2_auditoria_movimientos.sql` | Auditoría de movimientos (anulación/observaciones) | — |
| `005_cierre_iteracion2_seguridad.sql` | `recuperacion_password`, `historial_titulares_vehiculo`, `password_temporal`, `email`, `apellidos`, `motivo_cancelacion` | — |
| `006_estados_suscripcion_ea2.sql` | ENUM de `suscripciones.estado` → `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` | Sí |
| `007_tipo_vehiculo_camioneta.sql` | ENUM de `vehiculos.tipo` → incluye `CAMIONETA` | Sí |
| `008_datos_obligatorios_clientes.sql` | Columnas aditivas `clientes.nombres`/`apellidos` | Sí |
| `009_historicos_append_only.sql` | Disparadores que rechazan `UPDATE`/`DELETE` en históricos | Sí |
| `011_normalizacion_mensualidades_30_dias.sql` | `fecha_fin = fecha_inicio + 29`; respaldo y recálculo de estados | Sí |
| `010_integridad_campos_ea2.sql` | CHECK `chk_suscripcion_30_dias` (con *preflight*) y restricciones EA2 | Sí |

**Orden canónico de instalación limpia (11 pasos):** `schema.sql` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → **`011`** → **`010`**.
> `011` **debe** ejecutarse **antes** de `010`, porque `010` valida en su *preflight* que no existan períodos irregulares.

**Validación:** la instalación completa se probó en bases temporales aisladas (`autoscolombia_test_<pid>` en las pruebas del backend y `autoscolombia_e2e_<pid>` en el arnés E2E), creadas y eliminadas por cada ejecución. Instrucciones diferenciadas (desde cero vs. actualización) en el README, §"Configuración de la base de datos".

---

## 8. Seguridad

**Separación de cuentas (hallazgo `root@localhost`):**

| Cuenta | Uso | Privilegios | Credencial |
|---|---|---|---|
| `autoscolombia_app` | Ejecución del backend | `SELECT/INSERT/UPDATE/DELETE` por tabla; en tablas de auditoría/históricos solo `SELECT`/`INSERT` (sin `UPDATE`/`DELETE`); **sin DDL** | En `backend/.env` (no versionado) |
| `autoscolombia_admin` | Instalación/migraciones/mantenimiento | Administrativa (DDL, grants) | En `backend/.env` (no versionado) |
| `root` | Emergencias | Total | No usada por la aplicación en operación normal |

- Aprovisionamiento reproducible con `npm run crear-usuarios-bd` (`backend/scripts/crear-usuarios-bd.js`); las contraseñas se escriben en `backend/.env`, que **no** está versionado.
- El **usuario de ejecución no puede modificar ni eliminar auditoría ni históricos** (restricción por privilegios), lo que satisface RNF-07.
- `backend/.env.example` documenta `DB_USER`, `DB_PASSWORD`, `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD`, `MAIL_*` y `APP_BASE_URL` **sin valores secretos**.
- No se incorporaron contraseñas, hashes, tokens ni datos personales al repositorio.

**Prueba en entorno aislado:** operaciones de consulta, inserción, actualización permitida, transacciones y auditoría verificadas; se comprobó el rechazo de modificación/eliminación de históricos.

---

## 9. Resultados de pruebas unitarias

Comando: `npm test` (backend). **35 pruebas unitarias/de validación**, todas aprobadas:

| Archivo | Casos | Cobertura funcional |
|---|---:|---|
| `auth.test.js` | 4 | Hash `scrypt`, política de contraseña, roles |
| `movimientos.filtros.test.js` | 7 | Filtros por estado (activos/finalizados/anulados) |
| `suscripciones.validation.test.js` | 6 | Regla de 30 días calendario y cálculo de vencimiento |
| `password.politica.test.js` | 6 | Política de contraseñas (letras+números, sin espacios) |
| `vehiculos.tipos.test.js` | 7 | Placas por tipo; camioneta usa celda de carro |
| `gestion.validation.test.js` | 5 | Campos obligatorios de operador/cliente/vehículo y consentimiento |
| **Total** | **35** | **35/35 aprobadas** |

---

## 10. Resultados de pruebas de integración

Comando: `npm test` (backend), archivo `backend/test/integracion/ciclo.operativo.test.js`. **17 pruebas de integración**, todas aprobadas contra MySQL real en base temporal:

- Cada ejecución crea `autoscolombia_test_<pid>`, aplica los **11 scripts** y elimina la base al terminar; no toca `autoscolombia`.
- Si MySQL o el cliente `mysql` no están disponibles, las pruebas se **omiten** (no fallan), para no dar falsos positivos.

Cobertura: esquema y restricciones EA2 (T-31), inmutabilidad de auditoría/históricos (RNF-07), rechazo de nulos y de períodos ≠ 30 días (RNF-02/RNF-09), entrada/salida con liberación de celda y auditoría (T-32/T-35), rechazos por vehículo no registrado, doble ingreso y sin mensualidad vigente (T-33/T-34/T-37), exigencia de 30 días y rechazo de traslapes (T-38), anulación con motivo y trazabilidad (T-39), camioneta en celda de carro (T-40), unicidad de placa (T-41), atomicidad cliente+vehículo (T-42), alta transicional sin vehículo/consentimiento, y revocación auditada de consentimiento.

**Resultado:** 17/17 aprobadas. Total backend: **52/52** (35 unitarias + 17 de integración).

---

## 11. Resultados de los escenarios M-01 a M-18

Los 18 escenarios manuales se **reejecutaron** con el arnés Playwright versionado (`frontend/e2e/`, `npm run test:e2e`): **33 pruebas, 33 aprobadas, 43 capturas únicas**. Las capturas están en `Documentacion/Evidencias/Iteracion_2/`. El detalle por escenario está en [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md).

| Escenario | Tema | Resultado |
|---|---|---|
| M-01 | Registrar entrada y asignar celda | Aprobado |
| M-02 | Rechazo de ingreso sin mensualidad vigente | Aprobado |
| M-03 | Consultar entrada por placa | Aprobado |
| M-04 | Registrar salida y liberar celda | Aprobado |
| M-05 | Rechazo de salida sin entrada activa | Aprobado |
| M-06 | Gestión de celdas (crear/modificar/bloquear/desbloquear/historial) | Aprobado |
| M-07 | Historial de movimientos, anulación y corrección | Aprobado |
| M-08 | Inicio de sesión (éxito y error) | Aprobado |
| M-09 | Cierre de sesión | Aprobado |
| M-10 | Cambio de contraseña (incl. temporal) | Aprobado |
| M-11 | Bloqueo por intentos fallidos y auditoría | Aprobado |
| M-12 | Recuperación de contraseña (flujo local) | Aprobado (envío externo pendiente) |
| M-13 | Desbloqueo y contraseña temporal | Aprobado |
| M-14 | Control de acceso por perfil | Aprobado |
| M-15 | Administrador ejecuta funciones de operador | Aprobado |
| M-16 | Clientes, vehículos y cambio de titular | Aprobado |
| M-17 | Registrar cliente con vehículo y modificar cliente | Aprobado |
| M-18 | Usuarios del sistema y consulta de auditoría | Aprobado |

---

## 12. Evidencias

- **Ubicación:** `Documentacion/Evidencias/Iteracion_2/` — **43 capturas** PNG.
- **Trazabilidad:** cada captura se relaciona con su escenario M, su requisito (RF/RNF) y su historia (HU) en [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md).
- **Integridad:** no se duplican capturas ni se presenta una misma imagen como si demostrara escenarios distintos; el reporte de codificación y las filas de prueba del arnés respaldan cada escenario.
- **Reportes de prueba:** salidas de `npm test` (52/52), `npm run build` (29 módulos), `npm run lint` (0 errores/14 advertencias), `npm run test:e2e` (33/33) y `npm run rendimiento:rnf03` (1/1).

---

## 13. Rendimiento

- **Requisito:** RNF-03 — consultas habituales ≤ 3.000 ms "bajo las condiciones de prueba definidas".
- **Escenario:** historial `GET /api/movimientos?limite=200` con **400 clientes, 400 vehículos, 4.000 movimientos y 80 celdas**, medido con `frontend/e2e/rendimiento/rnf03.spec.js` (`npm run rendimiento:rnf03`).

| Métrica | Concurrencia 1 | Concurrencia 10 |
|---|---:|---:|
| p50 | 72,23 ms | 213,38 ms |
| p95 | **87,02 ms** | **249,36 ms** |
| Límite RNF-03 | 3.000 ms | 3.000 ms |

- **Plan real de la consulta (SQL):** 84,9 ms.
- **Revalidación (misma fecha, nueva corrida):** C1 → p50 65,67 ms · p95 **109,04 ms** · máx 118,96 ms; C10 → p50 33,67 ms · p95 **224,42 ms** · máx 229,17 ms; SQL 50 ms. Los valores fluctúan entre corridas por la naturaleza del banco local (JIT, cachés, planificador); en ambas corridas el p95 en C10 se mantiene muy por debajo del límite.
- **Alcance:** banco de pruebas local; no se ha verificado bajo carga en producción. Aun así, el p95 en C10 (≤ 249,36 ms) queda muy por debajo del límite de 3.000 ms.

---

## 14. Estado de mensualidades y conciliación

**Resultado final:** todas las mensualidades de la base real cumplen **30 días calendario** (`fecha_fin = fecha_inicio + 29`). Estado de `suscripciones`:

| id | vehiculo_id | valor | estado | fecha_inicio | fecha_fin | días |
|---:|---:|---:|---|---|---|---:|
| 1 | 2 | 150.000,00 | VIGENTE | 2026-11-04 | 2026-12-03 | 30 |
| 2 | 1 | 150.000,00 | VIGENTE | 2026-11-13 | 2026-12-12 | 30 |

**Caso conciliado (suscripciones.id = 1):** migración `011`, con respaldo verificable.

| Registro de respaldo | Valor |
|---|---|
| `estado_anterior` | VIGENTE |
| `fecha_inicio` (se conserva) | 2026-11-04 |
| `fecha_fin_anterior` | 2027-11-03 (365 días) |
| `estado_nuevo` | VIGENTE |
| `fecha_fin_nueva` | 2026-12-03 (30 días) |
| `respaldado_en` | 2026-11-13 21:58:32 |

- **Registros sin conciliar:** 0 (`mensualidades_sin_conciliar` vacía).
- **Impacto verificado:** no se generaron períodos traslapados; no se alteró la autorización de ingreso de vehículos; no se eliminaron mensualidades ni movimientos históricos.
- Cada corrección conserva trazabilidad (valor anterior/nuevo, fecha y el registro de respaldo). El reporte completo está en [`12_Reporte_Conciliacion_Mensualidades.md`](12_Reporte_Conciliacion_Mensualidades.md).

---

## 15. Limitaciones y pendientes

| # | Limitación / pendiente | Causa | Impacto | Decisión pendiente |
|---|---|---|---|---|
| L-01 | RF-12: envío real de correo | No se configura proveedor SMTP/API externo (decisión de alcance §9) | El enlace de recuperación se registra en consola (`MAIL_PROVIDER=consola`); la lógica local está completa | Configurar `MAIL_PROVIDER=http` y credenciales para producción |
| L-02 | Migraciones `008`, `009` y `010` no aplicadas a la base real | Requieren ventana de mantenimiento con respaldo | La base real no tiene aún las columnas aditivas ni los disparadores/CHECK; la app valida en el API | Programar su aplicación en la base real |
| L-03 | RNF-03 medido solo en laboratorio | Sin entorno de producción con carga real | El resultado no representa carga de producción | Repetir el benchmark en el entorno definitivo |
| L-04 | Sesiones y datos de demostración en la base real | Datos de pruebas realizadas | `sesiones_operadores` (52) y auditorías incluyen registros de prueba | Depurar antes de la publicación si se requiere un estado limpio |
| L-05 | Repositorio no sincronizado | No se autorizó commit/push | Los cambios existen solo en local (`Iteracion_2`) | Recibir autorización para commit/push |

---

## 16. Documentación actualizada

| Documento | Estado |
|---|---|
| `README.md` | Actualizado (tecnologías, orden de migraciones de 11 pasos, seguridad de cuentas, pruebas, estado de RF-12) |
| `00_Inventario_Soportes.md` | Nota de vigencia y soportes actualizados |
| `01_Funcionalidades_Implementadas.md` | Nota post-auditoría actualizada |
| `02_Matriz_Requisitos.md` | Matriz y verificación RNF-03 actualizadas |
| `03_Historias_Usuario.md` | HU-01 a HU-38 con los 15 campos y matriz de trazabilidad |
| `04_Diagramas.md` | Casos de uso, casos de uso por módulo y estados actualizados |
| `05_Modelo_Entidad_Relacion.md` | ERD, relaciones, reglas y as-built según MySQL real (migraciones 002–011) |
| `06_Diccionario_Datos.md` | Tablas, campos, tipos, índices y reglas; incluye tablas de 005 y 011 |
| `07_Orden_Migraciones.md` | Orden canónico con `011` antes de `010` |
| `09_Matriz_Pruebas.md` | 52/52, 11 scripts, benchmark real |
| `10_Auditoria_Cumplimiento_EA2.md` | Registro histórico; vigencia remite a este informe |
| `11_Informe_Final_Iteracion2.md` | Informe de iteración alineado |
| `12_Reporte_Conciliacion_Mensualidades.md` | Reporte de conciliación |
| `13_Evidencias_Pruebas_Manuales.md` | M-01 a M-18 reejecutadas (33/33, 43 capturas) |
| `14_Acta_Cierre_Iteracion2.md` | Acta de cierre actualizada |
| `15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md` | Antecedente; remite a este informe |
| `16_Informe_Final_Correcciones_EA2.md` | Antecedente intermedio; remite a este informe |
| `17_Informe_Cierre_Final_EA2.md` | **Este informe (vigente)** |

---

## 17. Estado de Git

- **Ruta local:** `C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia`.
- **Rama actual:** `Iteracion_2`.
- **Último commit:** `1ffb4f2 Implementa autenticacion y gestion de operadores - Iteracion 2`.
- **Remoto:** `origin` → `https://github.com/JaimePuerto/AutosColombia.git`.
- **Estado:** 71 entradas locales, **0 staged**; **31 modificados**, **39 nuevos**, **1 eliminado**. No se descartó, preparó, ni confirmó ningún cambio.

**Modificados (31):** `.gitignore`, `README.md`, `backend/.env.example`, `backend/package.json`, `backend/sql/schema.sql`, `backend/sql/migrations/002_autenticacion_operadores.sql`, `backend/src/app.js`, `backend/src/config/database.js`, `backend/src/middleware/auth.middleware.js`, `backend/src/routes/{auth,celdas,clientes,dashboard,movimientos,operadores,suscripciones,vehiculos}.routes.js`, `backend/src/services/{auth,clientes,movimientos,operadores,suscripciones,vehiculos}.service.js`, `backend/src/validators/placas.js`, `frontend/.oxlintrc.json`, `frontend/index.html`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/App.jsx`, `frontend/src/App.css`, `frontend/src/components/Clientes.jsx`.

**Nuevos (39):** carpeta `Documentacion/`; `backend/scripts/crear-usuarios-bd.js`; migraciones `003`–`011`; `backend/src/routes/{auditoria,movimientos.admin}.routes.js`; `backend/src/services/{auditoria,celdas,correo,movimientos.admin}.service.js`; `backend/src/validators/{gestion,password}.js`; pruebas `backend/test/{gestion.validation,movimientos.filtros,password.politica,suscripciones.validation,vehiculos.tipos}.test.js` y `backend/test/integracion/`; arnés `frontend/e2e/`, `frontend/playwright.config.js`, `frontend/playwright.rendimiento.config.js`; componentes `frontend/src/components/{Auditoria,Celdas,Cuenta,Modal,MovimientosAdmin,Operadores,Recuperacion,Suscripciones,Vehiculos}.jsx` y `{Auditoria,Celdas}.css`.

**Eliminado (1):** `IMPLEMENTACION_AUTENTICACION_ITERACION_2.md` (movido a la carpeta local `Implementaciones/`, excluida por `.gitignore`).

**Control de secretos:** no se versionan `backend/.env` real, `node_modules`, `dist` ni artefactos de prueba (`test-results/` y `playwright-report/` quedaron en `.gitignore`).

> No se realizó **commit, push ni merge**, y **no se modificó `main`**, conforme a la orden.

---

## 18. Dictamen de preparación para publicación

**Dictamen: el sistema y sus soportes quedan PREPARADOS para evaluación y publicación en GitHub**, con las limitaciones declaradas en §15.

Fundamentos:

1. **Requisitos:** 50/51 (98,0 %) cumplidos plenamente (37/38 RF y 13/13 RNF). El único parcial (RF-12) está identificado, justificado por decisión de alcance y no se presenta como cumplido.
2. **Mensualidades:** normalizadas a 30 días calendario en la base real, con respaldo verificable y trazabilidad; 0 casos sin conciliar.
3. **Seguridad:** cuentas de ejecución y administrativa separadas; la cuenta de ejecución no puede modificar ni eliminar auditoría ni históricos; `.env.example` y README sin secretos.
4. **Migraciones:** carpeta conservada, orden documentado (`011` antes de `010`), instalación limpia validada en base aislada, instrucciones diferenciadas.
5. **Trazabilidad:** HU-01 a HU-38 documentadas con matriz completa y correspondencia con diagramas, código, base de datos y evidencias.
6. **Pruebas:** 52/52 backend, 33/33 E2E (43 capturas) y 1/1 rendimiento; resultados reproducibles y documentados.
7. **Documentación y evidencias:** actualizadas y coherentes; informe de cierre generado.
8. **Git:** repositorio local preparado para revisión; sin commit/push/merge y sin cambios en `main`.

**Acciones sugeridas antes de publicar (no bloqueantes para la evaluación):**
1. Autorizar commit/push de la rama `Iteracion_2`.
2. Programar la aplicación de las migraciones `008`, `009` y `010` en la base real con respaldo.
3. Configurar `MAIL_PROVIDER=http` y credenciales para habilitar el envío real de correo (RF-12).
4. Repetir el benchmark RNF-03 en el entorno de producción.
5. Depurar, si se desea un estado limpio, las sesiones y auditorías de prueba de la base real.

**Cierre:** conforme a la orden vigente, el trabajo se detiene aquí. **No se realiza commit ni push hasta recibir autorización expresa.**
