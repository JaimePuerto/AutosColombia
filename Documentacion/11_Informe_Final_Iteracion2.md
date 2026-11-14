# Informe Final — Cierre de la Iteración 2 — AutosColombia

**Proyecto:** AutosColombia — Sistema de gestión de parqueadero
**Rama:** `Iteracion_2`
**Fuente oficial de requisitos:** `Grupo03_Iteracion_2_EA2`
**Línea base del diagnóstico:** `Documentacion/10_Auditoria_Cumplimiento_EA2.md`
**Fecha del cierre:** 2026-11-13
**Entorno:** Windows · Node.js · React + Vite · Express 5 · MySQL 8.4

> Este informe documenta **únicamente lo implementado y verificado** sobre el código real del repositorio. No se declara terminada una funcionalidad sin evidencia de su lógica, sus controles y su verificación. Los puntos no resueltos se registran con su causa.

> **Vigencia:** este cierre previo queda supersedido por el informe de cierre final [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md), que incorpora la última ejecución de 52/52 pruebas, el arnés E2E M-01…M-18 (33/33), el benchmark representativo de RNF-03, la conciliación de la mensualidad ID 1 (migración 011) y la separación de cuentas MySQL. Sus porcentajes, resultados manuales y la conclusión RNF-03 son históricos y no deben usarse como dictamen vigente.

---

## A. Resumen ejecutivo

Se ejecutó el cierre integral de la Iteración 2 sobre los 38 requerimientos funcionales (RF-01 a RF-38) y los 13 no funcionales (RNF-01 a RNF-13), respetando la arquitectura existente (Node/Express + `mysql2/promise` en backend, React/Vite en frontend) y sin commits, push ni cambios de rama.

**Resultado por estado (RF, estado final):**

| Estado | Antes (línea base) | Después (cierre) |
|---|---|---|
| IMPLEMENTADO | 18 | **37** |
| PARCIAL / LIMITACIÓN EXTERNA | 13 | **1** |
| NO IMPLEMENTADO | 7 | **0** |
| NO VERIFICABLE | 0 | **0** |

**Resultado por estado (RNF):**

| Estado | Antes | Después |
|---|---|---|
| IMPLEMENTADO / CON EVIDENCIA | 6 | **13** |
| PARCIAL / LIMITACIÓN IDENTIFICADA | 6 | **0** |
| NO IMPLEMENTADO / NO VERIFICABLE | 1 | **0** |

**Lo que se completó (desarrollo real):**

1. **Seguridad de contraseñas (RF-10, RF-12, RF-13):** cambio de contraseña con regla de política, cambio obligatorio de contraseña temporal, recuperación por correo con token de un solo uso (solo hash almacenado) y desbloqueo con contraseña temporal.
2. **Gestión de operadores (RF-16 a RF-21):** campos `apellidos` y `email` con unicidad, registro con contraseña temporal, edición con auditoría de valores, suspensión/desvinculación/reactivación con **motivo obligatorio** y auditoría, protección del último administrador activo, búsqueda server-side (RF-17).
3. **Clientes y vehículos (RF-22 a RF-27):** consulta por documento con estado de mensualidad, registro **transaccional** de cliente + vehículo + autorización de datos (RNF-10/RNF-12), mensaje de cambio de titular en placa duplicada, auditoría de modificaciones, bloqueo de cambio de tipo con movimiento activo y **flujo de cambio de titular con historial** (tabla `historial_titulares_vehiculo`).
4. **Mensualidades (RF-29):** modificación de la fecha de activación con recálculo del vencimiento, validación de traslapes y auditoría.
5. **Celdas (RF-31, RF-34):** snapshot de código/tipo de celda en cada entrada e **historial de celda unificado** (creación, modificación, bloqueo, desbloqueo, entradas, salidas y anulaciones).
6. **Movimientos (RF-35, RF-36):** interfaz administrativa de anulación y corrección (el backend ya existía).
7. **Auditoría (RF-37, RF-38):** registro de operadores, clientes y vehículos; consulta **unificada** de `auditoria_eventos` y `auditoria_autenticacion`; filtro por usuario en la interfaz.
8. **RF-01 / RF-24 / RF-03:** tipo `CAMIONETA` mapeado a celdas de carro, mensaje explícito de cambio de titular y consulta por placa.
9. **RF-28 (nomenclatura de estados):** la migración `006` alinea los estados a la nomenclatura de EA2 (`PROGRAMADA/VIGENTE/VENCIDA/CANCELADA`) de forma aditiva, traduciendo `PENDIENTE → PROGRAMADA` y `ACTIVA → VIGENTE`, sin perder filas.
10. **RF-17 y HU-07 (filtros server-side):** la búsqueda de operadores por documento/nombre/estado, el filtro de vehículos por tipo y los filtros de movimientos se resuelven en SQL, no en el cliente.

**Lo que quedó como LIMITACIÓN EXTERNA (1 RF) — con causa documentada:**

- **RF-12** (recuperación por correo): el flujo está implementado end-to-end y usa un proveedor configurable, pero **no hay proveedor de correo (SMTP/API) configurado**, por lo que el envío real no puede declararse probado. Con `MAIL_PROVIDER=consola` el sistema genera el enlace pero **no simula el envío** (dependencia externa — ver sección G).

