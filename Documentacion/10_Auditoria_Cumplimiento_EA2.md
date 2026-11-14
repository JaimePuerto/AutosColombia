# Auditoría de Cumplimiento — Documento EA2 vs. Código Real

**Proyecto:** AutosColombia — Sistema de gestión de parqueadero
**Fuente oficial de requisitos:** `Grupo03_Iteracion_2_EA2` (Evidencia de Aprendizaje 2, Iteración 2)
**Fecha de la auditoría:** 2026-11-13
**Alcance:** correspondencia entre los 38 requerimientos funcionales (RF-01 a RF-38), los 13 no funcionales (RNF-01 a RNF-13) y el código del repositorio.
**Restricciones respetadas:** no se modificó código, SQL ni datos; no se crearon funcionalidades; no se hicieron commits ni push; no se eliminaron ni renombraron archivos.

> **Método:** cada requerimiento se verificó leyendo el servicio, la ruta, el componente de frontend y las pruebas. No se marca un RF como IMPLEMENTADO por la mera existencia de una ruta o un componente: se comprobó la lógica y sus controles.

---

## 0. Actualización posterior al cierre (2026-11-13)

> **Vigencia:** este documento y sus tablas de cierre conservan registros históricos. El dictamen de cierre vigente está en [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md), que consolida la última ejecución de 52/52 pruebas, el arnés E2E M-01…M-18 (33/33 sobre base efímera), el benchmark RNF-03 y la conciliación de mensualidades. El informe intermedio [`16_Informe_Final_Correcciones_EA2.md`](16_Informe_Final_Correcciones_EA2.md) se conserva como antecedente. Las secciones A–G documentan la línea base y no deben leerse como estado actual.

**Resultado por estado (RF):**

| Estado | Línea base | Cierre |
|---|---|---|
| IMPLEMENTADO | 18 | **37** |
| PARCIAL / LIMITACIÓN EXTERNA | 13 | **1** |
| NO IMPLEMENTADO | 7 | **0** |

**Resultado por estado (RNF):**

| Estado | Línea base | Cierre |
|---|---|---|
| IMPLEMENTADO / CON EVIDENCIA | 6 | **13** |
| PARCIAL / LIMITACIÓN IDENTIFICADA | 6 | **0** |
| NO IMPLEMENTADO / NO VERIFICABLE | 1 | **0** |

> El único RF que permanece como «limitación externa» es **RF-12** (envío real del correo), por ausencia de un proveedor SMTP/API. RNF-03 (rendimiento) queda verificado con el benchmark del historial: p95 87,02 ms en concurrencia 1 y 249,36 ms en concurrencia 10, muy por debajo del límite de 3.000 ms.

**Resolución de los incumplimientos de la línea base:**

| Ítem (línea base) | Estado al cierre | Cómo se resolvió |
|---|---|---|
| RF-10 · cambio de contraseña | Resuelto | `auth.service.js`·`cambiarPassword` + bandera `password_temporal` + middleware `403 CAMBIO_PASSWORD_REQUERIDO` |
| RF-12 · recuperación por correo | Implementado con limitación externa | Flujo end-to-end con token de un solo uso; proveedor de correo abstraído (`correo.service.js`). Sin proveedor SMTP/API real no se simula el envío |
| RF-18 · modificación de operador | Resuelto | `operadores.service.js`·`actualizarOperador` con unicidad y auditoría |
| RF-23 · registro transaccional cliente+vehículo | Resuelto | `clientes.service.js`·`registrarClienteConVehiculos` (transacción) + autorización de datos |
| RF-27 · cambio de titular | Resuelto | `vehiculos.service.js`·`cambiarTitular` + `historial_titulares_vehiculo` |
| RF-29 · modificación de la fecha de activación | Resuelto | `suscripciones.service.js`·`modificarFechaActivacion` |
| RF-01 · tipo CAMIONETA | Resuelto | Migración `007` + `validators/placas.js` + mapeo a celdas CARRO |
| RF-13/16/21 · contraseña temporal y `apellidos`/`email` | Resuelto | Migración `005` + `operadores.service.js` |
| RF-19/20/21 · motivo y auditoría | Resuelto | `cambiarEstadoOperador` con motivo obligatorio y auditoría |
| RF-22 · consulta de cliente con mensualidad | Resuelto | `clientes.service.js`·`obtenerClientePorDocumento` incluye mensualidades |
| RF-25/26 · auditoría y control de tipo | Resuelto | Auditoría anterior/nuevo; bloqueo de cambio de tipo con movimiento activo |
| RF-31 · snapshot de celda | Resuelto | `registrarEntrada` guarda `codigo_celda_snapshot`/`tipo_celda_snapshot` |
| RF-34 · historial de celda con movimientos | Resuelto | `celdas.service.js`·`historialCelda` une historial + movimientos |
| RF-35/36 · UI de anulación/corrección | Resuelto | `frontend/src/components/MovimientosAdmin.jsx` |
| RF-37/38 · auditoría de todos los módulos + filtro por usuario | Resuelto | Auditoría en operadores/clientes/vehículos; UI con filtro de usuario y consulta unificada |
| RF-17 · búsqueda server-side de operadores | Resuelto | `listarOperadores` filtra en SQL |
| RNF-04 · política de contraseña | Resuelto (conciliado) | Política efectiva: mínimo 10 caracteres, con letras y números, sin espacios (`validators/password.js`) |
| RNF-10/12 · atomicidad y autorización de datos | Resuelto | Ligado a RF-23 |
| RNF-07/08 · trazabilidad y motivos | Resuelto | Módulos de usuarios/clientes/vehículos auditados con motivo |
| RNF-03 · rendimiento | Resuelto (medido) | Benchmark del historial con 400 clientes, 400 vehículos y 4.000 movimientos: p95 87,02 ms (C1) y 249,36 ms (C10) |
| RNF-11 · acciones por perfil | Resuelto | Menú filtrado por rol + acciones no permitidas **deshabilitadas** en la consulta de clientes + `403` en backend |
| RF-28 · nomenclatura de estados | Resuelto | Migración `006` alinea a `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` |

