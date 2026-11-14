# Historias de usuario — Iteración 2 (EA2)

Historias **HU-01 a HU-38** del documento académico `Grupo03_Iteracion_2_EA2`, con su
trazabilidad al código, la base de datos, las pruebas y las evidencias.

Formato de la historia: `Como <rol> quiero <acción> para <beneficio>`.

## Campos por historia (15)

| # | Campo | Descripción |
|---|---|---|
| 1 | `ID` | Identificador de la historia (HU-01…HU-38) |
| 2 | `Módulo` | Módulo funcional del sistema |
| 3 | `Rol` | Operador y/o administrador |
| 4 | `Historia` | Enunciado `Como… quiero… para…` |
| 5 | `RF/RNF` | Requisito asociado del documento EA2 |
| 6 | `Prioridad` | Alta / Media / Baja según criticidad operativa |
| 7 | `Criterios` | Criterios de aceptación |
| 8 | `Estado` | Implementada / Implementada con limitación |
| 9 | `Componente` | Componente o sección del frontend |
| 10 | `Endpoint` | Ruta(s) del API REST |
| 11 | `Servicio` | Archivo · función del backend |
| 12 | `Tablas` | Tablas de MySQL involucradas |
| 13 | `Prueba` | Prueba automatizada que la cubre |
| 14 | `Evidencia` | Captura(s) en `Documentacion/Evidencias/Iteracion_2/` |
| 15 | `Observaciones` | Notas de alcance o límites |

> **Estado de verificación:** las pruebas automatizadas (`backend/test`) y el arnés E2E
> (`frontend/e2e`, M-01…M-18) están **en verde**. Las referencias a capturas corresponden a la
> corrida del 2026-11-13. Cuando una historia se verifica solo por inspección de código o base
> de datos, la columna `Prueba` lo indica.

---

## 1. Módulo: Entrada y salida de vehículos

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-01 | Entrada/Salida | Operador, Administrador | Como operador quiero registrar la entrada de un vehículo por su placa para controlar el ingreso | RF-01 | Alta | Identifica por placa; registra fecha/hora, usuario y acceso; asigna celda por tipo (camioneta → celda de carro); informa resultado | Implementada | `App.jsx` (sección Ingreso) | `POST /api/movimientos/entrada` | `movimientos.service.js`·`registrarEntrada` | `movimientos`, `celdas`, `vehiculos`, `suscripciones`, `auditoria_eventos` | `integracion/ciclo.operativo.test.js`; `vehiculos.tipos.test.js` | `M-08a_entrada_carro.png`, `M-08b_entrada_camioneta.png` | — |
| HU-02 | Entrada/Salida | Operador, Administrador | Como operador quiero que el sistema valide las condiciones de ingreso para evitar entradas no autorizadas | RF-02 | Alta | Placa registrada; mensualidad vigente; sin entrada activa; celda disponible; si falla, informa el motivo y no registra | Implementada | `App.jsx` (sección Ingreso) | `POST /api/movimientos/entrada` | `movimientos.service.js`·`registrarEntrada` | `movimientos`, `vehiculos`, `suscripciones`, `celdas` | `integracion/ciclo.operativo.test.js` | `M-07_entrada_placa_no_registrada.png` | No crea el vehículo si la placa no existe |
| HU-03 | Entrada/Salida | Operador, Administrador | Como operador quiero consultar el registro de entrada por placa para verificar si el vehículo está dentro | RF-03 | Media | Consulta por placa; devuelve el movimiento activo si existe; si no, lo informa | Implementada | `App.jsx` (sección Ingreso) | `GET /api/movimientos/vehiculo/:placa` | `movimientos.routes.js` (consulta directa) | `movimientos`, `vehiculos`, `celdas` | Inspección | — | Devuelve `dentro:true/false` |
| HU-04 | Entrada/Salida | Operador, Administrador | Como operador quiero registrar la salida para mantener actualizado el control del parqueadero | RF-04 | Alta | Verifica entrada activa; registra fecha/hora, usuario y acceso; libera la celda; permite salida con mensualidad vencida | Implementada | `App.jsx` (sección Salida) | `POST /api/movimientos/salida` | `movimientos.service.js`·`registrarSalida` | `movimientos`, `celdas`, `auditoria_eventos` | `integracion/ciclo.operativo.test.js` | `M-09a_salida_registrada.png` | — |
| HU-05 | Entrada/Salida | Operador, Administrador | Como operador quiero que se verifique la entrada activa antes de la salida para evitar movimientos inconsistentes | RF-05 | Alta | Comprueba entrada activa; si no existe, impide la salida; no duplica la salida | Implementada | `App.jsx` (sección Salida) | `POST /api/movimientos/salida` | `movimientos.service.js`·`registrarSalida` | `movimientos` | `integracion/ciclo.operativo.test.js` | `M-09b_salida_sin_entrada.png` | — |
| HU-06 | Entrada/Salida | Operador, Administrador | Como operador quiero consultar el estado de las celdas para conocer cuáles pueden asignarse | RF-06 | Media | Cada celda Disponible/Ocupada/Bloqueada; cambia de estado con entrada/salida; no asigna ocupadas ni bloqueadas; resumen por tipo | Implementada | `App.jsx` (Panel), `Celdas.jsx` | `GET /api/celdas`, `GET /api/celdas/disponibles`, `GET /api/celdas/resumen` | `celdas.service.js`·`listarCeldas`, `resumenCeldas` | `celdas`, `movimientos` | Inspección | `M-15_panel_principal.png`, `M-13a_celda_creada.png` | — |
| HU-07 | Entrada/Salida | Operador, Administrador | Como operador quiero filtrar el historial por estado y placa para ver los vehículos dentro y el historial | RF-07 | Alta | Muestra placa, celda, fecha/hora y estado; filtra por estado y placa; orden descendente | Implementada | `App.jsx` (sección Historial) | `GET /api/movimientos?estado=&placa=&limite=` | `movimientos.service.js`·`listarMovimientos` | `movimientos`, `vehiculos`, `celdas` | `movimientos.filtros.test.js` | `M-10_historial_filtros.png` | Filtro resuelto en SQL, no en pantalla |