**Migraciones de la base:** se añadieron las migraciones aditivas e idempotentes `005_cierre_iteracion2_seguridad.sql`, `006_estados_suscripcion_ea2.sql`, `007_tipo_vehiculo_camioneta.sql`, `008_datos_obligatorios_clientes.sql`, `009_historicos_append_only.sql`, `010_integridad_campos_ea2.sql` y `011_normalizacion_mensualidades_30_dias.sql`. Instalación limpia: `schema.sql` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `011` → `010` (011 antes de 010). No hubo operaciones destructivas ni modificación de datos reales salvo la conciliación autorizada de la mensualidad ID 1 (con respaldo y auditoría; ver [`12_Reporte_Conciliacion_Mensualidades.md`](12_Reporte_Conciliacion_Mensualidades.md)).

**Pruebas:** backend **52/52 aprobadas** (unitarias + integración real contra MySQL en base independiente, con los 11 scripts); frontend `build` correcto (29 módulos); `lint` **0 errores** (14 advertencias de estilo preexistentes); **pruebas de interfaz M-01 a M-18 reejecutadas (33/33)** con el arnés Playwright versionado. Detalle en la sección F.

---

## B. Matriz de Requerimientos Funcionales (RF-01 a RF-38)

Leyenda: **IMPLEMENTADO** (lógica y controles verificados) · **PARCIAL** (existe con una limitación identificada) · **NO IMPLEMENTADO**.

### Entrada y salida de vehículos

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-01 | Entrada por placa con fecha/hora, usuario, acceso y celda automática según tipo (camionetas usan celdas de carro) | IMPLEMENTADO | `movimientos.service.js` `registrarEntrada`; `validators/placas.js` `tipoCeldaParaVehiculo` | `POST /api/movimientos/entrada` | App.jsx sección «Ingreso» | `vehiculos.tipos.test.js` (7) |
| RF-02 | Entrada solo con vehículo registrado + mensualidad vigente + sin entrada activa + celda disponible | IMPLEMENTADO | `movimientos.service.js` `registrarEntrada` | `POST /api/movimientos/entrada` | App.jsx sección «Ingreso» | Inspección + manual |
| RF-03 | Consultar registros de entrada de un vehículo por placa | IMPLEMENTADO | `movimientos.routes.js` `GET /vehiculo/:placa` | `GET /api/movimientos/vehiculo/:placa` | Historial con filtro de placa | Inspección |
| RF-04 | Registrar salida con fecha/hora, usuario y acceso; asociada a la entrada activa | IMPLEMENTADO | `movimientos.service.js` `registrarSalida` | `POST /api/movimientos/salida` | App.jsx sección «Salida» | Inspección |
| RF-05 | Verificar entrada activa antes de registrar la salida | IMPLEMENTADO | `movimientos.service.js` `registrarSalida` | `POST /api/movimientos/salida` | App.jsx sección «Salida» | Inspección |
| RF-06 | Estado de celdas (disponible/ocupada/bloqueada), resumen por tipo y reutilización | IMPLEMENTADO | `celdas.service.js` `listarCeldas/resumenCeldas` | `GET /api/celdas`, `/resumen`, `/disponibles` | Celdas.jsx; dashboard | Inspección |
| RF-07 | Consultar movimientos por estado, búsqueda por placa y orden descendente | IMPLEMENTADO | `movimientos.service.js` `listarMovimientos` | `GET /api/movimientos?estado=&placa=` | App.jsx «Historial» | `movimientos.filtros.test.js` (7) |

### Seguridad y control de acceso

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-08 | Autenticar usuarios activos con documento y contraseña | IMPLEMENTADO | `auth.service.js` `iniciarSesion` | `POST /api/auth/login` | Login en App.jsx | `auth.test.js` |
| RF-09 | Cerrar sesión manual y automática por inactividad (90 min) | IMPLEMENTADO | `auth.service.js` `cerrarSesion/autenticarToken` | `POST /api/auth/logout` | Botón «Cerrar sesión» | Inspección |
| RF-10 | Cambiar contraseña y exigirlo en el primer ingreso (temporal) | IMPLEMENTADO | `auth.service.js` `cambiarPassword`; `middleware/auth.middleware.js` (bloqueo por temporal) | `POST /api/auth/cambiar-password` | `Cuenta.jsx` (modo forzado) | `password.politica.test.js` (6) |
| RF-11 | Bloquear la cuenta tras varios intentos fallidos | IMPLEMENTADO | `auth.service.js` `iniciarSesion` (`MAX_INTENTOS=5`) | `POST /api/auth/login` | Login | Inspección |
| RF-12 | Recuperar contraseña por enlace de correo; uso único; desbloquea; no aplica a suspendidos/desvinculados | IMPLEMENTADO (limitación externa) | `auth.service.js` `solicitarRecuperacion/restablecerPassword`; `correo.service.js` | `POST /api/auth/recuperacion`, `/recuperacion/restablecer` | `Recuperacion.jsx` | Lógica verificada; **envío real no probado (sin proveedor SMTP/API)** |
| RF-13 | Desbloquear cuenta y asignar contraseña temporal | IMPLEMENTADO | `operadores.service.js` `desbloquearCuenta`; `auth.service.js` `asignarPasswordTemporal` | `POST /api/operadores/:id/desbloquear` | `Operadores.jsx` | Inspección |
| RF-14 | Permitir cada operación solo a los perfiles autorizados | IMPLEMENTADO | `auth.middleware.js` `requiereRol/requiereAdministrador` | Todas las rutas `/api/*` | `menuVisible` por rol | `auth.test.js` |
| RF-15 | El administrador ejecuta funciones del operador con registros a su nombre | IMPLEMENTADO | Rutas de movimientos usan `req.user.id` | `POST /api/movimientos/*` | Admin ve las secciones | Inspección |