**Pruebas al cierre:** `npm test` → **52/52 aprobadas** (unitarias + integración real contra MySQL en base independiente); `npm run build` OK (29 módulos); `npm run lint` 0 errores y 14 advertencias. **Pruebas manuales: M-01 a M-18 reejecutadas con el arnés Playwright versionado → 33/33 aprobadas** (43 capturas únicas en `Documentacion/Evidencias/Iteracion_2/`; ver [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md)).

**Único punto con limitación externa:** **RF-12** (envío real de correo), por ausencia de un proveedor SMTP/API configurado. El resto queda implementado y verificado.

---

## Resumen ejecutivo

| Estado | Cantidad (RF) |
|---|---|
| IMPLEMENTADO | 18 |
| PARCIAL | 13 |
| NO IMPLEMENTADO | 7 |
| NO VERIFICABLE | 0 |
| **Total** | **38** |

**Bloques críticos NO implementados (impiden el cierre de la Iteración 2):**

1. **RF-10** Cambio de contraseña (con obligatoriedad en primer ingreso).
2. **RF-12** Recuperación de contraseña por correo.
3. **RF-18** Modificación de datos del operador.
4. **RF-23** Registro de cliente **con** vehículo en una sola transacción + autorización de tratamiento de datos.
5. **RF-27** Cambio de titular del vehículo (hoy el código lo **bloquea**, no lo permite).
6. **RF-29** Modificación de la fecha de activación de la mensualidad.
7. **RF-13 / RF-16 / RF-21**: contraseña temporal y campos `apellidos`/`email` del operador (soporte de los flujos de credenciales).

**Diferencias transversales:** política de contraseñas (documento 8 + letras/números vs. código 10 solo longitud), nomenclatura de estados de mensualidad, y auditoría incompleta fuera del módulo de movimientos/celdas.

---

## A. Matriz de Requerimientos Funcionales (RF-01 a RF-38)

Leyenda de estado: **IMPLEMENTADO** (cumple la lógica y controles), **PARCIAL** (existe parte o falta un control), **NO IMPLEMENTADO**.

### Entrada y salida de vehículos

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba que demuestra | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-01 | Registrar entrada por placa; guarda fecha/hora, usuario, acceso y celda asignada automáticamente según tipo (las camionetas usan celdas de carro). | **PARCIAL** | [movimientos.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/movimientos.service.js) `registrarEntrada` | `POST /api/movimientos/entrada` | [App.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/App.jsx) sección "entrada" | Manual (no hay test automatizado) | No existe el tipo `CAMIONETA`; `vehiculos.tipo` es ENUM('CARRO','MOTO') y `validarPlaca` solo admite carro/moto. No hay mapeo camioneta→celda carro | Desarrollo (tipo CAMIONETA mapeado a celdas CARRO) o ajustar el documento |
| RF-02 | Permitir entrada solo si: vehículo registrado + mensualidad vigente + sin entrada activa + celda disponible; si no, rechazar con motivo. | **IMPLEMENTADO** | `movimientos.service.js` `registrarEntrada` | `POST /api/movimientos/entrada` | App.jsx "entrada" | Manual | — | Ninguna |
| RF-03 | Consultar registros de entrada de un vehículo por placa. | **IMPLEMENTADO** | [movimientos.routes.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/routes/movimientos.routes.js) (consulta inline) | `GET /api/movimientos/vehiculo/:placa` | No hay pantalla dedicada; se cubre vía historial con filtro de placa | Manual | Devuelve el movimiento activo (`dentro`). No existe botón "consultar entrada" específico | Ajuste menor de UI o documentación |
| RF-04 | Registrar salida con fecha/hora, usuario y acceso; asociada a la entrada activa; no depende de la mensualidad. | **IMPLEMENTADO** | `movimientos.service.js` `registrarSalida` | `POST /api/movimientos/salida` | App.jsx "salida" | Manual | — | Ninguna |
| RF-05 | Verificar que exista entrada activa antes de registrar la salida. | **IMPLEMENTADO** | `movimientos.service.js` `registrarSalida` | `POST /api/movimientos/salida` | App.jsx "salida" | Manual | — | Ninguna |
| RF-06 | Estado de cada celda (disponible/ocupada/bloqueada), resumen por tipo y reutilización al finalizar. | **IMPLEMENTADO** | [celdas.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/celdas.service.js) `listarCeldas`, `resumenCeldas` | `GET /api/celdas`, `GET /api/celdas/resumen`, `GET /api/celdas/disponibles` | [Celdas.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/components/Celdas.jsx); resumen en App.jsx (dashboard) | Manual | — | Ninguna |
| RF-07 | Consultar movimientos filtrando por estado (activos/finalizados/anulados), buscar por placa, orden más reciente primero. | **IMPLEMENTADO** | `movimientos.service.js` `listarMovimientos`, `condicionEstadoMovimiento` | `GET /api/movimientos?estado=&placa=` | App.jsx "historial" (filtros en backend, debounce 300 ms) | [movimientos.filtros.test.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/test/movimientos.filtros.test.js) (7 pruebas) | — | Ninguna |