## 2. Módulo: Autenticación y seguridad

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-08 | Autenticación | Operador, Administrador | Como usuario quiero iniciar sesión con documento y contraseña para acceder a las funciones de mi perfil | RF-08 | Alta | Acceso con credenciales correctas; error genérico si fallan; bloquea suspendidos/desvinculados; muestra solo opciones del perfil | Implementada | `App.jsx` (Login) | `POST /api/auth/login` | `auth.service.js`·`iniciarSesion` | `operadores`, `sesiones_operadores`, `auditoria_autenticacion` | `auth.test.js` | `M-02a_login_invalido.png`, `M-02b_login_valido.png` | — |
| HU-09 | Autenticación | Operador, Administrador | Como usuario quiero cerrar mi sesión para proteger el acceso a mi cuenta | RF-09 | Media | Cierre manual; cierre automático por inactividad (90 min); exige nuevo inicio tras el cierre | Implementada | `App.jsx` (menú de perfil) | `POST /api/auth/logout` | `auth.service.js`·`cerrarSesion` | `sesiones_operadores` | Inspección | `M-01_recorrido_secciones.png`, `M-16_menu_y_clientes_operador.png` | Inactividad `SESION_MINUTOS=90` |
| HU-10 | Autenticación | Operador, Administrador | Como usuario quiero cambiar mi contraseña para mantener segura mi cuenta | RF-10 | Alta | Solicita actual y nueva; valida política; con temporal exige el cambio; confirma | Implementada | `Cuenta.jsx`, `App.jsx` | `POST /api/auth/cambiar-password` | `auth.service.js`·`cambiarPassword` | `operadores` | `password.politica.test.js` | `M-17c_cambio_obligatorio.png`, `M-17d_password_cambiada.png` | Política: ≥10 caracteres, letras y números, sin espacios |
| HU-11 | Autenticación | Administrador | Como administrador quiero que se bloqueen las cuentas con intentos fallidos para protegerlas | RF-11 | Alta | Bloquea al alcanzar 5 intentos; informa el bloqueo; reinicia contador con ingreso exitoso; registra intentos | Implementada | `App.jsx` (Login) | `POST /api/auth/login` | `auth.service.js`·`iniciarSesion` (`MAX_INTENTOS=5`) | `operadores`, `auditoria_autenticacion` | Inspección | `M-03_cuenta_bloqueada.png` | Evento `CUENTA_BLOQUEADA` |
| HU-12 | Autenticación | Operador, Administrador | Como usuario que olvidó su contraseña quiero recuperarla por correo para volver a acceder | RF-12 | Media | Solicita por documento; enlace de un solo uso con vencimiento; no revela si el documento existe; desbloquea al restablecer; no aplica a suspendidos | Implementada con limitación | `Recuperacion.jsx` | `POST /api/auth/recuperacion`, `POST /api/auth/recuperacion/restablecer` | `auth.service.js`·`solicitarRecuperacion/restablecerPassword`; `correo.service.js` | `recuperacion_password`, `operadores` | Inspección | `M-18a…M-18d` (`M-18` con enlace en modo consola) | **El envío real de correo no está habilitado** (sin proveedor SMTP/API) |
| HU-13 | Autenticación | Administrador | Como administrador quiero desbloquear una cuenta y asignar contraseña temporal para que el usuario vuelva a ingresar | RF-13 | Media | Lista cuentas bloqueadas; desbloquea y asigna temporal; exige cambio en el siguiente ingreso | Implementada | `Operadores.jsx` | `POST /api/operadores/:id/desbloquear` | `operadores.service.js`·`desbloquearCuenta` | `operadores` | Inspección | `M-17b_desbloqueo_cuenta.png` | No reactiva suspendidos |
| HU-14 | Autenticación | Administrador | Como administrador quiero que cada operación se permita solo a perfiles autorizados para proteger el sistema | RF-14, RNF-06, RNF-11 | Alta | Rechaza sin sesión (401); rechaza sin permiso (403) aunque se invoque directo; el operador no accede a administración | Implementada | `App.jsx` (`menuVisible`) | Todas las rutas protegidas | `auth.middleware.js`·`requiereAutenticacion/requiereAdministrador` | `sesiones_operadores`, `operadores` | `auth.test.js` | `M-16_menu_y_clientes_operador.png` | Rutas admin para operador → 403 |
| HU-15 | Autenticación | Administrador | Como administrador quiero ejecutar las funciones del operador para cubrir su ausencia | RF-15 | Media | Muestra opciones de operación y administración; sin cambiar de usuario; los registros quedan a nombre del administrador | Implementada | `App.jsx` (menú completo) | Rutas de operación (`/api/movimientos/*`) | Rutas usan `req.user.id` | `movimientos`, `auditoria_eventos` | Inspección | `M-01_recorrido_secciones.png` | — |