### Gestión de usuarios del sistema

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-16 | Registrar operador con nombres, apellidos, documento, correo, teléfono, rol, estado y contraseña temporal | IMPLEMENTADO | `operadores.service.js` `crearOperador`; migración 005 (`apellidos`, `email`, `password_temporal`) | `POST /api/operadores` | `Operadores.jsx` | Inspección |
| RF-17 | Buscar operadores por documento o nombre y ver su estado | IMPLEMENTADO | `operadores.service.js` `listarOperadores` (filtros SQL) | `GET /api/operadores?documento=&nombre=&estado=` | `Operadores.jsx` | Inspección |
| RF-18 | Modificar los datos de un operador | IMPLEMENTADO | `operadores.service.js` `actualizarOperador` | `PUT /api/operadores/:id` | `Operadores.jsx` | Inspección |
| RF-19 | Suspender operador con motivo; no si tiene sesión activa | IMPLEMENTADO | `operadores.service.js` `cambiarEstadoOperador` | `PATCH /api/operadores/:id/estado` | `Operadores.jsx` | Inspección |
| RF-20 | Desvincular operador con baja lógica y motivo; no si tiene sesión activa | IMPLEMENTADO | `operadores.service.js` `cambiarEstadoOperador` | `PATCH /api/operadores/:id/estado` | `Operadores.jsx` | Inspección |
| RF-21 | Reactivar operador con motivo y contraseña temporal | IMPLEMENTADO | `operadores.service.js` `cambiarEstadoOperador` | `PATCH /api/operadores/:id/estado` | `Operadores.jsx` | Inspección |

### Gestión de clientes, vehículos y mensualidades

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-22 | Buscar cliente por documento con datos, vehículos y **estado de mensualidad**; habilitar registro si no existe | IMPLEMENTADO | `clientes.service.js` `obtenerClientePorDocumento/incluirMensualidades` | `GET /api/clientes/consulta/:documento` | `Clientes.jsx` (panel de consulta) | Inspección |
| RF-23 | Registrar en una sola transacción cliente + ≥1 vehículo + autorización de datos + auditoría | IMPLEMENTADO | `clientes.service.js` `registrarClienteConVehiculos`; `vehiculos.service.js` `insertarVehiculo` | `POST /api/clientes/registro` | `Clientes.jsx` (alta con vehículos y autorización) | Inspección + `integracion/ciclo.operativo.test.js` (atomicidad) |
| RF-24 | Agregar vehículo a cliente existente; rechazar placa de otro cliente informando del cambio de titular | IMPLEMENTADO | `vehiculos.service.js` `insertarVehiculo` | `POST /api/vehiculos` | `Vehiculos.jsx` | Inspección |
| RF-25 | Modificar cliente conservando valores anteriores y auditoría; restringido por perfil | IMPLEMENTADO | `clientes.service.js` `actualizarCliente` | `PUT /api/clientes/:id` | `Clientes.jsx` | Inspección |
| RF-26 | Modificar vehículo; placa válida y única; no cambiar tipo con movimiento activo | IMPLEMENTADO | `vehiculos.service.js` `actualizarVehiculo` | `PUT /api/vehiculos/:id` | `Vehiculos.jsx` | `vehiculos.tipos.test.js` |
| RF-27 | Cambio de titular conservando historial, con fecha, operador y motivo | IMPLEMENTADO | `vehiculos.service.js` `cambiarTitular/historialTitulares`; migración 005 (`historial_titulares_vehiculo`) | `POST /api/vehiculos/:id/cambiar-titular`, `GET /api/vehiculos/:id/titulares` | `Vehiculos.jsx` | Inspección |
| RF-28 | Mensualidad con 30 días calendario, activación/vencimiento automáticos, sin cobro, sin traslapes; estados EA2 | IMPLEMENTADO | `suscripciones.service.js` `crearSuscripcion/sincronizarEstadosSuscripciones`; migración 006 | `POST /api/suscripciones` | `Suscripciones.jsx` | `suscripciones.validation.test.js` (6) + `integracion/ciclo.operativo.test.js` |
| RF-29 | Modificar la fecha de activación de la mensualidad con recálculo del vencimiento | IMPLEMENTADO | `suscripciones.service.js` `modificarFechaActivacion` | `PATCH /api/suscripciones/:id/fecha-activacion` | `Suscripciones.jsx` (panel de fecha) | Inspección |