### Seguridad y control de acceso

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-08 | Autenticar usuarios activos con documento y contraseña. | **IMPLEMENTADO** | [auth.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/auth.service.js) `iniciarSesion` | `POST /api/auth/login` | Login en App.jsx | [auth.test.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/test/auth.test.js) cubre hash/rol; login es manual | — | Ninguna |
| RF-09 | Cerrar sesión manual y automática por inactividad. | **IMPLEMENTADO** | `auth.service.js` `cerrarSesion`, `autenticarToken` (90 min) | `POST /api/auth/logout`, `GET /api/auth/me` | Botón "Cerrar sesión" en App.jsx | Manual | — | Ninguna |
| RF-10 | Cambiar la contraseña y **exigirlo en el primer ingreso** (contraseña temporal). | **NO IMPLEMENTADO** | — (no existe servicio ni ruta) | — | — | — | No hay endpoint de cambio de contraseña, ni flag `cambio_obligatorio`, ni campo de "contraseña temporal" | **Desarrollo** (endpoint + bandera de temporal + UI) |
| RF-11 | Bloquear la cuenta tras varios intentos fallidos consecutivos. | **IMPLEMENTADO** | `auth.service.js` `iniciarSesion` (`MAX_INTENTOS=5`) + `auditoria_autenticacion` | `POST /api/auth/login` | Login | Manual | — | Ninguna |
| RF-12 | Recuperar contraseña por enlace al correo; al restablecer, desbloquea; no aplica a suspendidos/desvinculados. | **NO IMPLEMENTADO** | — (no hay servicio de correo ni tabla de tokens) | — | — | — | No existe servicio de correo, generación/validación de enlace de un solo uso ni auditoría del flujo | **Desarrollo** |
| RF-13 | Desbloquear cuenta y asignar contraseña temporal. | **PARCIAL** | [operadores.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/operadores.service.js) `cambiarEstadoOperador` (desbloquea al pasar a ACTIVO) | `PATCH /api/operadores/:id/estado` | App.jsx componente `Operadores` | Manual | Desbloquea (`bloqueado=FALSE`), pero **no asigna contraseña temporal** ni fuerza el cambio; no hay listado dedicado de cuentas bloqueadas | **Desarrollo** (temporal + cambio obligatorio) |
| RF-14 | Permitir cada operación solo a los perfiles autorizados. | **IMPLEMENTADO** | [auth.middleware.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/middleware/auth.middleware.js) `requiereAutenticacion`, `requiereRol`, `requiereAdministrador` | Aplicado a todas las rutas `/api/*` | `menuVisible` por rol en App.jsx | `auth.test.js` (2 pruebas sobre `requiereRol`) | — | Ninguna |
| RF-15 | El administrador ejecuta funciones del operador desde su sesión, con registros a su nombre. | **IMPLEMENTADO** | Rutas de movimientos usan `req.user.id` | `POST /api/movimientos/entrada|salida` | Admin ve "entrada", "salida", "historial" | Manual | — | Ninguna |

### Gestión de usuarios del sistema

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-16 | Registrar operador con nombres, apellidos, documento, email, teléfono y **contraseña temporal**. | **PARCIAL** | `operadores.service.js` `crearOperador` | `POST /api/operadores` | `Operadores` en App.jsx | Manual | `operadores` solo tiene `nombre` (sin `apellidos` ni `email`); la contraseña la define el admin (no se marca como temporal) | **Desarrollo** (columnas apellidos/email + temporal) o ajustar documento |
| RF-17 | Buscar operadores/administradores por documento o nombre y ver su estado. | **PARCIAL** | `operadores.service.js` `listarOperadores` | `GET /api/operadores` | `Operadores` en App.jsx (muestra estado) | Manual | No hay búsqueda por documento/nombre en el backend (lista todo) | Desarrollo (filtro server-side) o ajustar documento |
| RF-18 | Modificar los datos de un operador. | **NO IMPLEMENTADO** | — (no hay `actualizarOperador` ni ruta) | — | Sin botón "Editar" en `Operadores` | — | No existe endpoint de edición de datos del operador | **Desarrollo** |
| RF-19 | Suspender operador con motivo; no si tiene sesión activa. | **PARCIAL** | `operadores.service.js` `cambiarEstadoOperador('SUSPENDIDO')` | `PATCH /api/operadores/:id/estado` | `Operadores` | Manual | Rechaza si hay sesión activa ✔; **no exige ni guarda motivo** y no registra auditoría | Desarrollo (motivo + auditoría) o ajustar documento |
| RF-20 | Desvincular operador mediante baja lógica, con motivo; no si tiene sesión activa. | **PARCIAL** | `operadores.service.js` `cambiarEstadoOperador('DESVINCULADO')` | `PATCH /api/operadores/:id/estado` | `Operadores` (solo alterna suspender/activar) | Manual | Baja lógica ✔ y rechazo con sesión activa ✔; **sin motivo** y sin auditoría; la UI no expone "Desvincular" | Desarrollo (motivo + auditoría + UI) |
| RF-21 | Reactivar operador suspendido o desvinculado, con motivo. | **PARCIAL** | `operadores.service.js` `cambiarEstadoOperador('ACTIVO')` | `PATCH /api/operadores/:id/estado` | `Operadores` ("Activar") | Manual | Reactiva ✔; **sin motivo** y **sin contraseña temporal** para desvinculados | Desarrollo (motivo + temporal) |

