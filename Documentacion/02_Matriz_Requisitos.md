# Matriz de requisitos — Iteración 2 (numeración del documento EA2)

Esta matriz usa la **numeración oficial del documento académico `Grupo03_Iteracion_2_EA2`** (RF-01 a RF-38 y RNF-01 a RNF-13) para eliminar la ambigüedad con una numeración interna previa.

Leyenda: **IMPLEMENTADO** (lógica y controles verificados) · **PARCIAL** (existe con una limitación identificada) · **NO IMPLEMENTADO**.
`Verificación`: `Automatizada` = cubierto por `backend/test`; `Inspección` = revisión de código/BD; `Manual ejecutada` = escenario reejecutado con el arnés Playwright versionado (`frontend/e2e/`), **33/33 aprobadas** con 43 capturas únicas en [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md). El dictamen vigente, las cifras finales y las limitaciones están en [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md).

## 1. Requisitos funcionales (RF-01 a RF-38)

### Entrada y salida de vehículos

| ID | Requisito | Estado | Evidencia (archivo · función) | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-01 | Entrada por placa con fecha/hora, usuario, acceso y celda automática por tipo (camionetas → celda de carro) | Implementado | `movimientos.service.js`·`registrarEntrada`; `validators/placas.js`·`tipoCeldaParaVehiculo` | Entrada válida → `201` con celda asignada | Automatizada (`vehiculos.tipos.test.js`) + Manual ejecutada |
| RF-02 | Entrada solo con vehículo registrado + mensualidad vigente + sin entrada activa + celda disponible | Implementado | `movimientos.service.js`·`registrarEntrada` | Cualquier condición faltante → rechazo con motivo | Manual ejecutada |
| RF-03 | Consultar registros de entrada por placa | Implementado | `movimientos.routes.js`·`GET /vehiculo/:placa` | Devuelve `dentro:true/false` y el movimiento activo | Inspección |
| RF-04 | Registrar salida asociada a la entrada activa | Implementado | `movimientos.service.js`·`registrarSalida` | Vehículo dentro → `200`; sin entrada → error | Manual ejecutada |
| RF-05 | Verificar entrada activa antes de la salida | Implementado | `movimientos.service.js`·`registrarSalida` | Sin entrada abierta → error | Manual ejecutada |
| RF-06 | Estado de celdas, resumen y reutilización | Implementado | `celdas.service.js`·`listarCeldas/resumenCeldas` | Estados DISPONIBLE/OCUPADA/BLOQUEADA correctos | Inspección |
| RF-07 | Historial por estado, búsqueda por placa y orden descendente | Implementado | `movimientos.service.js`·`listarMovimientos` | `?estado=ACTIVOS/FINALIZADOS/ANULADOS/TODOS` y `?placa=` en SQL | Automatizada (`movimientos.filtros.test.js`) |

### Seguridad y control de acceso

| ID | Requisito | Estado | Evidencia | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-08 | Autenticar usuarios activos con documento y contraseña | Implementado | `auth.service.js`·`iniciarSesion` | Válidas → `200` con token; inválidas → `401` | Automatizada (`auth.test.js`) |
| RF-09 | Cierre de sesión manual y por inactividad (90 min) | Implementado | `auth.service.js`·`cerrarSesion/autenticarToken` | Sesión sin actividad ≥ 90 min → `401` | Inspección |
| RF-10 | Cambio de contraseña con obligatoriedad en el primer ingreso (temporal) | Implementado | `auth.service.js`·`cambiarPassword`; `auth.middleware.js` | Con `password_temporal` → `403 CAMBIO_PASSWORD_REQUERIDO` fuera de rutas permitidas | Automatizada (`password.politica.test.js`) |
| RF-11 | Bloqueo tras intentos fallidos | Implementado | `auth.service.js`·`iniciarSesion` (`MAX_INTENTOS=5`) | 5 fallos → cuenta bloqueada + evento `CUENTA_BLOQUEADA` | Inspección |
| RF-12 | Recuperación de contraseña por enlace de correo | Implementado (limitación externa) | `auth.service.js`·`solicitarRecuperacion/restablecerPassword`; `correo.service.js` | Respuesta equivalente; token de uso único y vencimiento; desbloquea | Manual ejecutada (M-18): flujo verificado con el enlace del modo consola; **envío real no probado (sin proveedor SMTP/API configurado)** |
| RF-13 | Desbloqueo de cuenta con contraseña temporal | Implementado | `operadores.service.js`·`desbloquearCuenta` | Cuenta bloqueada → temporal + cambio obligatorio; no reactiva suspendidos | Inspección |
| RF-14 | Operación solo para perfiles autorizados | Implementado | `auth.middleware.js`·`requiereRol/requiereAdministrador` | Sin permiso → `403`; sin sesión → `401` | Automatizada (`auth.test.js`) |
| RF-15 | El administrador ejecuta funciones del operador con registros a su nombre | Implementado | Rutas de movimientos usan `req.user.id` | La auditoría registra al operador de la sesión | Inspección |