### Gestión de celdas

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-30 | Crear celdas con código único, tipo y ubicación | IMPLEMENTADO | `celdas.service.js` `crearCelda` | `POST /api/celdas` | `Celdas.jsx` | Inspección |
| RF-31 | Modificar celda disponible; los movimientos conservan código y tipo usados (snapshot) | IMPLEMENTADO | `celdas.service.js` `modificarCelda`; `movimientos.service.js` (snapshot en la entrada) | `PUT /api/celdas/:id` | `Celdas.jsx` | Inspección + `integracion/ciclo.operativo.test.js` |
| RF-32 | Bloquear celda disponible con motivo; si está ocupada, rechazar informando placa/cliente/usuario | IMPLEMENTADO | `celdas.service.js` `cambiarBloqueoCelda` | `POST /api/celdas/:id/bloquear` | `Celdas.jsx` | Inspección |
| RF-33 | Desbloquear celda bloqueada dejándola disponible | IMPLEMENTADO | `celdas.service.js` `cambiarBloqueoCelda` | `POST /api/celdas/:id/desbloquear` | `Celdas.jsx` | Inspección |
| RF-34 | Historial de celda: movimientos, bloqueos, desbloqueos y modificaciones | IMPLEMENTADO | `celdas.service.js` `historialCelda` (une `historial_celdas` + movimientos) | `GET /api/celdas/:id/historial` | `Celdas.jsx` (modal) | Inspección |

### Corrección de movimientos y auditoría

| ID | Requisito | Estado | Archivo / función | Endpoint | Frontend | Prueba |
|---|---|---|---|---|---|---|
| RF-35 | Anular movimiento con motivo; libera la celda si estaba abierta | IMPLEMENTADO | `movimientos.admin.service.js` `anularMovimiento` | `POST /api/movimientos-admin/:id/anular` | `MovimientosAdmin.jsx` | Inspección |
| RF-36 | Corregir observaciones, accesos y celda (solo activos) con motivo; no fecha/hora/usuario/vehículo | IMPLEMENTADO | `movimientos.admin.service.js` `modificarMovimiento` | `PATCH /api/movimientos-admin/:id/corregir` | `MovimientosAdmin.jsx` | Inspección |
| RF-37 | Registrar cada operación e inicios de sesión con usuario/fecha/acción y valores anterior y nuevo | IMPLEMENTADO | `auditoria.service.js` `registrarAuditoria`; `operadores/clientes/vehiculos/celdas/movimientos.admin` | (interno) | `Auditoria.jsx` | Inspección |
| RF-38 | Consultar auditoría por usuario, fechas, tipo de acción y entidad; valores anterior/nuevo | IMPLEMENTADO | `auditoria.service.js` `consultarAuditoria` (unifica `auditoria_eventos` + `auditoria_autenticacion`) | `GET /api/auditoria?usuario=&desde=&hasta=&accion=&entidad=&tipo=` | `Auditoria.jsx` (todos los filtros) | Inspección |

**Cambio destacado de RF-27:** en la línea base el código **bloqueaba** el cambio de titular cuando existía historial; ahora se **permite** mediante el procedimiento administrativo, conservando los movimientos y registrando el vínculo con el titular anterior en `historial_titulares_vehiculo`.

---

## C. Matriz de Requerimientos No Funcionales (RNF-01 a RNF-13)

| ID | Criterio | Estado | Evidencia |
|---|---|---|---|
| RNF-01 | Usabilidad: formularios y mensajes comprensibles | IMPLEMENTADO | Mensajes de error/éxito en `App.jsx`, `Clientes.jsx`, `Vehiculos.jsx`, `Celdas.jsx`, `Operadores.jsx`, `Cuenta.jsx`, `Recuperacion.jsx` |
| RNF-02 | Integridad entrada/salida (no salida sin entrada) | IMPLEMENTADO | `registrarSalida` valida la entrada abierta |
| RNF-03 | Rendimiento: consultas ≤ 3 s | IMPLEMENTADO (medido con benchmark) | Historial `GET /api/movimientos?limite=200` con 400 clientes, 400 vehículos, 4.000 movimientos y 80 celdas: **p95 87,02 ms** (concurrencia 1) y **249,36 ms** (concurrencia 10); plan real 84,9 ms. Arnés `frontend/e2e/rendimiento/rnf03.spec.js` (`npm run rendimiento:rnf03`). Ver sección F |
| RNF-04 | Seguridad de credenciales: hash scrypt; política mínima | IMPLEMENTADO | `generarHashPassword`/`verificarPassword` (scrypt, nunca texto plano); `validators/password.js` `validarPoliticaPassword` (mínimo 10, letras y números, sin espacios). Probado en `password.politica.test.js` |
| RNF-05 | Sesión: expira a los 90 min; bloqueo a los 5 intentos | IMPLEMENTADO | `SESION_MINUTOS=90`, `MAX_INTENTOS=5` en `auth.service.js` |
| RNF-06 | Autorización: 401 sin sesión, 403 sin permiso | IMPLEMENTADO | `requiereAutenticacion` (401), `requiereRol` (403); probado en `auth.test.js` |
| RNF-07 | Trazabilidad con usuario/fecha/hora del servidor | IMPLEMENTADO | `registrarAuditoria` en operadores, clientes, vehículos, celdas y movimientos; `fecha_hora DEFAULT CURRENT_TIMESTAMP` |
| RNF-08 | No eliminación física: bajas lógicas con motivo | IMPLEMENTADO | Anular movimiento ✔, bloquear celda ✔, suspender/desvincular operador **con motivo** ✔, desactivar cliente/vehículo ✔ |
| RNF-09 | Unicidad: documento, placa, código; un movimiento activo por vehículo/celda; ≥1 admin activo | IMPLEMENTADO | `uq_operadores_documento`, `uq_operadores_email`, `placa UNIQUE`, `codigo UNIQUE`, índices de movimiento activo; guardas de último administrador |
| RNF-10 | Atomicidad: operaciones compuestas todo-o-nada | IMPLEMENTADO | Transacciones en entrada, salida, suscripción, **registro transaccional cliente+vehículo (RF-23)** y cambio de titular |
| RNF-11 | Usabilidad por perfil: el operador no accede a administración; rechazos claros | IMPLEMENTADO | `menuVisible` filtra por rol: las secciones exclusivas del administrador no se muestran al operador; la **consulta de clientes** (parte de la operación) sí se muestra y sus acciones de **modificar/inactivar aparecen deshabilitadas** con leyenda; el backend responde `403` (`requiereAdministrador`) |
| RNF-12 | Protección de datos (Ley 1581): autorización con fecha y acceso autenticado | IMPLEMENTADO | `clientes.autorizacion_datos` + `autorizacion_fecha` capturadas en `registrarClienteConVehiculos` (RF-23), con aceptación expresa |
| RNF-13 | Mantenibilidad: capa de servicios; API con códigos HTTP estándar | IMPLEMENTADO | `services/` + `routes/` por módulo; códigos 400/401/403/404/409 |