### Gestión de clientes, vehículos y mensualidades

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-22 | Buscar cliente por documento y mostrar datos, vehículos y **estado de mensualidad de cada uno**; si no existe, habilitar registro. | **PARCIAL** | [clientes.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/clientes.service.js) `listarClientes`, `obtenerCliente` | `GET /api/clientes?buscar=`, `GET /api/clientes/:id` | [Clientes.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/components/Clientes.jsx) | Manual | `obtenerCliente` devuelve vehículos pero **no el estado de la mensualidad**; la ruta es **admin-only** (el documento indica Operador/Administrador); el modelo de cliente difiere (PERSONA/EMPRESA vs. nombres/apellidos) | **Desarrollo** (incluir mensualidades, permitir operador, UI de consulta) |
| RF-23 | Registrar **en una sola operación** un cliente nuevo **con al menos un vehículo** y la **autorización de tratamiento de datos**. | **NO IMPLEMENTADO** | `crearCliente` (solo cliente, sin transacción ni vehículo) | `POST /api/clientes` (no crea vehículo) | Clientes.jsx (form de cliente solo) | — | No existe endpoint transaccional cliente+vehículo; **no se registra autorización** (las columnas `autorizacion_datos`/`autorizacion_fecha` están definidas en la migración 003 pero el servicio no las usa) | **Desarrollo** (endpoint atómico + autorización + auditoría) |
| RF-24 | Agregar vehículo a cliente existente; si la placa es de otro cliente, rechazar informando que el cambio de titular lo hace el administrador. | **PARCIAL** | [vehiculos.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/vehiculos.service.js) `crearVehiculo` | `POST /api/vehiculos` | [Vehiculos.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/components/Vehiculos.jsx) | Manual | Rechaza placa duplicada (409) ✔; el mensaje es genérico ("Ya existe un vehículo registrado con esa placa"), no menciona el cambio de titular | Ajustar mensaje o documento |
| RF-25 | Modificar datos del cliente **conservando los valores anteriores**; opción deshabilitada para el operador. | **PARCIAL** | `clientes.service.js` `actualizarCliente` | `PUT /api/clientes/:id` | Clientes.jsx (admin) | Manual | Actualiza ✔, admin-only ✔; **no conserva valores anteriores** (sin auditoría); el operador no ve la sección (se oculta en vez de "deshabilitarse") | Desarrollo (auditoría de cambios) o ajustar documento |
| RF-26 | Modificar datos del vehículo (placa, tipo, color, marca, modelo); placa válida y única; **no cambiar tipo si tiene movimiento activo**. | **PARCIAL** | `vehiculos.service.js` `actualizarVehiculo` | `PUT /api/vehiculos/:id` | Vehiculos.jsx | Manual | Edita datos ✔ y conserva movimientos ✔; **no bloquea el cambio de tipo con movimiento activo** | Desarrollo (control tipo↔movimiento activo) o ajustar documento |
| RF-27 | Asignar un vehículo a un **nuevo titular (cliente nuevo)**, conservando el historial del titular anterior. | **NO IMPLEMENTADO** | `vehiculos.service.js` `actualizarVehiculo` | `PUT /api/vehiculos/:id` | Vehiculos.jsx | — | El código **bloquea** el cambio de propietario cuando existe historial de movimientos; el documento exige permitirlo conservando el historial. Comportamiento opuesto | **Desarrollo** (flujo de cambio de titular con trazabilidad) o ajustar documento |
| RF-28 | Registrar mensualidad con fecha de activación actual o futura, 30 días calendario, activación automática, sin cobro; estados Programada/Vigente/Vencida; sin traslapes. | **PARCIAL** | [suscripciones.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/suscripciones.service.js) `crearSuscripcion`, `sincronizarEstadosSuscripciones` | `POST /api/suscripciones` | [Suscripciones.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/components/Suscripciones.jsx) | [suscripciones.validation.test.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/test/suscripciones.validation.test.js) (6 pruebas sobre cálculo de período) | Estados reales: **PENDIENTE / ACTIVA / VENCIDA / CANCELADA** (documento: Programada/Vigente/Vencida). El **valor (`valor>0`) es obligatorio** (documento: "sin cobro"). La renovación debe iniciar el día siguiente al último período (más estricto que el documento) | Mayormente documental (mapear estados); evaluar si `valor` debe ser opcional |
| RF-29 | Modificar la fecha de activación de una mensualidad; el sistema recalcula el vencimiento. | **NO IMPLEMENTADO** | — (solo existe `cambiarEstadoSuscripcion`) | — | Suscripciones.jsx (solo registra/cancela) | — | No existe endpoint para editar `fecha_inicio`/`fecha_fin` | **Desarrollo** |