## 3. Módulo: Gestión de usuarios del sistema

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-16 | Usuarios | Administrador | Como administrador quiero registrar operadores para que usen el sistema con sus credenciales | RF-16, RNF-09 | Alta | Exige nombres, apellidos, documento, correo y teléfono; documento único; asigna contraseña temporal; queda activo | Implementada | `Operadores.jsx` | `POST /api/operadores` | `operadores.service.js`·`crearOperador` | `operadores`, `auditoria_eventos` | `gestion.validation.test.js` | `M-04a_usuario_creado.png`, `M-17a_operador_con_temporal.png` | Documento duplicado → 409 |
| HU-17 | Usuarios | Administrador | Como administrador quiero consultar los usuarios para conocer su estado | RF-17 | Media | Busca por documento o nombre; muestra estado (activo, suspendido, bloqueado, desvinculado) | Implementada | `Operadores.jsx` | `GET /api/operadores?documento=&nombre=&estado=` | `operadores.service.js`·`listarOperadores` | `operadores` | Inspección | `M-04c_usuario_suspendido.png` | Filtros en SQL |
| HU-18 | Usuarios | Administrador | Como administrador quiero corregir los datos de un operador para solucionar errores de registro | RF-18 | Media | Modifica nombres, apellidos, documento, correo y teléfono; documento único; queda auditado | Implementada | `Operadores.jsx` | `PUT /api/operadores/:id` | `operadores.service.js`·`actualizarOperador` | `operadores`, `auditoria_eventos` | Inspección | — | Auditoría con valores anterior/nuevo |
| HU-19 | Usuarios | Administrador | Como administrador quiero suspender temporalmente a un operador para impedir su uso mientras está fuera de servicio | RF-19, RNF-08 | Alta | Exige motivo; no permite si tiene sesión activa; el suspendido no puede iniciar sesión; conserva historial | Implementada | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js`·`cambiarEstadoOperador` | `operadores`, `sesiones_operadores`, `auditoria_eventos` | Inspección | `M-04b_suspension_con_sesion_activa.png`, `M-04c_usuario_suspendido.png` | — |
| HU-20 | Usuarios | Administrador | Como administrador quiero desvincular a un operador para impedir su acceso conservando su historial | RF-20, RNF-08 | Media | Exige motivo; no si tiene sesión activa; baja lógica; historial consultable | Implementada | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js`·`cambiarEstadoOperador` | `operadores`, `auditoria_eventos` | Inspección | `M-04c_usuario_suspendido.png` | `estado=DESVINCULADO`, `activo=false` |
| HU-21 | Usuarios | Administrador | Como administrador quiero reactivar a un operador suspendido o desvinculado para que vuelva a trabajar | RF-21 | Media | Exige motivo; conserva registro e historial; si estaba desvinculado, asigna temporal | Implementada | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js`·`cambiarEstadoOperador` | `operadores`, `auditoria_eventos` | Inspección | `M-04d_usuario_reactivado.png` | — |

## 4. Módulo: Gestión de clientes y vehículos

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-22 | Clientes/Vehículos | Operador, Administrador | Como operador quiero consultar un cliente por documento para saber si ya está registrado antes de crearlo | RF-22 | Alta | Busca por documento; si existe muestra datos, vehículos y estado de mensualidad; si no, habilita el registro | Implementada | `Clientes.jsx` | `GET /api/clientes/consulta/:documento` | `clientes.service.js`·`obtenerClientePorDocumento` | `clientes`, `vehiculos`, `suscripciones` | Inspección | `M-05c_consulta_documento.png` | `encontrado:true/false` |
| HU-23 | Clientes/Vehículos | Operador, Administrador | Como operador quiero registrar un cliente con su vehículo en un solo paso para no perder la venta | RF-23, RNF-10, RNF-12 | Alta | Habilita solo si el documento no existe; exige datos de cliente y vehículo; tipo moto/automóvil/camioneta; registra autorización de datos; guarda todo o nada | Implementada | `Clientes.jsx` | `POST /api/clientes/registro`, `POST /api/clientes` | `clientes.service.js`·`registrarClienteConVehiculos` | `clientes`, `vehiculos`, `auditoria_eventos` | `integracion/ciclo.operativo.test.js`; `gestion.validation.test.js` | `M-05a_cliente_registrado.png`, `M-05b_documento_duplicado.png` | Ambas rutas comparten la operación atómica |
| HU-24 | Clientes/Vehículos | Operador, Administrador | Como operador quiero agregar un vehículo a un cliente existente para registrar vehículos adicionales | RF-24, RNF-09 | Media | Acción desde los datos del cliente; exige todos los datos del vehículo; si la placa es de otro cliente, rechaza e informa del cambio de titular | Implementada | `Vehiculos.jsx` | `POST /api/vehiculos` | `vehiculos.service.js`·`crearVehiculo` | `vehiculos`, `clientes` | Inspección | `M-06a_vehiculo_registrado.png`, `M-06b_placa_duplicada.png` | Placa duplicada → 409 |
| HU-25 | Clientes/Vehículos | Administrador | Como administrador quiero corregir los datos de un cliente para solucionar errores de registro | RF-25 | Media | Modifica los datos; documento único; opción deshabilitada para el operador; queda auditado | Implementada | `Clientes.jsx` | `PUT /api/clientes/:id` | `clientes.service.js`·`actualizarCliente` | `clientes`, `auditoria_eventos` | Inspección | `M-16_menu_y_clientes_operador.png` (botón deshabilitado) | Restringido a administrador |
| HU-26 | Clientes/Vehículos | Administrador | Como administrador quiero corregir los datos de un vehículo para solucionar errores como una placa mal digitada | RF-26 | Media | Modifica placa, tipo, color, marca y modelo; placa válida y única; no cambia tipo con movimiento activo; conserva movimientos | Implementada | `Vehiculos.jsx` | `PUT /api/vehiculos/:id` | `vehiculos.service.js`·`actualizarVehiculo` | `vehiculos`, `movimientos` | `vehiculos.tipos.test.js` | `M-06d_cambio_tipo_bloqueado.png` | Tipo con movimiento activo → 409 |
| HU-27 | Clientes/Vehículos | Administrador | Como administrador quiero asignar un vehículo a un nuevo titular para registrar la venta sin perder el historial | RF-27 | Media | Registra al nuevo titular; asocia el vehículo; conserva el historial del titular anterior | Implementada | `Vehiculos.jsx` | `POST /api/vehiculos/:id/cambiar-titular`, `GET /api/vehiculos/:id/titulares` | `vehiculos.service.js`·`cambiarTitular/historialTitulares` | `vehiculos`, `historial_titulares_vehiculo` | Inspección | `M-06c_cambio_titular.png` | Procedimiento administrativo |

## 5. Módulo: Gestión de mensualidades

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-28 | Mensualidades | Operador, Administrador | Como operador quiero registrar la mensualidad de un vehículo con fecha de activación para que pueda ingresar | RF-28 | Alta | Selecciona vehículo y fecha de activación (hoy o futura, no anterior); vencimiento = activación + 29 días; activa automáticamente; muestra estado; sin traslapes; no genera cobro | Implementada | `Suscripciones.jsx` | `POST /api/suscripciones` | `suscripciones.service.js`·`crearSuscripcion/sincronizarEstadosSuscripciones` | `suscripciones`, `auditoria_eventos` | `suscripciones.validation.test.js`; `integracion/ciclo.operativo.test.js` | `M-14a_suscripcion_creada.png`, `M-14b_solapamiento_rechazado.png`, `M-14d_estado_vencida.png` | Estados EA2 `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` |
| HU-29 | Mensualidades | Administrador | Como administrador quiero modificar la fecha de activación de una mensualidad para corregir errores | RF-29 | Media | Cambia la fecha de activación; recalcula el vencimiento; sin traslapes; la fecha/hora de registro no es modificable | Implementada | `Suscripciones.jsx` | `PATCH /api/suscripciones/:id/fecha-activacion` | `suscripciones.service.js`·`modificarFechaActivacion` | `suscripciones`, `auditoria_eventos` | Inspección | `M-14c_fecha_activacion_modificada.png` | — |

## 6. Módulo: Gestión de celdas

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-30 | Celdas | Administrador | Como administrador quiero crear celdas para ampliar la capacidad del parqueadero | RF-30, RNF-09 | Media | Solicita código, tipo (carro/moto) y ubicación; código único; queda disponible | Implementada | `Celdas.jsx` | `POST /api/celdas` | `celdas.service.js`·`crearCelda` | `celdas`, `historial_celdas` | Inspección | `M-13a_celda_creada.png` | Código duplicado → 409 |
| HU-31 | Celdas | Administrador | Como administrador quiero modificar código, tipo y ubicación para corregir o reorganizar | RF-31 | Media | Modifica solo si está disponible; si está ocupada la rechaza; código único; los movimientos conservan código y tipo usados | Implementada | `Celdas.jsx` | `PUT /api/celdas/:id` | `celdas.service.js`·`modificarCelda` | `celdas`, `historial_celdas`, `movimientos` | Inspección | `M-13b_celda_modificada.png` | Snapshot de celda en cada movimiento |
| HU-32 | Celdas | Administrador | Como administrador quiero bloquear una celda para sacarla de servicio | RF-32, RNF-08 | Media | Exige motivo y registra administrador, fecha y hora; solo disponibles; si está ocupada, rechaza e informa placa, cliente y usuario; no se asigna | Implementada | `Celdas.jsx` | `POST /api/celdas/:id/bloquear` | `celdas.service.js`·`cambiarBloqueoCelda` | `celdas`, `historial_celdas`, `movimientos` | Inspección | `M-13c_celda_bloqueada.png` | — |
| HU-33 | Celdas | Administrador | Como administrador quiero desbloquear una celda para volver a ponerla en servicio | RF-33 | Media | Desbloquea celdas bloqueadas; queda disponible; registra usuario, fecha y hora | Implementada | `Celdas.jsx` | `POST /api/celdas/:id/desbloquear` | `celdas.service.js`·`cambiarBloqueoCelda` | `celdas`, `historial_celdas` | Inspección | `M-13d_celda_desbloqueada.png` | — |
| HU-34 | Celdas | Administrador | Como administrador quiero consultar el historial de una celda para conocer su uso y cambios | RF-34 | Media | Muestra movimientos, bloqueos, desbloqueos y modificaciones; cada evento con usuario y fecha | Implementada | `Celdas.jsx` | `GET /api/celdas/:id/historial` | `celdas.service.js`·`historialCelda` | `historial_celdas`, `movimientos` | Inspección | `M-13e_historial_celda.png` | — |

## 7. Módulo: Corrección de movimientos y auditoría

| ID | Módulo | Rol | Historia | RF/RNF | Prioridad | Criterios | Estado | Componente | Endpoint | Servicio | Tablas | Prueba | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HU-35 | Movimientos/Auditoría | Administrador | Como administrador quiero anular un movimiento registrado por error para corregir el control sin perder el historial | RF-35, RNF-08 | Alta | Exige motivo y registra usuario, fecha y hora; anulación lógica; libera la celda si la entrada estaba abierta; consultable como Anulado | Implementada | `MovimientosAdmin.jsx` | `POST /api/movimientos-admin/:id/anular` | `movimientos.admin.service.js`·`anularMovimiento` | `movimientos`, `celdas`, `auditoria_eventos` | Inspección | `M-12b_movimiento_anulado.png` | Motivo obligatorio |
| HU-36 | Movimientos/Auditoría | Administrador | Como administrador quiero corregir observaciones, accesos y celda de un movimiento para solucionar errores de diligenciamiento | RF-36 | Media | Exige motivo; cambia celda solo en activos y hacia una disponible compatible; no modifica fecha, hora, usuario ni vehículo; si hay error en esos datos, indica anular | Implementada | `MovimientosAdmin.jsx` | `PATCH /api/movimientos-admin/:id/corregir` | `movimientos.admin.service.js`·`modificarMovimiento` | `movimientos`, `celdas`, `auditoria_eventos` | Inspección | `M-12a_movimiento_corregido.png` | — |
| HU-37 | Movimientos/Auditoría | Administrador | Como administrador quiero que el sistema registre cada operación relevante para conocer quién hizo qué y cuándo | RF-37, RNF-07 | Alta | Registra usuario, fecha/hora (servidor) y acción; en modificaciones guarda anterior y nuevo; incluye inicios de sesión exitosos y fallidos; no modificable ni eliminable | Implementada | Transversal | Todas las operaciones | `auditoria.service.js`·`registrarAuditoria` | `auditoria_eventos`, `auditoria_autenticacion` | `integracion/ciclo.operativo.test.js` (RNF-07) | `M-11_auditoria_movimientos.png` | Triggers append-only (migración 009) |
| HU-38 | Movimientos/Auditoría | Administrador | Como administrador quiero consultar el registro de auditoría para revisar las acciones del sistema | RF-38 | Media | Filtra por usuario, fecha y tipo de acción; muestra valores anterior y nuevo de las modificaciones | Implementada | `Auditoria.jsx` | `GET /api/auditoria?usuario=&desde=&hasta=&accion=&entidad=&tipo=` | `auditoria.service.js`·`consultarAuditoria` | `auditoria_eventos`, `auditoria_autenticacion` | Inspección | `M-11_auditoria_movimientos.png` | Consulta unificada de ambas tablas |

---

## 8. Matriz de trazabilidad EA2 → HU → RF/RNF → componente → endpoint → servicio → tabla → prueba → evidencia

| RF/RNF | HU | Componente | Endpoint | Servicio | Tabla(s) | Prueba | Evidencia |
|---|---|---|---|---|---|---|---|
| RF-01 | HU-01 | `App.jsx` (Ingreso) | `POST /api/movimientos/entrada` | `movimientos.service.js` | `movimientos`, `celdas` | `integracion/ciclo.operativo.test.js` | `M-08a`, `M-08b` |
| RF-02 | HU-02 | `App.jsx` (Ingreso) | `POST /api/movimientos/entrada` | `movimientos.service.js` | `movimientos`, `vehiculos`, `suscripciones` | `integracion/ciclo.operativo.test.js` | `M-07` |
| RF-03 | HU-03 | `App.jsx` (Ingreso) | `GET /api/movimientos/vehiculo/:placa` | `movimientos.routes.js` | `movimientos`, `vehiculos`, `celdas` | Inspección | — |
| RF-04 | HU-04 | `App.jsx` (Salida) | `POST /api/movimientos/salida` | `movimientos.service.js` | `movimientos`, `celdas` | `integracion/ciclo.operativo.test.js` | `M-09a` |
| RF-05 | HU-05 | `App.jsx` (Salida) | `POST /api/movimientos/salida` | `movimientos.service.js` | `movimientos` | `integracion/ciclo.operativo.test.js` | `M-09b` |
| RF-06 | HU-06 | `App.jsx` (Panel), `Celdas.jsx` | `GET /api/celdas`, `/disponibles`, `/resumen` | `celdas.service.js` | `celdas`, `movimientos` | Inspección | `M-15`, `M-13a` |
| RF-07 | HU-07 | `App.jsx` (Historial) | `GET /api/movimientos` | `movimientos.service.js` | `movimientos` | `movimientos.filtros.test.js` | `M-10` |
| RF-08, RNF-05 | HU-08 | `App.jsx` (Login) | `POST /api/auth/login` | `auth.service.js` | `operadores`, `sesiones_operadores`, `auditoria_autenticacion` | `auth.test.js` | `M-02a`, `M-02b` |
| RF-09 | HU-09 | `App.jsx` (perfil) | `POST /api/auth/logout` | `auth.service.js` | `sesiones_operadores` | Inspección | `M-01`, `M-16` |
| RF-10, RNF-04 | HU-10 | `Cuenta.jsx` | `POST /api/auth/cambiar-password` | `auth.service.js` | `operadores` | `password.politica.test.js` | `M-17c`, `M-17d` |
| RF-11 | HU-11 | `App.jsx` (Login) | `POST /api/auth/login` | `auth.service.js` | `operadores`, `auditoria_autenticacion` | Inspección | `M-03` |
| RF-12 | HU-12 | `Recuperacion.jsx` | `POST /api/auth/recuperacion(/restablecer)` | `auth.service.js`, `correo.service.js` | `recuperacion_password` | Inspección | `M-18a…M-18d` |
| RF-13 | HU-13 | `Operadores.jsx` | `POST /api/operadores/:id/desbloquear` | `operadores.service.js` | `operadores` | Inspección | `M-17b` |
| RF-14, RNF-06, RNF-11 | HU-14 | `App.jsx` | Todas las rutas | `auth.middleware.js` | `sesiones_operadores` | `auth.test.js` | `M-16` |
| RF-15 | HU-15 | `App.jsx` | Rutas de operación | `req.user.id` | `movimientos`, `auditoria_eventos` | Inspección | `M-01` |
| RF-16, RNF-09 | HU-16 | `Operadores.jsx` | `POST /api/operadores` | `operadores.service.js` | `operadores` | `gestion.validation.test.js` | `M-04a`, `M-17a` |
| RF-17 | HU-17 | `Operadores.jsx` | `GET /api/operadores` | `operadores.service.js` | `operadores` | Inspección | `M-04c` |
| RF-18 | HU-18 | `Operadores.jsx` | `PUT /api/operadores/:id` | `operadores.service.js` | `operadores` | Inspección | — |
| RF-19, RNF-08 | HU-19 | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js` | `operadores`, `sesiones_operadores` | Inspección | `M-04b`, `M-04c` |
| RF-20, RNF-08 | HU-20 | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js` | `operadores` | Inspección | `M-04c` |
| RF-21 | HU-21 | `Operadores.jsx` | `PATCH /api/operadores/:id/estado` | `operadores.service.js` | `operadores` | Inspección | `M-04d` |
| RF-22 | HU-22 | `Clientes.jsx` | `GET /api/clientes/consulta/:documento` | `clientes.service.js` | `clientes`, `vehiculos`, `suscripciones` | Inspección | `M-05c` |
| RF-23, RNF-10, RNF-12 | HU-23 | `Clientes.jsx` | `POST /api/clientes(/registro)` | `clientes.service.js` | `clientes`, `vehiculos` | `integracion/ciclo.operativo.test.js` | `M-05a`, `M-05b` |
| RF-24, RNF-09 | HU-24 | `Vehiculos.jsx` | `POST /api/vehiculos` | `vehiculos.service.js` | `vehiculos`, `clientes` | Inspección | `M-06a`, `M-06b` |
| RF-25 | HU-25 | `Clientes.jsx` | `PUT /api/clientes/:id` | `clientes.service.js` | `clientes` | Inspección | `M-16` |
| RF-26 | HU-26 | `Vehiculos.jsx` | `PUT /api/vehiculos/:id` | `vehiculos.service.js` | `vehiculos`, `movimientos` | `vehiculos.tipos.test.js` | `M-06d` |
| RF-27 | HU-27 | `Vehiculos.jsx` | `POST /api/vehiculos/:id/cambiar-titular` | `vehiculos.service.js` | `vehiculos`, `historial_titulares_vehiculo` | Inspección | `M-06c` |
| RF-28 | HU-28 | `Suscripciones.jsx` | `POST /api/suscripciones` | `suscripciones.service.js` | `suscripciones` | `suscripciones.validation.test.js` | `M-14a`, `M-14b`, `M-14d` |
| RF-29 | HU-29 | `Suscripciones.jsx` | `PATCH /api/suscripciones/:id/fecha-activacion` | `suscripciones.service.js` | `suscripciones` | Inspección | `M-14c` |
| RF-30, RNF-09 | HU-30 | `Celdas.jsx` | `POST /api/celdas` | `celdas.service.js` | `celdas`, `historial_celdas` | Inspección | `M-13a` |
| RF-31 | HU-31 | `Celdas.jsx` | `PUT /api/celdas/:id` | `celdas.service.js` | `celdas`, `historial_celdas` | Inspección | `M-13b` |
| RF-32, RNF-08 | HU-32 | `Celdas.jsx` | `POST /api/celdas/:id/bloquear` | `celdas.service.js` | `celdas`, `historial_celdas` | Inspección | `M-13c` |
| RF-33 | HU-33 | `Celdas.jsx` | `POST /api/celdas/:id/desbloquear` | `celdas.service.js` | `celdas`, `historial_celdas` | Inspección | `M-13d` |
| RF-34 | HU-34 | `Celdas.jsx` | `GET /api/celdas/:id/historial` | `celdas.service.js` | `historial_celdas`, `movimientos` | Inspección | `M-13e` |
| RF-35, RNF-08 | HU-35 | `MovimientosAdmin.jsx` | `POST /api/movimientos-admin/:id/anular` | `movimientos.admin.service.js` | `movimientos`, `celdas`, `auditoria_eventos` | Inspección | `M-12b` |
| RF-36 | HU-36 | `MovimientosAdmin.jsx` | `PATCH /api/movimientos-admin/:id/corregir` | `movimientos.admin.service.js` | `movimientos`, `celdas`, `auditoria_eventos` | Inspección | `M-12a` |
| RF-37, RNF-07 | HU-37 | Transversal | Todas las operaciones | `auditoria.service.js` | `auditoria_eventos`, `auditoria_autenticacion` | `integracion/ciclo.operativo.test.js` | `M-11` |
| RF-38 | HU-38 | `Auditoria.jsx` | `GET /api/auditoria` | `auditoria.service.js` | `auditoria_eventos`, `auditoria_autenticacion` | Inspección | `M-11` |

> Los requisitos no funcionales RNF-01 a RNF-13 se detallan en
> [`02_Matriz_Requisitos.md`](02_Matriz_Requisitos.md); las pruebas y condiciones de ejecución, en
> [`09_Matriz_Pruebas.md`](09_Matriz_Pruebas.md) y [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md).