---

## D. Archivos modificados

### Backend — nuevos

| Archivo | Propósito |
|---|---|
| `backend/sql/migrations/003_gestion_celdas_auditoria.sql` | Clientes, historial de celdas, auditoría (estructura canónica) |
| `backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql` | Anulación y snapshots de celda en movimientos |
| `backend/sql/migrations/005_cierre_iteracion2_seguridad.sql` | Cierre de seguridad (ver sección E) |
| `backend/sql/migrations/006_estados_suscripcion_ea2.sql` | Alineación de la nomenclatura de estados de suscripción con EA2 (RF-28) |
| `backend/sql/migrations/007_tipo_vehiculo_camioneta.sql` | Tipo de vehículo `CAMIONETA` (RF-01) |
| `backend/sql/migrations/008_datos_obligatorios_clientes.sql` | Campos explícitos de nombres/apellidos y datos obligatorios de cliente |
| `backend/sql/migrations/009_historicos_append_only.sql` | Triggers append-only sobre tablas de auditoría e históricos |
| `backend/sql/migrations/010_integridad_campos_ea2.sql` | Preflight, `NOT NULL`, CHECK y restricción `chk_suscripcion_30_dias` |
| `backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql` | Normalización de mensualidades a 30 días (respaldo, auditoría y casos sin conciliar) |
| `backend/scripts/crear-usuarios-bd.js` | Aprovisiona la cuenta de ejecución (mínimo privilegio) y la administrativa |
| `backend/src/validators/gestion.js` | Validación de campos obligatorios y consentimiento explícito |
| `backend/src/routes/auditoria.routes.js` | Consulta unificada de auditoría |
| `backend/src/routes/movimientos.admin.routes.js` | Anular / corregir movimientos |
| `backend/src/services/auditoria.service.js` | Registro y consulta unificada de auditoría |
| `backend/src/services/celdas.service.js` | Gestión e historial de celdas |
| `backend/src/services/correo.service.js` | Abstracción de proveedor de correo |
| `backend/src/services/movimientos.admin.service.js` | Anulación y corrección |
| `backend/src/validators/password.js` | Política de contraseñas y generación de temporal |

### Backend — modificados

`backend/src/app.js`, `config/database.js`, `middleware/auth.middleware.js`, `routes/{auth,celdas,clientes,dashboard,movimientos,operadores,suscripciones,vehiculos}.routes.js`, `services/{auth,clientes,movimientos,operadores,suscripciones,vehiculos}.service.js`, `validators/placas.js`, `sql/schema.sql`, `sql/migrations/002_autenticacion_operadores.sql`.

### Frontend — nuevos

`frontend/src/components/Auditoria.jsx` (+ `Auditoria.css`), `Celdas.jsx` (+ `Celdas.css`), `Cuenta.jsx`, `MovimientosAdmin.jsx`, `Operadores.jsx`, `Recuperacion.jsx`, `Suscripciones.jsx`, `Vehiculos.jsx`.

### Frontend — modificados

`frontend/src/App.jsx`, `frontend/src/App.css`, `frontend/src/components/Clientes.jsx`, `frontend/index.html`.

### Pruebas — nuevos

`backend/test/movimientos.filtros.test.js`, `backend/test/password.politica.test.js`, `backend/test/suscripciones.validation.test.js`, `backend/test/vehiculos.tipos.test.js`, `backend/test/gestion.validation.test.js`, `backend/test/integracion/ciclo.operativo.test.js` (integración contra MySQL en base independiente) y el arnés E2E `frontend/e2e/` (Playwright: 33 pruebas M-01…M-18 y el benchmark RNF-03).