### Gestión de celdas

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-30 | Crear celdas con código único, tipo (carro o moto) y ubicación. | **IMPLEMENTADO** | `celdas.service.js` `crearCelda` | `POST /api/celdas` | Celdas.jsx | Manual | — | Ninguna |
| RF-31 | Modificar código, tipo y ubicación de una celda disponible; los movimientos conservan código y tipo usados. | **PARCIAL** | `celdas.service.js` `modificarCelda` | `PUT /api/celdas/:id` | Celdas.jsx ("Editar" si disponible) | Manual | Modificación solo-en-disponible ✔; **los movimientos nuevos no guardan snapshot**: `registrarEntrada` no llena `codigo_celda_snapshot`/`tipo_celda_snapshot` (la migración 004 solo hace backfill de filas históricas) y el historial lee el código actual vía `JOIN` | Desarrollo (poblar snapshots en la entrada) o ajustar documento |
| RF-32 | Bloquear una celda disponible con motivo; si está ocupada, rechazar informando placa, cliente y usuario de entrada. | **IMPLEMENTADO** | `celdas.service.js` `cambiarBloqueoCelda` | `POST /api/celdas/:id/bloquear` | Celdas.jsx | Manual | — | Ninguna |
| RF-33 | Desbloquear una celda bloqueada, dejándola disponible. | **IMPLEMENTADO** | `celdas.service.js` `cambiarBloqueoCelda` | `POST /api/celdas/:id/desbloquear` | Celdas.jsx | Manual | — | Ninguna |
| RF-34 | Consultar el historial de una celda: **movimientos**, bloqueos, desbloqueos y modificaciones. | **PARCIAL** | `celdas.service.js` `historialCelda` | `GET /api/celdas/:id/historial` | Celdas.jsx (modal de historial) | Manual | Devuelve `historial_celdas` (CREAR/MODIFICAR/BLOQUEAR/DESBLOQUEAR) pero **no los movimientos** asociados a la celda | Desarrollo (unir movimientos) o ajustar documento |

### Corrección de movimientos y auditoría