### Gestión de usuarios del sistema

| ID | Requisito | Estado | Evidencia | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-16 | Registrar operador (nombres, apellidos, documento, correo, teléfono, rol, estado, contraseña temporal) | Implementado | `operadores.service.js`·`crearOperador`; migración 005 | Documento duplicado → `409`; sin contraseña → temporal emitida | Inspección |
| RF-17 | Buscar operadores por documento o nombre y ver estado | Implementado | `operadores.service.js`·`listarOperadores` | Filtros ejecutados en SQL | Inspección |
| RF-18 | Modificar datos del operador | Implementado | `operadores.service.js`·`actualizarOperador` | Unicidad de documento y correo; auditoría con valores | Manual ejecutada |
| RF-19 | Suspender con motivo; no si tiene sesión activa | Implementado | `operadores.service.js`·`cambiarEstadoOperador` | Sin motivo → error; con sesión → `409` | Manual ejecutada |
| RF-20 | Desvincular (baja lógica) con motivo; no si tiene sesión activa | Implementado | `operadores.service.js`·`cambiarEstadoOperador` | `estado=DESVINCULADO`, `activo=false` | Manual ejecutada |
| RF-21 | Reactivar con motivo y contraseña temporal | Implementado | `operadores.service.js`·`cambiarEstadoOperador` | Reactiva con temporal + cambio obligatorio | Manual ejecutada |

### Gestión de clientes, vehículos y mensualidades

| ID | Requisito | Estado | Evidencia | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-22 | Buscar cliente por documento con datos, vehículos y estado de mensualidad | Implementado | `clientes.service.js`·`obtenerClientePorDocumento/incluirMensualidades` | Devuelve vehículos con su mensualidad; `null` si no existe | Inspección |
| RF-23 | Registro transaccional de cliente + ≥1 vehículo + autorización de datos | Implementado | `clientes.service.js`·`registrarClienteConVehiculos` | Sin autorización o sin vehículo → error; fallo → rollback total | Manual ejecutada |
| RF-24 | Agregar vehículo a cliente existente; rechazo de placa de otro cliente con aviso de cambio de titular | Implementado | `vehiculos.service.js`·`insertarVehiculo` | Placa de otro cliente → `409` con mensaje de cambio de titular | Inspección |
| RF-25 | Modificar cliente conservando valores anteriores; restricción por perfil | Implementado | `clientes.service.js`·`actualizarCliente` | Auditoría anterior/nuevo; `PUT` admin-only | Manual ejecutada |
| RF-26 | Modificar vehículo; placa válida y única; no cambiar tipo con movimiento activo | Implementado | `vehiculos.service.js`·`actualizarVehiculo` | Tipo con movimiento activo → `409` | Automatizada (`vehiculos.tipos.test.js`) |
| RF-27 | Cambio de titular conservando historial (fecha, operador, motivo) | Implementado | `vehiculos.service.js`·`cambiarTitular/historialTitulares`; `historial_titulares_vehiculo` | Conserva movimientos y vincula titular anterior | Manual ejecutada |
| RF-28 | Mensualidad de 30 días, activación/vencimiento automáticos, sin cobro, sin traslapes | Implementado | `suscripciones.service.js`·`crearSuscripcion/sincronizarEstadosSuscripciones`; migración `006` | Período ≠ 30 días → error; traslape → error; estados `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` alineados con EA2 | Automatizada (`suscripciones.validation.test.js`, `ciclo.operativo.test.js`) |
| RF-29 | Modificar la fecha de activación con recálculo del vencimiento | Implementado | `suscripciones.service.js`·`modificarFechaActivacion` | Recalcula fin (+29 días); valida traslapes; audita | Manual ejecutada |

### Gestión de celdas

| ID | Requisito | Estado | Evidencia | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-30 | Crear celdas con código único, tipo y ubicación | Implementado | `celdas.service.js`·`crearCelda` | Código duplicado → `409` | Inspección |
| RF-31 | Modificar celda disponible; movimientos conservan código/tipo usados (snapshot) | Implementado | `celdas.service.js`·`modificarCelda`; `movimientos.service.js` (snapshot) | Modificación solo en disponible; snapshot en cada entrada | Inspección |
| RF-32 | Bloquear celda disponible con motivo; si está ocupada, rechazar con placa/cliente/usuario | Implementado | `celdas.service.js`·`cambiarBloqueoCelda` | Ocupada → error informativo | Inspección |
| RF-33 | Desbloquear celda bloqueada | Implementado | `celdas.service.js`·`cambiarBloqueoCelda` | `activa = TRUE` | Inspección |
| RF-34 | Historial de celda (movimientos, bloqueos, desbloqueos, modificaciones) | Implementado | `celdas.service.js`·`historialCelda` | Une `historial_celdas` + movimientos con orden cronológico | Inspección |