### Documentación

`README.md`, `Documentacion/00_Inventario_Soportes.md`, `01_Funcionalidades_Implementadas.md`, `02_Matriz_Requisitos.md`, `03_Historias_Usuario.md`, `04_Diagramas.md`, `05_Modelo_Entidad_Relacion.md`, `06_Diccionario_Datos.md`, `07_Orden_Migraciones.md`, `09_Matriz_Pruebas.md`, `10_Auditoria_Cumplimiento_EA2.md`, `12_Reporte_Conciliacion_Mensualidades.md`, `13_Evidencias_Pruebas_Manuales.md`, `14_Acta_Cierre_Iteracion2.md`, `15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md`, `16_Informe_Final_Correcciones_EA2.md`, `17_Informe_Cierre_Final_EA2.md` y este `11_Informe_Final_Iteracion2.md`.

---

## E. Migraciones

**Orden de instalación limpia (7 pasos):**

| Paso | Archivo | Contenido | Idempotente |
|---|---|---|---|
| 1 | `backend/sql/schema.sql` | Tablas base + datos iniciales de celdas | No (una sola vez) |
| 2 | `backend/sql/migrations/002_autenticacion_operadores.sql` | Autenticación de operadores, `sesiones_operadores`, `auditoria_autenticacion` | No (una sola vez) |
| 3 | `backend/sql/migrations/003_gestion_celdas_auditoria.sql` | `clientes`, `historial_celdas`, `auditoria_eventos` (canónica) | Sí (guardas `information_schema`) |
| 4 | `backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql` | Columnas de anulación y snapshots en `movimientos` | Sí |
| 5 | `backend/sql/migrations/005_cierre_iteracion2_seguridad.sql` | Cierre de seguridad (detalle abajo) | Sí |
| 6 | `backend/sql/migrations/006_estados_suscripcion_ea2.sql` | Nomenclatura EA2 de estados de suscripción (`PROGRAMADA/VIGENTE/VENCIDA/CANCELADA`) | Sí |
| 7 | `backend/sql/migrations/007_tipo_vehiculo_camioneta.sql` | Tipo `CAMIONETA` en `vehiculos.tipo` | Sí |

**Contenido de la migración 005 (aditiva e idempotente):**

- `operadores`: `apellidos` VARCHAR(100), `email` VARCHAR(150) + índice `uq_operadores_email`, `password_temporal` BOOLEAN, `actualizado_en` DATETIME.
- `recuperacion_password`: nueva tabla (`token_hash` CHAR(64) — solo hash, `expira_en`, `usado_en`) con FK a `operadores`.
- `historial_titulares_vehiculo`: nueva tabla (vehículo, titular anterior, titular nuevo, operador, motivo, fecha) con FK.
- `suscripciones`: `motivo_cancelacion` VARCHAR(500), `actualizado_en` DATETIME.
- `auditoria_autenticacion.accion`: ENUM ampliado (`CAMBIO_PASSWORD`, `PASSWORD_TEMPORAL_ASIGNADA`, `RECUPERACION_SOLICITADA`, `PASSWORD_RESTABLECIDA`, `DESBLOQUEO_CUENTA`) conservando los valores previos.

**Contenido de la migración 006 (aditiva e idempotente):** amplía el ENUM `suscripciones.estado` y traduce `PENDIENTE → PROGRAMADA` y `ACTIVA → VIGENTE`; fija la definición definitiva `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA`. No elimina filas ni índices.

**Contenido de la migración 007 (aditiva e idempotente):** amplía el ENUM `vehiculos.tipo` a `('CARRO','MOTO','CAMIONETA')` conservando los valores existentes.

**Garantías:** las migraciones 003–007 no contienen `DROP`, `DELETE` ni `TRUNCATE`; usan guardas `information_schema` + `PREPARE/EXECUTE`. Compatibles con bases ya migradas (columnas/índices/ENUM se ajustan solo si faltan). Respaldo previo disponible en `Respaldo/`.

---

## F. Pruebas (resultados reales)

| Verificación | Comando | Resultado |
|---|---|---|
| Pruebas backend | `npm test` (backend) | **tests 52 · pass 52 · fail 0 · skipped 0** |
| Compilación frontend | `npm run build` (frontend) | **29 módulos; build completado** |
| Análisis estático | `npm run lint` (frontend) | **0 errores · 14 advertencias** |
| Sintaxis backend | `node --check` sobre `src`, `scripts`, `test` | Sin errores |
| Arranque backend | `node src/app.js` | «AutosColombia API disponible en http://localhost:3001» |
| Disponibilidad | `GET /api/health` | **HTTP 200** · `{"ok":true,"mensaje":"API y MySQL conectados."}` (solo acredita disponibilidad) |
| Rendimiento RNF-03 | `npm run rendimiento:rnf03` (frontend) | **1/1** · p95 **87,02 ms** (C1) y **249,36 ms** (C10); plan real 84,9 ms |

**Desglose de las 52 pruebas — unitarias/de validación (35):** `auth.test.js` (4), `movimientos.filtros.test.js` (7), `suscripciones.validation.test.js` (6), `password.politica.test.js` (6), `vehiculos.tipos.test.js` (7), `gestion.validation.test.js` (5).