| ID | Descripción (documento) | Estado | Archivo / función | Endpoint | Frontend | Prueba | Diferencia doc vs. código | Acción necesaria |
|---|---|---|---|---|---|---|---|---|
| RF-35 | Anular lógicamente un movimiento con motivo; si la entrada estaba abierta, libera la celda. | **PARCIAL** | [movimientos.admin.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/movimientos.admin.service.js) `anularMovimiento` | `POST /api/movimientos-admin/:id/anular` | **Sin UI** (no hay botón "Anular") | Manual (backend) | Backend correcto (motivo ≥5, libera celda, auditoría); **no hay componente de frontend** para invocarlo | **Desarrollo** (UI de anulación) |
| RF-36 | Corregir observaciones, accesos de entrada/salida y celda (solo activos), con motivo; fecha/hora/usuario/vehículo no modificables. | **PARCIAL** | `movimientos.admin.service.js` `modificarMovimiento` | `PATCH /api/movimientos-admin/:id/corregir` | **Sin UI** | Manual (backend) | Backend correcto (solo activos, celda disponible del tipo compatible, sin fecha/hora/usuario/vehículo); **no hay componente de frontend** | **Desarrollo** (UI de corrección) |
| RF-37 | Registrar cada operación (registro, modificación, anulación, bloqueo) e inicios de sesión exitosos y fallidos, con usuario/fecha/hora/acción y valores anterior y nuevo. | **PARCIAL** | [auditoria.service.js](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/src/services/auditoria.service.js) `registrarAuditoria`; `auth.service.js` login; `celdas.service.js`; `movimientos.admin.service.js` | (interno) | — | Manual | Movimientos (ENTRADA/SALIDA/MODIFICAR/ANULAR), celdas (CREAR/MODIFICAR/BLOQUEAR/DESBLOQUEAR) y login (LOGIN_EXITOSO/FALLIDO/BLOQUEADA/CIERRE) ✔. **Faltan**: operadores (crear/suspender/desvincular/reactivar), clientes (crear/modificar) y vehículos (crear/modificar) | **Desarrollo** (auditar los módulos faltantes) |
| RF-38 | Consultar auditoría filtrando por **usuario, fecha y tipo de acción**; mostrar valores anterior y nuevo. | **PARCIAL** | `auditoria.service.js` `consultarAuditoria` | `GET /api/auditoria?usuario=&desde=&hasta=&accion=&entidad=` | [Auditoria.jsx](file:///c:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/frontend/src/components/Auditoria.jsx) | Manual | Backend filtra por usuario/fecha/acción/entidad ✔; **la UI no expone el filtro por usuario**; solo lee `auditoria_eventos` (no unifica `auditoria_autenticacion`) | Desarrollo (filtro de usuario en UI + unificar fuentes) |

---

## B. Matriz de Requerimientos No Funcionales (RNF-01 a RNF-13)

| ID | Categoría / criterio (documento) | Estado | Evidencia en el código | Diferencia / observación | Acción |
|---|---|---|---|---|---|
| RNF-01 | Usabilidad: formularios y mensajes comprensibles | **IMPLEMENTADO** | Mensajes `form-message` en App.jsx, Clientes.jsx, Vehiculos.jsx, Celdas.jsx | — | Ninguna |
| RNF-02 | Integridad entrada/salida: no salida sin entrada | **IMPLEMENTADO** | `registrarSalida` valida entrada abierta | — | Ninguna |
| RNF-03 | Rendimiento: consultas ≤ 3 s | **NO VERIFICABLE** | Índices en `movimientos`, `suscripciones`, `celdas` | No hay pruebas de rendimiento ni mediciones | Prueba de tiempos pendiente |
| RNF-04 | Seguridad credenciales: hash, nunca texto plano; política mínima | **PARCIAL** | `generarHashPassword` (scrypt), `verificarPassword` | Hash ✔ y nunca texto plano ✔; **política: código exige mínimo 10 caracteres (solo longitud)**; documento: mínimo 8 con letras y números | **Alinear** (implementar 8+letras/números o documentar 10) |
| RNF-05 | Sesión: expira a los 90 min; bloqueo a los 5 intentos | **IMPLEMENTADO** | `SESION_MINUTOS=90`, `MAX_INTENTOS=5` en auth.service.js | — | Ninguna |
| RNF-06 | Autorización: 401 sin sesión, 403 sin permiso | **IMPLEMENTADO** | `requiereAutenticacion` (401), `requiereRol` (403) | — | Ninguna |
| RNF-07 | Trazabilidad con usuario/fecha/hora del servidor | **PARCIAL** | `auditoria_eventos.fecha_hora` (DEFAULT CURRENT_TIMESTAMP) | Faltan módulos auditados (operadores, clientes, vehículos) — ver RF-37 | Desarrollo |
| RNF-08 | No eliminación física: bajas lógicas con motivo | **PARCIAL** | Anular movimiento ✔, bloquear celda ✔, desvincular operador ✔ (baja lógica) | Suspender/desvincular operador **no registran motivo** | Desarrollo (motivo) o ajustar documento |
| RNF-09 | Unicidad: documento, placa, código de celda; un movimiento activo por vehículo/celda; una mensualidad vigente por vehículo; ≥1 admin activo | **IMPLEMENTADO** | `uq_operadores_documento`, `placa UNIQUE`, `codigo UNIQUE`, `uq_vehiculo_movimiento_activo`, `uq_celda_movimiento_activo`; `cambiarEstadoOperador` garantiza un admin activo | "Una mensualidad vigente por vehículo" se controla por lógica de traslapes, no por UNIQUE simple | Ninguna (observación) |
| RNF-10 | Atomicidad: operaciones compuestas todo-o-nada | **PARCIAL** | Entrada, salida y suscripción usan transacción con `FOR UPDATE` | **RF-23 (cliente + vehículo) no es transaccional** porque no existe el flujo combinado | Desarrollo (RF-23) |
| RNF-11 | Usabilidad por perfil: el operador no ve administración; "Modificar" deshabilitada; rechazos claros | **PARCIAL** | `menuVisible` filtra por rol; el operador no ve las secciones admin | El código **oculta** la sección admin en vez de mostrar acciones "deshabilitadas" como indica el documento | Ajustar documento (o implementar deshabilitado) |
| RNF-12 | Protección de datos (Ley 1581): autorización con fecha; acceso solo autenticado con permiso | **NO IMPLEMENTADO** | Columnas `autorizacion_datos`/`autorizacion_fecha` definidas en la migración 003 | **No se captura ni usa la autorización** en el servicio de clientes | **Desarrollo** (ligado a RF-23) |
| RNF-13 | Mantenibilidad: módulos con capa de servicio; API con códigos HTTP estándar | **IMPLEMENTADO** | `services/` + `routes/` por módulo; códigos 400/401/403/404/409 | — | Ninguna |

---

## C. Listado de incumplimientos reales

**Funcionales (bloqueantes):**

1. **RF-10** — No existe cambio de contraseña ni obligatoriedad en primer ingreso.
2. **RF-12** — No existe recuperación de contraseña por correo.
3. **RF-18** — No existe modificación de datos del operador.
4. **RF-23** — No existe registro transaccional cliente+vehículo ni registro de autorización de datos.
5. **RF-27** — El cambio de titular está **bloqueado** cuando hay historial (lo contrario del requisito).
6. **RF-29** — No existe modificación de la fecha de activación de la mensualidad.

**Funcionales (parciales con control faltante):**

7. **RF-01** — Tipo `CAMIONETA` y su mapeo a celdas de carro no existen.
8. **RF-13 / RF-16 / RF-21** — Falta contraseña temporal (y `apellidos`/`email` del operador).
9. **RF-19 / RF-20 / RF-21** — Suspender/desvincular/reactivar sin motivo ni auditoría.
10. **RF-22** — La consulta de cliente no incluye el estado de mensualidad y está restringida a admin.
11. **RF-25 / RF-26** — Sin auditoría de valores anteriores; sin bloqueo de cambio de tipo con movimiento activo.
12. **RF-31** — Los movimientos nuevos no guardan snapshot de código/tipo de celda.
13. **RF-34** — El historial de celda no incluye movimientos.
14. **RF-35 / RF-36** — Lógica de backend correcta pero **sin interfaz** para anular/corregir movimientos.
15. **RF-37 / RF-38** — Auditoría incompleta (faltan operadores, clientes, vehículos) y la UI de auditoría no filtra por usuario.

**No funcionales:**

16. **RNF-04** — Inconsistencia de la política de contraseña (10 vs. 8+letras/números).
17. **RNF-12 / RNF-10** — Sin autorización de datos ni atomicidad cliente+vehículo.
18. **RNF-07 / RNF-08** — Trazabilidad y motivos incompletos en gestión de usuarios.
19. **RNF-03** — Sin evidencia de rendimiento.
20. **RNF-11** — Se oculta en vez de deshabilitar las acciones de administración.

---

## D. Requisitos ya cumplidos (no deben modificarse)

Estos requisitos están implementados con sus controles y **no deben tocarse** para evitar regresiones:

- **RF-02** Validación de ingreso (vehículo + mensualidad vigente + sin entrada activa + celda disponible).
- **RF-04 / RF-05** Registro y validación de salida (no depende de la mensualidad).
- **RF-06** Estado/resumen/reutilización de celdas.
- **RF-07** Consulta de movimientos con filtros en SQL, orden descendente (probado con 7 pruebas).
- **RF-08 / RF-09 / RF-11 / RF-14 / RF-15** Autenticación, sesión, bloqueo por intentos, autorización por rol, admin como operador.
- **RF-30 / RF-32 / RF-33** Crear, bloquear y desbloquear celdas.
- **RNF-01, RNF-02, RNF-05, RNF-06, RNF-09, RNF-13**.

---

## E. Priorización de cambios mínimos para cumplir la entrega

**Prioridad 1 — Requisitos de seguridad de la Iteración 2 (sin ellos la entrega queda incompleta):**

1. **RF-10** Cambio de contraseña + bandera de "contraseña temporal" (base para RF-13, RF-16, RF-21).
2. **RF-13 / RF-16 / RF-21** Contraseña temporal y campos `apellidos`/`email` del operador.
3. **RF-18** Modificación de datos del operador.
4. **RF-12** Recuperación de contraseña por correo.

**Prioridad 2 — Flujo comercial cliente/vehículo:**

5. **RF-23** Registro transaccional cliente+vehículo + autorización de datos (cubre RNF-10 y RNF-12).
6. **RF-22** Consulta de cliente con vehículos y estado de mensualidad.
7. **RF-24** Mensaje de rechazo de placa de otro cliente.
8. **RF-25 / RF-26** Auditoría de cambios y control de tipo con movimiento activo.

**Prioridad 3 — Mensualidades y celdas:**

9. **RF-29** Modificación de la fecha de activación.
10. **RF-28** Alineación de nomenclatura de estados (y decisión sobre `valor`).
11. **RF-31 / RF-34** Snapshots de celda y movimientos en el historial.

**Prioridad 4 — Corrección de movimientos y auditoría (backend ya existe):**

12. **RF-35 / RF-36** Interfaz de anulación y corrección de movimientos.
13. **RF-27** Flujo de cambio de titular.
14. **RF-37 / RF-38** Auditoría de operadores/clientes/vehículos y filtro de usuario en la UI.

**Prioridad 5 — Ajustes menores:** RF-01 (camionetas), RF-03 (UI de consulta), RF-17 (búsqueda server-side), RNF-03 (prueba de rendimiento), RNF-04 (política).

---

## F. Qué se resuelve ajustando la documentación y qué requiere desarrollo

### Resoluble ajustando el documento (la implementación es razonable)

- **RF-28 / RNF-04** — Declarar los estados reales (`PENDIENTE/ACTIVA/VENCIDA/CANCELADA`) y la política de contraseña efectiva (mínimo 10 caracteres), o bien corregir el código para igualar el documento (entonces sería desarrollo).
- **RF-24** — Precisar el mensaje de rechazo por placa duplicada.
- **RF-25 / RNF-11** — Aclarar que la sección de administración se **oculta** al operador (no se "deshabilita" el botón).
- **RF-01** — Si el parqueadero no opera camionetas, retirar la mención; si sí, es desarrollo.
- **Diagramas** — Ajustar el diagrama de recuperación por correo y el de cambio de contraseña (hoy sin implementación), y el de registro de cliente con vehículo (hoy sin transacción ni autorización).
- **RF-03 / RF-17 / RF-34** — Matizar el alcance (consulta por placa sin pantalla dedicada; listado sin búsqueda; historial sin movimientos) si el docente lo admite.

### Requiere desarrollo real (no basta documentar)

- **RF-10, RF-12, RF-13 (temporal), RF-16 (apellidos/email), RF-18, RF-21 (temporal).**
- **RF-23** (transacción cliente+vehículo + autorización) → arrastra **RNF-10 y RNF-12**.
- **RF-27** (cambio de titular; hoy bloqueado).
- **RF-29** (edición de fecha de activación).
- **RF-35 / RF-36** (interfaz de anulación/corrección de movimientos).
- **RF-37 / RF-38** (auditoría de operadores/clientes/vehículos y filtro de usuario).
- **RF-31** (poblar snapshots de celda en la entrada de vehículos).
- **RF-19 / RF-20** (motivo y auditoría de suspensión/desvinculación).

---

## G. Pruebas pendientes para demostrar el cumplimiento

### Automatizadas existentes (17 reales, ejecutadas con `npm test`)

- **auth.test.js** (4): hash scrypt / no texto plano; rechazo de contraseñas < 10; rol autorizado; rol no autorizado (403).
- **movimientos.filtros.test.js** (7): filtros sin estado, TODOS, ACTIVOS, FINALIZADOS, ANULADOS, minúsculas y estado inválido.
- **suscripciones.validation.test.js** (6): período de 30 días (acepta/rechaza 29/31), fechas imposibles, día siguiente, cambio de año.

### Pruebas a ejecutar para demostrar cada requisito (contra MySQL real)

**Seguridad (nuevas tras implementar):**

1. RF-10: ingreso con contraseña temporal → el sistema exige el cambio antes de otras funciones.
2. RF-12: solicitar recuperación con documento existente e inexistente → misma respuesta; el enlace vence y desbloquea.
3. RF-13: cuenta bloqueada → admin desbloquea y asigna temporal → el usuario cambia al ingresar.
4. RF-11/RF-05: 5 intentos fallidos bloquean la cuenta; el contador se reinicia con un ingreso exitoso.
5. RF-14/RNF-06: petición sin token → 401; operador invocando ruta admin → 403.

**Usuarios:**

6. RF-16: crear operador (documento único, queda activo con temporal).
7. RF-18: modificar datos del operador; el documento sigue siendo único y la modificación queda auditada.
8. RF-19/RF-20: suspender/desvincular con y sin sesión activa (se rechaza con sesión); se conserva el historial.
9. RF-21: reactivar desvinculado → recibe temporal que debe cambiar.

**Clientes/vehículos/mensualidades:**

10. RF-22: consultar cliente por documento → datos + vehículos + estado de mensualidad; si no existe, habilita registro.
11. RF-23/RNF-10/RNF-12: registrar cliente + vehículo en una sola operación; verificar atomicidad (si falla el vehículo no queda el cliente) y que se guarda la autorización con fecha.
12. RF-24: agregar vehículo con placa de otro cliente → rechazo con mensaje de cambio de titular.
13. RF-25/RF-26: modificar cliente/vehículo y verificar auditoría de valores anteriores; impedir cambio de tipo con movimiento activo.
14. RF-27: cambiar titular conservando el historial del anterior.
15. RF-28: registrar mensualidad con fecha futura y verificar Programada→Vigente→Vencida; rechazar traslapes.
16. RF-29: modificar fecha de activación y verificar recálculo del vencimiento.

**Celdas y movimientos:**

17. RF-30/RF-32/RF-33: crear, bloquear (con motivo) y desbloquear; bloquear una ocupada → rechazo con placa/cliente/operador.
18. RF-31: modificar celda disponible y verificar que los movimientos conservan el código/tipo usados (snapshot).
19. RF-34: consultar historial de celda → movimientos + bloqueos + desbloqueos + modificaciones.
20. RF-35: anular movimiento con motivo → libera la celda y queda consultable como Anulado.
21. RF-36: corregir observaciones/accesos/celda solo en activo; bloquear edición de fecha/hora/usuario/vehículo.
22. RF-37/RF-38: registrar operaciones e inicios de sesión (exitosos y fallidos); consultar auditoría filtrando por usuario, fecha y tipo de acción.

**Entrada/salida (regresión):**

23. RF-01/RF-02: entrada con placa no registrada → rechazo sin autocrear; con mensualidad vencida → rechazo; exitosa → celda asignada (camioneta usa celda de carro si aplica).
24. RF-04/RF-05: salida sin entrada activa → rechazo; salida con mensualidad vencida → permitida.
25. RF-07: filtros ACTIVOS/FINALIZADOS/ANULADOS/TODOS con búsqueda por placa y orden descendente.

---

## Inconsistencias documentales verificadas (sección 4)

1. **Política de contraseña** — Documento: mínimo 8 caracteres con letras y números. Código: mínimo 10 (solo longitud). La prueba `auth.test.js` valida el umbral de 10. **Inconsistencia real.**
2. **Registro de cliente y vehículo en una sola transacción** — No implementado (RF-23).
3. **Autorización de tratamiento de datos** — Columnas definidas en la migración 003, sin captura ni uso (RF-23/RNF-12).
4. **Estados de mensualidad** — Documento: Programada/Vigente/Vencida. Código: PENDIENTE/ACTIVA/VENCIDA/CANCELADA.
5. **Roles** — Documento: administrador, operador y cliente. Código: `operadores.rol ∈ {ADMINISTRADOR, OPERADOR}`; el cliente es una entidad sin acceso, coherente con el documento, pero debe documentarse explícitamente.
6. **Auditoría de inicio de sesión y operaciones** — Login en `auditoria_autenticacion`; operaciones en `auditoria_eventos`; faltan operadores, clientes y vehículos.
7. **Diagramas vs. procesos implementados** — Los diagramas de recuperación por correo, cambio de contraseña y registro de cliente con vehículo describen flujos no implementados; el diagrama de entrada de vehículo sí coincide con el backend.

---

## Conclusión

> **Nota:** esta conclusión corresponde al **diagnóstico de línea base** (antes del cierre). El estado final —37 de 38 RF implementados plenamente, 13/13 RNF con evidencia, 52/52 pruebas automatizadas y M-01 a M-18 reejecutadas (33/33)— se detalla en la sección 0 y en [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md).

La **Iteración 1** (entrada/salida, celdas, historial) está sólida y no debe modificarse. La **Iteración 2** tenía una base funcional correcta en autenticación básica, autorización por rol, gestión de celdas y auditoría de movimientos/celdas, pero en la línea base **no cerraba** sin: contraseñas (cambio, recuperación, temporal), edición/desvinculación/desactivación con motivo y auditoría de usuarios, el flujo de cliente+vehículo con autorización de datos, el cambio de titular y la edición de mensualidades, además de la interfaz de anulación/corrección de movimientos. Estos puntos fueron implementados durante el cierre (ver sección 0).