### Corrección de movimientos y auditoría

| ID | Requisito | Estado | Evidencia | Criterio de aceptación | Verificación |
|---|---|---|---|---|---|
| RF-35 | Anular movimiento con motivo; libera la celda si estaba abierta | Implementado | `movimientos.admin.service.js`·`anularMovimiento` | Motivo ≥ 5; no elimina; libera la celda | Manual ejecutada |
| RF-36 | Corregir observaciones, accesos y celda (solo activos) con motivo | Implementado | `movimientos.admin.service.js`·`modificarMovimiento` | No modifica fecha/hora/usuario/vehículo; celda compatible y libre | Manual ejecutada |
| RF-37 | Registrar cada operación e inicio de sesión con usuario/fecha/acción y valores anterior/nuevo | Implementado | `auditoria.service.js`·`registrarAuditoria`; servicios de operadores/clientes/vehículos/celdas/movimientos | Cada operación deja fila con valores anterior/nuevo | Inspección |
| RF-38 | Consultar auditoría por usuario, fechas, acción y entidad | Implementado | `auditoria.service.js`·`consultarAuditoria` | Consulta unificada de ambas tablas; UI con todos los filtros | Inspección |

## 2. Requisitos no funcionales (RNF-01 a RNF-13)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RNF-01 | Usabilidad: formularios y mensajes comprensibles | Implementado | Mensajes de error/éxito en todos los componentes |
| RNF-02 | Integridad entrada/salida | Implementado | `registrarSalida` valida la entrada abierta |
| RNF-03 | Rendimiento ≤ 3 s | Implementado (medido con benchmark) | Historial `GET /api/movimientos?limite=200` con 400 clientes, 400 vehículos, 4.000 movimientos y 80 celdas en MySQL 8.4: **p95 87,02 ms** (concurrencia 1) y **249,36 ms** (concurrencia 10); plan real 84,9 ms. Arnés versionado `frontend/e2e/rendimiento/rnf03.spec.js` (`npm run rendimiento:rnf03`). El valor histórico de `/api/health` (35,7 ms) solo acredita disponibilidad, no rendimiento de consulta |
| RNF-04 | Seguridad de credenciales: scrypt + política mínima | Implementado | `validators/password.js`; `password.politica.test.js` |
| RNF-05 | Sesión 90 min; bloqueo a 5 intentos | Implementado | `SESION_MINUTOS=90`, `MAX_INTENTOS=5` |
| RNF-06 | 401 sin sesión; 403 sin permiso | Implementado | `auth.middleware.js` |
| RNF-07 | Trazabilidad con usuario/fecha/hora del servidor | Implementado | `auditoria_eventos.fecha_hora`; auditoría por módulo |
| RNF-08 | Bajas lógicas con motivo | Implementado | Anulación, bloqueo, suspensión/desvinculación con motivo |
| RNF-09 | Unicidad (documento, placa, código, movimiento activo, ≥1 admin) | Implementado | Índices únicos + guardas de último administrador |
| RNF-10 | Atomicidad de operaciones compuestas | Implementado | Transacciones en entrada, salida, suscripción, cliente+vehículo y titular |
| RNF-11 | Usabilidad por perfil (operador no administra) | Implementado | `menuVisible` filtra por rol; las secciones admin no se muestran al operador y las acciones no permitidas se muestran **deshabilitadas** en la consulta de clientes; el backend responde `403` |
| RNF-12 | Protección de datos (Ley 1581) | Implementado | `autorizacion_datos`/`autorizacion_fecha` (RF-23) |
| RNF-13 | Mantenibilidad y códigos HTTP estándar | Implementado | Capas `services/` + `routes/`; códigos 400/401/403/404/409 |

## 3. Trazabilidad requisito → prueba

| Requisitos | Prueba |
|---|---|
| RF-08, RF-14 | `auth.test.js` |
| RF-07 | `movimientos.filtros.test.js` |
| RF-28 | `suscripciones.validation.test.js` |
| RF-10, RNF-04 | `password.politica.test.js` |
| RF-01, RF-26 | `vehiculos.tipos.test.js` |
| RF-01, RF-02, RF-04, RF-05, RF-23, RF-28, RF-35, RNF-10, RNF-12 | `integracion/ciclo.operativo.test.js` (MySQL real en base independiente) |
| RF-01…RF-38 y RNF-01/RNF-11 (interfaz) | M-01 a M-18 reejecutadas con el arnés Playwright versionado (`npm run test:e2e`, 33/33 aprobadas) ([`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md)) |
| Resto | Inspección de código/BD (ver `09_Matriz_Pruebas.md`) |

> El detalle histórico de archivos, endpoints, componentes y pruebas por requisito está en `11_Informe_Final_Iteracion2.md` y `10_Auditoria_Cumplimiento_EA2.md`. Sus porcentajes y cifras anteriores están supersedidos por el informe de cierre final [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md).