**Desglose — integración contra MySQL (17):** `backend/test/integracion/ciclo.operativo.test.js`. Cada ejecución crea la base `autoscolombia_test_<pid>`, aplica los **11 scripts** del orden de instalación limpia, ejecuta operaciones críticas (esquema, entrada, salida, anulación, suscripción, camioneta→celda CARRO, restricción de placa duplicada, atomicidad cliente+vehículo, inmutabilidad de históricos y consentimiento) y **elimina la base** al terminar. No toca la base `autoscolombia`. Si MySQL o el cliente `mysql` no están disponibles, las pruebas se **omiten** (no fallan).

**Regresión:** los tests unitarios previos continúan aprobados. No se modificó ninguna prueba existente ni el contrato de respuesta de los consumidores (formato `{ ok, total, data }` y `{ ok, mensaje, data }`).

**Pruebas manuales:** **M-01 a M-18 reejecutadas con el arnés Playwright versionado** (`npm run test:e2e`): **33/33 aprobadas**, **43 capturas únicas** en `Documentacion/Evidencias/Iteracion_2/`, contra una base efímera (`autoscolombia_e2e_<pid>`) sin tocar la base real. El detalle está en `13_Evidencias_Pruebas_Manuales.md`. **M-18 (RF-12)** se marca «Aprobado con observación»: el flujo local se ejecutó completo con el enlace del modo consola; el envío real de correo no se declara probado por depender del proveedor externo no configurado.

---

## G. Dependencias externas

| Dependencia | Estado | Acción requerida para habilitar |
|---|---|---|
| Proveedor de correo (RF-12) | **No configurado** | Definir `MAIL_PROVIDER=http` y las credenciales (`MAIL_*`) en `backend/.env`. La implementación usa una abstracción (`correo.service.js`); con `MAIL_PROVIDER=consola` genera el enlace pero **no simula el envío real** |

No se inventaron credenciales ni se simuló el envío. El flujo completo (solicitud → token → restablecimiento → auditoría) está implementado y es verificable con el enlace generado.

---

## H. Pendientes

| # | Pendiente | Motivo por el que no se resolvió |
|---|---|---|
| 1 | **RF-12:** envío real del correo de recuperación | Requiere credenciales de un proveedor SMTP/API externo no disponibles en el entorno. El flujo está implementado y probado con el enlace del modo consola; **no se simula el envío** (ver sección G) |

> **Resuelto en el cierre:** las **pruebas manuales M-01 a M-18** ya fueron **ejecutadas y aprobadas** con evidencia (ver `13_Evidencias_Pruebas_Manuales.md`); RF-28 (nomenclatura de estados → migración `006`); RNF-11 (acciones deshabilitadas por perfil); y las pruebas de integración contra MySQL (suite `integracion/ciclo.operativo.test.js` con base independiente). El único pendiente real es la habilitación del proveedor de correo.

---

## I. Instrucciones de ejecución

**Base de datos (instalación limpia):**

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS autoscolombia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p autoscolombia < backend/sql/schema.sql
mysql -u root -p autoscolombia < backend/sql/migrations/002_autenticacion_operadores.sql
mysql -u root -p autoscolombia < backend/sql/migrations/003_gestion_celdas_auditoria.sql
mysql -u root -p autoscolombia < backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql
mysql -u root -p autoscolombia < backend/sql/migrations/005_cierre_iteracion2_seguridad.sql
mysql -u root -p autoscolombia < backend/sql/migrations/006_estados_suscripcion_ea2.sql
mysql -u root -p autoscolombia < backend/sql/migrations/007_tipo_vehiculo_camioneta.sql
```

**Backend:**

```bash
cd backend
npm ci
# configurar .env (PORT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
#                    MAIL_PROVIDER, MAIL_FROM, MAIL_API_URL, MAIL_API_KEY, APP_BASE_URL)
npm run dev
```

**Frontend:**

```bash
cd frontend
npm ci
npm run dev
```

**Pruebas:**

```bash
cd backend && npm test
cd frontend && npm run build && npm run lint
```

---

## J. Guion de demostración

1. **Login y seguridad:** ingresar con documento/contraseña; provocar 5 fallos para ver el bloqueo (RF-08, RF-11).
2. **Contraseña temporal (RF-10):** el administrador crea un operador sin contraseña → se muestra la contraseña temporal una vez → al ingresar, el sistema **exige** el cambio antes de habilitar el menú.
3. **Recuperación (RF-12):** solicitar recuperación con un documento existente y con uno inexistente → respuesta equivalente; mostrar el enlace generado (envío real pendiente de proveedor).
4. **Operadores (RF-16 a RF-21):** crear con apellidos y correo; editar; suspender/desvincular con **motivo**; intentar suspender con sesión activa (rechazo); reactivar (nueva temporal); filtrar por documento/nombre/estado; desbloquear cuenta.
5. **Cliente + vehículo transaccional (RF-22, RF-23):** consultar por documento; registrar cliente con vehículo y autorización marcada; verificar que sin autorización o sin vehículo no se crea nada.
6. **Vehículos y titular (RF-24, RF-26, RF-27):** rechazo por placa de otro cliente (mensaje de cambio de titular); bloqueo del cambio de tipo con movimiento activo; cambio de titular conservando el historial.
7. **Entrada/salida (RF-01, RF-02, RF-04):** registrar entrada (celda automática, camioneta → celda de carro); registrar salida; verificar rechazo de placa no registrada (sin autocreación).
8. **Mensualidades (RF-28, RF-29):** crear período de 30 días; modificar la fecha de activación y ver el nuevo vencimiento; rechazar traslapes.
9. **Celdas (RF-30 a RF-34):** crear, modificar, bloquear (motivo), desbloquear; abrir el historial y ver entradas/salidas/bloqueos.
10. **Movimientos (RF-35, RF-36):** anular con motivo (se libera la celda); corregir observaciones/accesos/celda de un movimiento activo.
11. **Auditoría (RF-37, RF-38):** abrir la auditoría y filtrar por usuario, fecha, acción, entidad y tipo (operación/autenticación); ver valores anterior y nuevo.
12. **Historial HU-07 (RF-07):** filtrar por estado (Activos/Finalizados/Anulados/Todos) y buscar por placa, con orden descendente.

---

## K. Estado Git y preparación para publicación

- **Rama actual:** `Iteracion_2` (confirmada; no se cambió de rama).
- **Commits/push/merge:** **ninguno** durante esta ejecución (restricción respetada; no se ejecutó `git add`/`git commit`/`git push`).
- **Último commit existente:** `1ffb4f2` — «Implementa autenticacion y gestion de operadores - Iteracion 2».
- **Archivos modificados** (rastreados, sin confirmar): `.gitignore`, `README.md`, `backend/.env.example`, `backend/sql/schema.sql`, `backend/sql/migrations/002_autenticacion_operadores.sql`, `backend/src/app.js`, `backend/src/config/database.js`, `backend/src/middleware/auth.middleware.js`, 8 rutas, 6 servicios, `backend/src/validators/placas.js`, `frontend/index.html`, `frontend/src/App.css`, `frontend/src/App.jsx`, `frontend/src/components/Clientes.jsx`.
- **Archivos nuevos** (no rastreados, 39 entradas): carpeta `Documentacion/` (incluye `Evidencias/Iteracion_2/` con 43 capturas), `backend/scripts/crear-usuarios-bd.js`, migraciones `003`–`011`, rutas `auditoria`/`movimientos.admin`, servicios `auditoria`/`celdas`/`correo`/`movimientos.admin`, validadores `gestion`/`password`, pruebas `test/*.test.js` + `test/integracion/`, el arnés `frontend/e2e/` con `playwright.config.js` y `playwright.rendimiento.config.js`, y componentes nuevos (`Auditoria`, `Celdas`, `Cuenta`, `Modal`, `MovimientosAdmin`, `Operadores`, `Recuperacion`, `Suscripciones`, `Vehiculos`).
- **Archivo eliminado en el árbol de trabajo:** `IMPLEMENTACION_AUTENTICACION_ITERACION_2.md` (nota «Entrega 1», superada por `Documentacion/`). **Se deja como está** (no se revierte): el responsable decide si mantener la baja en el commit de publicación.
- **Higiene de secretos:** solo `backend/.env.example` está rastreado; el `backend/.env` real **no está rastreado** (cubierto por `.gitignore`). No hay `node_modules/`, `dist/`, credenciales ni tokens en los archivos a publicar. Carpetas internas `Implementaciones/` y `Respaldo/` **excluidas** por `.gitignore`.
- **Sin operaciones destructivas sobre la base real:** no se ejecutaron `DROP`, `TRUNCATE` ni `DELETE` masivos; los datos existentes se conservaron. Los únicos `DROP DATABASE` fueron sobre bases **temporales de prueba** creadas para la verificación.

**Instrucciones exactas para publicar (a ejecutar por el responsable, con autorización):**

```bash
git checkout Iteracion_2
git status                    # revisar modificados (M) y nuevos (??)
git add <archivos concretos>  # añadir por nombre; NO usar `git add -A`
git commit -m "Cierre Iteración 2: RF-01..RF-38, pruebas y evidencias"
git push -u origin Iteracion_2
```

---

## Conclusión

La Iteración 2 queda **funcionalmente cerrada**: 37 de 38 RF implementados y verificados por lógica y controles; el único RF con limitación es **RF-12** (envío real de correo), que depende de un proveedor SMTP/API externo no disponible en el entorno y está identificado sin ambigüedad. Los 13 RNF cuentan con evidencia (incluida la medición de rendimiento: p95 87,02 ms en C1 y 249,36 ms en C10). Las pruebas automatizadas pasan **52/52** (35 unitarias + 17 de integración real contra MySQL en base independiente), el frontend compila (29 módulos) y el lint no reporta errores.

Queda como único pendiente real la **habilitación del proveedor de correo** (RF-12): la lógica interna está completa y probada, y el envío real solo requiere configurar credenciales SMTP/API. Las **pruebas manuales M-01 a M-18 fueron reejecutadas con el arnés Playwright y aprobadas (33/33, 43 capturas)**. Ninguna de estas limitaciones impide la demostración del flujo completo desde la interfaz.
