# Auditoría final de cumplimiento EA2 — AutosColombia

- **Fecha:** 2026-11-13
- **Fuente académica:** `C:\Users\ADMINISTRADOR\Downloads\Grupo03_Iteracion_2_EA2.docx`
- **Repositorio auditado:** `C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia`
- **Rama:** `Iteracion_2`
**Alcance:** revisión técnica, funcional, documental, de pruebas y de base de datos. No se modificaron código, configuración, migraciones ni datos de la base real. Este informe es un nuevo soporte de auditoría y no reemplaza ni sobrescribe documentos académicos existentes.

> Esta auditoría describe la línea base previa a las correcciones. Su verificación de hallazgos H-01…H-10 se actualiza en [`16_Informe_Final_Correcciones_EA2.md`](16_Informe_Final_Correcciones_EA2.md) y, para el dictamen definitivo, en [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md): última ejecución de 52 pruebas automatizadas, arnés E2E M-01…M-18 (33/33), benchmark RNF-03 y conciliación de la mensualidad ID 1.

## 1. Resumen ejecutivo

El sistema presenta una implementación amplia de la Iteración 2 y las validaciones técnicas actuales pasan. Sin embargo, **no se recomienda publicarlo como entrega académica definitiva todavía**: hay criterios obligatorios incompletos o que se pueden eludir por API, la base real contiene una mensualidad vigente con duración distinta a 30 días, no se demuestra que la auditoría sea inmutable y existen diferencias sustanciales entre EA2, documentación y evidencias.

| Alcance | Cumple | Parcial | No verificable | Cumplimiento pleno |
|---|---:|---:|---:|---:|
| RF-01 a RF-38 | 32 | 6 | 0 | 32/38 = **84,2 %** |
| RNF-01 a RNF-13 | 8 | 4 | 1 | 8/13 = **61,5 %** |
| Total de requisitos | 40 | 10 | 1 | 40/51 = **78,4 %** |

El porcentaje cuenta únicamente requisitos que cumplen completamente; los parciales no se ponderan como medio cumplimiento. Los estados y su fundamento aparecen en las matrices siguientes. Los resultados de pruebas manuales M-01 a M-18 se presentan como **declarados en la documentación**, no como reejecutados en esta auditoría.

**Validaciones reejecutadas en esta auditoría:** `npm test`: 42 aprobadas, 0 fallidas, 0 omitidas; `npm run build`: exitoso, 29 módulos; `npm run lint`: 0 errores y 14 advertencias. Las 12 pruebas de integración de `npm test` usan una base temporal aislada. MySQL real se examinó exclusivamente mediante consultas de lectura, en transacción `READ ONLY` con `ROLLBACK`.

## 2. Ubicación y control de versiones

- Ruta física y raíz Git: `C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia`.
- Rama local: `Iteracion_2`, que corresponde a la rama de trabajo esperada.
- Remoto `origin`: `https://github.com/JaimePuerto/AutosColombia.git`.
- Último commit local: `1ffb4f2 Implementa autenticacion y gestion de operadores - Iteracion 2`.
- Sincronización: **no sincronizada con una rama remota publicada**. El upstream local es `origin/desarrollo-autoscolombia [gone]`; `git ls-remote --heads origin` solo encontró `Iteracion_1` y `main`, no `Iteracion_2`.
- Estado observado: **57 entradas locales**: 27 modificadas, 1 eliminada y 29 nuevas/no rastreadas; 0 archivos staged. Incluyen trabajo previo de Iteración 2, documentación y funcionalidades. No se descartó ni preparó ningún cambio.
- `backend/.env` no está rastreado; `backend/.env.example` sí. No se incluyeron credenciales en este informe.
- En `Documents\Proyectos\Pendiente ordenar` hay cinco carpetas relacionadas con entregas y respaldos; ninguna tiene `.git`. No son repositorios alternativos. La carpeta auditada es la única raíz Git confirmada.
- No se cambió de rama ni se hizo `add`, commit, push o merge.

## 3. Matriz de requisitos funcionales

“Cumple” significa que la lógica y los controles inspeccionados corresponden al requisito. “Parcial” indica una limitación concreta. Las pruebas M citadas son las documentadas en los entregables; su ejecución no se repitió en esta auditoría.

| ID | Requisito EA2 | Estado | Evidencia técnica | Prueba y observación |
|---|---|---|---|---|
| RF-01 | Registrar entrada, datos de operación y celda automática compatible; camioneta usa celda CARRO | Cumple | `backend/src/services/movimientos.service.js` `registrarEntrada`; `validators/placas.js` | T-32/T-40 aprobadas ahora; M-08 declarada |
| RF-02 | Validar vehículo registrado, mensualidad vigente, no duplicidad y celda libre; no crear placa desconocida | Cumple | `movimientos.service.js` `registrarEntrada`; `POST /api/movimientos/entrada` | T-33/T-34/T-37 ahora; M-07 declarada |
| RF-03 | Consultar entrada activa por placa | Cumple | `backend/src/routes/movimientos.routes.js`, consulta `/vehiculo/:placa` | Inspección; no se reejecutó prueba de interfaz específica |
| RF-04 | Registrar salida ligada a entrada activa, con operador, fecha y acceso | Cumple | `movimientos.service.js` `registrarSalida` | T-35 ahora; M-09 declarada |
| RF-05 | Rechazar salida sin entrada activa y evitar duplicados | Cumple | `movimientos.service.js` `registrarSalida` | T-36 ahora; M-09 declarada |
| RF-06 | Mostrar estado, totales por tipo y disponibilidad de celdas | Cumple | `backend/src/services/celdas.service.js`; dashboard | M-13/M-15 declaradas; la base revisada tiene datos referenciales íntegros |
| RF-07 | Historial filtrable por estado y placa, descendente | Cumple | `movimientos.service.js` `listarMovimientos`; `GET /api/movimientos` | 7 pruebas de filtros aprobadas ahora; M-10 declarada |
| RF-08 | Autenticar credenciales y rechazar cuentas no habilitadas | Cumple | `backend/src/services/auth.service.js` `iniciarSesion` | 4 pruebas de autenticación aprobadas ahora; M-02 declarada |
| RF-09 | Cierre manual y expiración por 90 minutos de inactividad | Cumple | `auth.service.js`; sesiones en `sesiones_operadores` | Inspección de lógica; cobertura automatizada específica de expiración no identificada |
| RF-10 | Cambio de contraseña, política y obligatoriedad para temporal | Cumple | `auth.service.js`; `middleware/auth.middleware.js`; `frontend/src/components/Cuenta.jsx` | M-17 declarada; pruebas de política aprobadas ahora |
| RF-11 | Bloqueo tras cinco fallos y auditoría de intentos | Cumple | `auth.service.js`; `auditoria_autenticacion` | M-03 declarada; la prueba de cinco intentos no se reejecutó aquí |
| RF-12 | Recuperar contraseña mediante enlace de un solo uso enviado al correo | Parcial | `auth.service.js`; `correo.service.js`; tabla `recuperacion_password` | M-18 declara flujo con `MAIL_PROVIDER=consola`; **no se probó envío real** por proveedor externo |
| RF-13 | Desbloqueo administrativo con contraseña temporal y cambio obligatorio | Cumple | `operadores.service.js` `desbloquearCuenta`; rutas de operadores | M-17 declarada |
| RF-14 | Aplicar permisos en backend, además de ocultar funciones en UI | Cumple | `backend/src/middleware/auth.middleware.js`; rutas por rol | M-16 declarada; las pruebas de rol del backend pasaron |
| RF-15 | Administrador ejecuta operaciones bajo su sesión e identidad | Cumple | Rutas/servicios usan `req.user.id`; auditoría recibe el actor autenticado | Inspección; no se identificó prueba dedicada |
| RF-16 | Alta de operador con nombres, apellidos, documento, email y teléfono obligatorios | Parcial | `operadores.service.js` `crearOperador`; `Operadores.jsx` | El servicio solo exige nombre y documento; los demás campos pueden quedar vacíos aun llamando directamente al API. M-04 no acredita el rechazo de esos casos |
| RF-17 | Buscar operadores por documento/nombre y mostrar estado | Cumple | `operadores.service.js` `listarOperadores` filtra en SQL | Inspección; M-04 declara ciclo de operador, no prueba cada filtro |
| RF-18 | Modificar datos de operador, conservar unicidad y auditar | Cumple | `operadores.service.js` `actualizarOperador`; ruta admin | Inspección; M-04 documentada no cubre una edición específica |
| RF-19 | Suspender con motivo, impedir si hay sesión activa y conservar historial | Cumple | `operadores.service.js` `cambiarEstadoOperador` | M-04 declarada; no reejecutada |
| RF-20 | Desvincular con motivo, baja lógica e historial preservado | Cumple | `operadores.service.js` `cambiarEstadoOperador` | Inspección; la tabla M-04 documenta suspensión/reactivación, no identifica desvinculación |
| RF-21 | Reactivar conservando identidad/historial y emitir temporal cuando corresponda | Cumple | `operadores.service.js` `cambiarEstadoOperador` | M-04 declarada; no reejecutada |
| RF-22 | Consultar cliente por documento, vehículos y estado de mensualidades | Cumple | `clientes.service.js` `obtenerClientePorDocumento` | M-05 declarada |
| RF-23 | Alta atómica de cliente + vehículo(s), campos requeridos y autorización | Parcial | `clientes.service.js` `registrarClienteConVehiculos`; `POST /api/clientes/registro` | Transacción y rollback cubiertos por T-42 ahora. No valida como obligatorios email/teléfono del cliente ni marca/modelo/color del vehículo. Además, `POST /api/clientes` expone `crearCliente` que permite alta sin vehículo y sin autorización |
| RF-24 | Agregar vehículo a cliente existente con datos requeridos y mensaje de cambio de titular | Parcial | `vehiculos.service.js` `insertarVehiculo`; `POST /api/vehiculos` | Placa/tipo/cliente validados; marca/modelo/color son opcionales en servicio y BD. M-06 declarada |
| RF-25 | Modificar cliente como administrador, con documento único y auditoría | Cumple | `clientes.service.js` `actualizarCliente`; `PUT /api/clientes/:id` admin-only | Inspección; M-05 documenta consulta/alta, no modificación |
| RF-26 | Modificar vehículo, placa válida/única, bloquear cambio de tipo con movimiento activo | Cumple | `vehiculos.service.js` `actualizarVehiculo` | Pruebas de tipos aprobadas ahora; M-06 declarada |
| RF-27 | Cambio de titular con historial y motivo | Cumple | `vehiculos.service.js` `cambiarTitular`; `historial_titulares_vehiculo` | M-06 declarada |
| RF-28 | Mensualidad de 30 días, estados automáticos, sin traslapes ni cobros | Parcial | `suscripciones.service.js`; migración `006`; `suscripciones.estado` | Validador de 30 días/traslapes probado ahora; en la base real hay **1 fila VIGENTE de 2 con duración distinta de 30 días**. MySQL no impone exactamente 30 días |
| RF-29 | Modificar fecha de activación, recalcular fin, evitar traslape y auditar | Cumple | `suscripciones.service.js` `modificarFechaActivacion` | M-14 declarada; no reejecutada |
| RF-30 | Crear celda con código único, tipo y ubicación | Cumple | `celdas.service.js` `crearCelda`; índice único `celdas.codigo` | M-13 declarada |
| RF-31 | Modificar celda disponible y conservar snapshot histórico | Cumple | `celdas.service.js`; snapshots en `movimientos` | T-32/T-40 ahora; M-13 declarada |
| RF-32 | Bloquear disponible con motivo; rechazar ocupada informando contexto | Cumple | `celdas.service.js` `cambiarBloqueoCelda` | Inspección; M-13 declara bloqueo, no identifica un intento sobre celda ocupada |
| RF-33 | Desbloquear celda bloqueada y registrar actor/fecha | Cumple | `celdas.service.js` `cambiarBloqueoCelda`; `historial_celdas` | M-13 declarada |
| RF-34 | Consultar historial de movimientos y cambios de celda | Cumple | `celdas.service.js` `historialCelda` integra movimientos e historial administrativo | Inspección; M-13 declara consulta |
| RF-35 | Anular lógicamente con motivo, auditoría y liberación de celda | Cumple | `movimientos.admin.service.js` `anularMovimiento` | T-39 ahora; M-12 declarada |
| RF-36 | Corregir solo campos permitidos, en movimiento activo, con motivo | Cumple | `movimientos.admin.service.js` `modificarMovimiento` | M-12 declarada; no se reejecutó la interfaz |
| RF-37 | Auditar operaciones/login, actor, hora y valores anterior/nuevo; impedir edición/borrado | Parcial | `auditoria.service.js`; `auditoria_eventos`, `auditoria_autenticacion` | Inserciones y consultas existen; no hay triggers de protección en MySQL ni evidencia de permisos DB de solo inserción. La inmutabilidad exigida no está garantizada a nivel de almacenamiento |
| RF-38 | Consultar auditoría filtrando usuario, fecha y acción | Cumple | `auditoria.service.js` `consultarAuditoria`; rutas/UI de auditoría | M-11 declara filtro por entidad; no demuestra todos los filtros requeridos |

## 4. Matriz de requisitos no funcionales

| ID | Estado | Evidencia / diferencia |
|---|---|---|
| RNF-01 Usabilidad y mensajes | Parcial | La interfaz contiene formularios, mensajes y modales; inspección estática no valida usabilidad con usuarios. Las evidencias manuales tienen capturas repetidas |
| RNF-02 Integridad de entrada/salida | Cumple | Validación transaccional de entrada/salida, índices de movimientos activos y T-32 a T-36 aprobadas ahora |
| RNF-03 Consultas en máximo 3 s | No verificable | El valor de 35,7 ms que cita el cierre corresponde a `GET /api/health`, no a una consulta representativa con volumen, carga y condiciones EA2 documentadas. No se ejecutó prueba de carga |
| RNF-04 Hash y política de contraseñas | Cumple | Hash `scrypt`; mínimo 10, letra+número, sin espacios; pruebas de política aprobadas ahora |
| RNF-05 Sesión de 90 min y bloqueo a cinco intentos | Cumple | Lógica inspeccionada en `auth.service.js`; bloqueo registra evento. Sin nueva prueba de navegador en esta auditoría |
| RNF-06 Autorización backend 401/403 | Cumple | Middleware por sesión/rol; pruebas de roles y M-16 documentada |
| RNF-07 Auditoría no modificable ni eliminable | Parcial | El backend inserta y expone consulta; base real sin triggers. No se verificó una cuenta MySQL restringida a append-only |
| RNF-08 Históricos y bajas lógicas | Cumple | Estados lógicos y relaciones de historial; no se observó borrado funcional de históricos |
| RNF-09 Unicidad, movimientos activos y administrador | Parcial | Unicidad de placa/documentos/celda e índices para movimiento activo. La base no impone intervalo exacto de mensualidad ni “último administrador”; esta última protección es de servicio. La consulta actual halló un período vigente no conforme |
| RNF-10 Atomicidad de operaciones compuestas | Cumple | Transacciones y rollback en entrada/salida, cliente+vehículos, titulares y otras operaciones; T-32/T-35/T-42 pasaron |
| RNF-11 Diferenciación de perfiles | Cumple | Rutas con middleware de administrador y menú filtrado; M-16 documentada |
| RNF-12 Datos personales y autorización | Parcial | Se guardan consentimiento y fecha en alta transaccional; existe ruta alterna de alta de cliente sin consentimiento/vehículo y no se evidenció el ciclo documental completo de privacidad |
| RNF-13 Arquitectura modular y contrato API | Cumple | Capas `routes/`, `services/`, respuestas HTTP y build actual correcto |

## 5. Matriz de historias de usuario EA2

EA2 contiene HU-01 a HU-38. `Documentacion/03_Historias_Usuario.md` solo desarrolla HU-01 a HU-10; el resumen de asociaciones HU/RF de ese documento no coincide con EA2. Esta matriz restituye la relación original uno a uno y hereda el estado de su RF asociado.

| HU | Relación | Historia EA2 (resumen) | Estado |
|---|---|---|---|
| HU-01 | RF-01 | Registrar entrada y asignar celda automática | Cumple |
| HU-02 | RF-02 | Validar condiciones de ingreso | Cumple |
| HU-03 | RF-03 | Consultar entrada por placa | Cumple |
| HU-04 | RF-04 | Registrar salida asociada a entrada | Cumple |
| HU-05 | RF-05 | Validar entrada activa antes de salida | Cumple |
| HU-06 | RF-06 | Consultar estado y disponibilidad de celdas | Cumple |
| HU-07 | RF-07 | Filtrar y buscar movimientos | Cumple |
| HU-08 | RF-08 | Iniciar sesión con perfil autorizado | Cumple |
| HU-09 | RF-09 | Cerrar sesión manual/por inactividad | Cumple |
| HU-10 | RF-10 | Cambiar contraseña | Cumple |
| HU-11 | RF-11 | Bloquear por intentos fallidos | Cumple |
| HU-12 | RF-12 | Recuperar contraseña por correo | Parcial |
| HU-13 | RF-13 | Desbloquear usuario con contraseña temporal | Cumple |
| HU-14 | RF-14 | Controlar funciones por perfil en backend | Cumple |
| HU-15 | RF-15 | Administrador ejecuta operación bajo su sesión | Cumple |
| HU-16 | RF-16 | Crear operador con datos obligatorios | Parcial |
| HU-17 | RF-17 | Consultar/buscar operadores y estados | Cumple |
| HU-18 | RF-18 | Modificar datos del operador | Cumple |
| HU-19 | RF-19 | Suspender con motivo y controlar sesión activa | Cumple |
| HU-20 | RF-20 | Desvincular conservando historial | Cumple |
| HU-21 | RF-21 | Reactivar conservando identidad e historial | Cumple |
| HU-22 | RF-22 | Consultar cliente por documento y mensualidades | Cumple |
| HU-23 | RF-23 | Registrar cliente y vehículo en un paso | Parcial |
| HU-24 | RF-24 | Agregar vehículo a cliente | Parcial |
| HU-25 | RF-25 | Modificar cliente como administrador | Cumple |
| HU-26 | RF-26 | Modificar vehículo preservando reglas | Cumple |
| HU-27 | RF-27 | Cambiar titular conservando historial | Cumple |
| HU-28 | RF-28 | Registrar mensualidad de 30 días | Parcial |
| HU-29 | RF-29 | Modificar fecha de activación | Cumple |
| HU-30 | RF-30 | Crear celdas | Cumple |
| HU-31 | RF-31 | Modificar celda disponible y preservar snapshot | Cumple |
| HU-32 | RF-32 | Bloquear celda con motivo y contexto | Cumple |
| HU-33 | RF-33 | Desbloquear celda | Cumple |
| HU-34 | RF-34 | Consultar historial de celda | Cumple |
| HU-35 | RF-35 | Anular movimiento sin borrar historial | Cumple |
| HU-36 | RF-36 | Corregir campos permitidos de movimiento | Cumple |
| HU-37 | RF-37 | Registrar auditoría completa e inmutable | Parcial |
| HU-38 | RF-38 | Consultar auditoría con filtros | Cumple |

## 6. Auditoría de interfaz

### Mi cuenta

El acceso está en el menú desplegable del perfil de cabecera, no en el sidebar. Abre `Modal` y carga `frontend/src/components/Cuenta.jsx`. El formulario llama `POST /api/auth/cambiar-password`, solicita contraseña actual cuando aplica, valida nueva/confirmación, cumple política de contraseña y soporta cambio obligatorio temporal. La protección de rutas impide continuar con contraseña temporal.

**Resultado:** cambio de contraseña conectado al backend y funcional por inspección; M-17 lo declara verificado. El panel muestra nombre y rol, pero no un conjunto más amplio de datos básicos del usuario. No se reejecutó navegador en esta auditoría.

### Historial, anular y corregir

`App.jsx` conserva el registro de origen de cada fila y presenta botones “Anular”/“Corregir” a administradores. La operación abre `MovimientosAdmin.jsx` en modal. El backend mantiene autorización de administrador, exige motivo, anula lógicamente y restringe la corrección a movimientos activos y campos permitidos. T-39 prueba anulación en base aislada; M-12 declara la secuencia de interfaz, no reejecutada aquí.

El formato visual puede representar una operación como filas de entrada y salida con el mismo registro de origen. En ese caso, las acciones de administración pueden repetirse para el mismo ID en más de una fila. Se recomienda validar si esa duplicación es intencional antes de dar por cerrada la presentación, sin cambiarla dentro de esta auditoría.

## 7. Auditoría de base de datos MySQL

**Identidad observada:** `autoscolombia`, MySQL 8.4.13; todas las tablas observadas usan InnoDB. La conexión se leyó de la configuración del backend sin mostrar credenciales. Se ejecutaron consultas `SELECT` y metadatos dentro de `START TRANSACTION READ ONLY`, finalizadas con `ROLLBACK`; no se aplicaron DDL/DML ni migraciones.

### Inventario y relaciones

La instalación canónica de siete scripts crea 12 tablas. La base real tiene 14:

`operadores`, `sesiones_operadores`, `auditoria_autenticacion`, `recuperacion_password`, `clientes`, `vehiculos`, `historial_titulares_vehiculo`, `celdas`, `historial_celdas`, `movimientos`, `suscripciones`, `auditoria_eventos`, `auditoria_eventos_backup_dep_20261113`, `auditoria_rectificaciones_texto`.

Relaciones principales: clientes→vehículos; vehículos→movimientos/suscripciones/historial de titulares; celdas→movimientos/historial; operadores→sesiones, movimientos, historiales y auditorías. Las claves foráneas de históricos y auditoría usan `RESTRICT`; el esquema protege referencias de borrados accidentales, pero esto no sustituye una política append-only.

### Restricciones y resultado de comprobaciones

- UNIQUE presente para documentos de cliente, documento/email de operador, placa, código de celda, hash de sesión/token y claves generadas de vehículo/celda con movimiento activo.
- Índices únicos generados en `movimientos.vehiculo_activo` y `movimientos.celda_activa` impiden duplicidad de movimientos activos por vehículo/celda.
- CHECK observados: fechas de movimiento, fechas/valor de suscripción y rango de año de vehículo. No hay CHECK de duración exacta de mensualidad ni restricción de “al menos un administrador activo”.
- La base observada tiene exactamente 1 administrador activo; 0 grupos duplicados de placa/documentos/código de celda; 0 pares de períodos no cancelados traslapados; 0 vehículos sin cliente y 0 referencias huérfanas de movimiento a vehículo/celda/operador de entrada.
- La tabla `suscripciones` contiene 2 filas `VIGENTE`; **1 de ellas no tiene 30 días calendario**. Es una inconsistencia de datos observada, no se identificó ni modificó la fila individual.
- `operadores.documento` y `vehiculos.cliente_id` permiten `NULL` en el esquema real aunque el servicio normalmente valida esos datos. El índice UNIQUE de MySQL permite múltiples `NULL`.
- `clientes.telefono/correo`, `vehiculos.marca/modelo/color` y campos de operadores son anulables; algunos criterios EA2 los declaran obligatorios.
- No se observaron triggers en la base. Por ello la inmutabilidad de auditoría no queda impuesta por el motor.
- Las tablas `_backup_dep_20261113` y `auditoria_rectificaciones_texto` son auxiliares, no creadas por el orden base. El diccionario/modelo existentes las identifican como respaldos/bitácora; no se inspeccionaron contenidos personales.

## 8. Auditoría de migrations

| Script | Cambio principal | Idempotencia/dependencia |
|---|---|---|
| `schema.sql` | Crea tablas operativas base y siembra 80 celdas | Instalación limpia, una vez; crea base y fija `USE autoscolombia` |
| `002_autenticacion_operadores.sql` | Columnas de autenticación, sesiones y auditoría de autenticación | No idempotente; ejecutar una sola vez después del esquema |
| `003_gestion_celdas_auditoria.sql` | Clientes, vínculo cliente-vehículo, historial y auditoría | Guardas aditivas; elimina/crea/elimina un procedimiento temporal (`DROP PROCEDURE`), no tablas ni datos |
| `004_iteracion2_auditoria_movimientos.sql` | Campos de anulación/snapshot e índices, crea estructuras faltantes | Guardas por metadatos; idempotente según código y validación documentada |
| `005_cierre_iteracion2_seguridad.sql` | Campos de operador, recuperación, titulares y suscripción; amplía auditoría | Guardas para columnas/índices y `CREATE IF NOT EXISTS` |
| `006_estados_suscripcion_ea2.sql` | Traduce estados antiguos a `PROGRAMADA/VIGENTE/VENCIDA/CANCELADA` | Migración de datos repetible por sus asignaciones; depende de `suscripciones` |
| `007_tipo_vehiculo_camioneta.sql` | Añade `CAMIONETA` al ENUM de vehículo | Modificación condicional por metadatos |

El orden documentado `schema.sql`→`002`→`003`→`004`→`005`→`006`→`007` está corroborado por la prueba T-31 en base desechable. Los scripts fijan `USE autoscolombia`; para otra base se necesita reescribir ese nombre, como hace la integración. No hay tabla de control de versiones de migraciones: para actualizar una instalación parcial hay que conocer manualmente qué scripts ya se aplicaron. No se debe reejecutar `002` a ciegas.

- **Instalación nueva:** crear la base con `utf8mb4`, ejecutar los siete pasos en ese orden y verificar tablas, ENUM y datos iniciales.
- **Actualización:** respaldo primero; comprobar esquema real; aplicar únicamente scripts pendientes, con atención especial a `002` no idempotente; validar después y conservar logs.
- **Restauración:** restaurar el respaldo en una base aislada, comprobar versión/esquema y datos, y aplicar solo migraciones posteriores conocidas. La documentación actual no brinda un procedimiento reproducible de restauración extremo a extremo.

La documentación indica que la instalación limpia fue probada. En esta auditoría no se ejecutó migración en la base real ni se repitió una instalación aparte de la integración actual.

## 9. Plan de pruebas por fases

### Fase 1 — Pruebas unitarias

Actualmente `node:test` cubre funciones puras de política de contraseña/roles, filtros de movimientos, cálculo/validación de períodos y formatos de placa/tipo. Son 30 pruebas unitarias. Las dependencias DB no se prueban como mocks inyectables de cada servicio; faltan casos unitarios amplios de operadores, clientes, vehículos, autorización, celdas, auditoría y límites/errores por servicio.

Ampliación recomendada: casos exitosos, límites y fallos de cada validador; permisos por rol; campos obligatorios RF-16/RF-23/RF-24; bloqueo de último administrador; concurrencia de períodos y movimientos; restricciones de anulación/corrección; y registro de auditoría.

### Fase 2 — Pruebas de integración

La prueba `backend/test/integracion/ciclo.operativo.test.js` aplica siete scripts en una base temporal y cubre esquema, entrada/salida, mensualidad, anulación, camionetas, placa duplicada y rollback cliente/vehículo. Sus 12 casos pasan ahora. No cubre todos los endpoints/roles, edición de operadores/clientes, historial de titulares, historial de celdas, auditoría con todos los filtros ni expiración de sesión.

### Automatización

- Disponible: `node:test`, `npm test`, MySQL aislado para integración, Vite build y Oxlint.
- No declarado en `package.json`: Jest, Vitest, Supertest, Playwright/Playwright Core.
- No se encontró configuración de GitHub Actions.
- Los documentos afirman que M-01…M-18 se automatizaron con `playwright-core`, pero el arnés no está versionado en el repositorio; por eso no es reproducible desde una instalación limpia.
- Recomendación para aprobación futura: conservar `node:test` o incorporar Vitest/Jest para unidades, Supertest para rutas, Playwright para flujos UI y un workflow CI que no use la BD real. No se instaló nada ni se alteraron configuraciones.

## 10. Resultados de pruebas

- Backend: `npm test`, **42 pass, 0 fail, 0 skipped**. Incluye 30 pruebas unitarias y 12 de integración sobre base temporal.
- Integración MySQL: aplicación de los siete scripts, ciclo de entrada/salida, restricciones, anulación y atomicidad; los 12 casos pasaron ahora.
- Frontend: `npm run build`, éxito, **29 módulos**.
- Lint: `npm run lint`, **0 errores y 14 advertencias** de hooks React (dependencias faltantes/actualización de estado desde efectos).
- No se ejecutó prueba de carga ni se midió una consulta representativa contra el objetivo de RNF-03.
- Las pruebas manuales se documentan abajo como resultados reportados, no reejecutados durante esta auditoría.

### Resultados reportados de M-01 a M-18

Los resultados “declarados” son transcripciones de `Documentacion/09_Matriz_Pruebas.md` y `13_Evidencias_Pruebas_Manuales.md`; **no fueron reejecutados por esta auditoría**. La columna de auditoría evita presentarlos como una observación actual.

| ID | RF/HU | Preparación y pasos resumidos | Esperado | Resultado declarado en documentos | Estado en esta auditoría | Evidencia declarada / automatización |
|---|---|---|---|---|---|---|
| M-01 | RNF-01 | Autenticar admin y recorrer secciones con consola | Navegación sin errores | 12 secciones, consola limpia | No reejecutada | `M-01_recorrido_secciones.png`; Playwright externo |
| M-02 | RF-08/HU-08 | Probar credencial inválida y válida | Rechazo y acceso, respectivamente | Ambos resultados correctos | No reejecutada | `M-02a`, `M-02b`; Playwright externo |
| M-03 | RF-11/HU-11 | Cinco intentos fallidos con usuario de prueba | Bloqueo y evento auditado | Bloqueo/contador/evento presentes | No reejecutada | `M-03_cuenta_bloqueada.png`; Playwright externo |
| M-04 | RF-16…21/HU-16…21 | Crear; suspender con/sin sesión; reactivar | Alta, guardas, motivo e historial | Ciclo principal aprobado según documento | No reejecutada; no demuestra RF-18 ni todos los casos de desvinculación | `M-04a…d`; Playwright externo |
| M-05 | RF-22/23/HU-22/23 | Registrar cliente+vehículo, duplicar documento, consultar | Transacción, rechazo y consulta | Aprobado según documento | No reejecutada; no prueba edición de RF-25 | `M-05a…c`; Playwright externo |
| M-06 | RF-24/26/27 | Alta vehículo, placa duplicada, tipo activo, cambio titular | Rechazos e historial correctos | Aprobado según documento | No reejecutada | `M-06a…d`; Playwright externo |
| M-07 | RF-02/HU-02 | Intentar entrada con placa desconocida | Rechazar sin crear vehículo | Rechazo y 0 vehículos nuevos declarados | No reejecutada | `M-07_entrada_placa_no_registrada.png`; Playwright externo |
| M-08 | RF-01/02/HU-01/02 | Entrada de carro y camioneta | Celda compatible; camioneta→CARRO | Celdas asignadas según documento | No reejecutada | `M-08a/b`; Playwright externo |
| M-09 | RF-04/05/HU-04/05 | Registrar salida y repetir sin entrada activa | Finalizar y luego rechazar | Aprobado según documento | No reejecutada | `M-09a/b`; Playwright externo |
| M-10 | RF-07/HU-07 | Alternar estados y buscar placa | Filtros correctos, orden descendente | Aprobado según documento | No reejecutada; ver discrepancia de conteos abajo | `M-10_historial_filtros.png`; Playwright externo |
| M-11 | RF-37/HU-37 | Consultar auditoría filtrando MOVIMIENTO | Entradas/salidas con operador | ENTRADA/SALIDA declaradas | No reejecutada; no cubre todos los filtros de RF-38 | `M-11_auditoria_movimientos.png`; Playwright externo |
| M-12 | RF-35/36/HU-35/36 | Corregir activo y anular con motivo | Cambios autorizados, registro conservado | Aprobado según documento | No reejecutada | `M-12a/b`; Playwright externo |
| M-13 | RF-30…34/HU-30…34 | Crear/modificar/bloquear/desbloquear celda e historial | Eventos y valores auditados | Cuatro eventos declarados | No reejecutada; bloqueo ocupado no identificado | `M-13a…e`; Playwright externo |
| M-14 | RF-28/29/HU-28/29 | Crear período, solaparlo, cambiar inicio y verificar vencimiento | 30 días, rechazo, recálculo y estado | Aprobado según documento | No reejecutada; base real presenta una mensualidad vigente irregular | `M-14a…d`; Playwright externo |
| M-15 | RF-06/HU-06 | Comparar panel con BD | Totales coherentes | Capacidad 80/ocupación 0 declaradas | No reejecutada | `M-15_panel_principal.png`; Playwright externo |
| M-16 | RNF-11/HU-14 | Usar operador, revisar menú y llamar ruta admin | UI restringida y 403 | Restricción declarada | No reejecutada | `M-16_menu_y_clientes_operador.png`; Playwright externo |
| M-17 | RF-10/13/HU-10/13 | Cambiar temporal y desbloquear cuenta | Cambio obligatorio y nueva temporal | Aprobado según documento | No reejecutada | `M-17a…d`; Playwright externo |
| M-18 | RF-12/HU-12 | Recuperar cuenta usando enlace de modo consola | Token único, expiración, anti-enumeración | Flujo declarado aprobado; envío real no probado | No reejecutada; limitación externa vigente | `M-18a…d`; Playwright externo |

## 11. Evidencias

- Carpeta revisada: `Documentacion/Evidencias/Iteracion_2/`; hay **43 PNG**, mientras que el inventario indica 46 capturas.
- Tres grupos contienen archivos byte a byte idénticos: `M-01_recorrido_secciones.png` = `M-02b_login_valido.png` = `M-15_panel_principal.png`; `M-07_entrada_placa_no_registrada.png` = `M-08a_entrada_carro.png`; `M-14c_fecha_activacion_modificada.png` = `M-14d_estado_vencida.png`. Esto no invalida por sí solo toda prueba, pero impide sostener que cada estado tiene captura visual distinta.
- La matriz/manual reporta M-10 con conteos visuales de filas/eventos y los compara con conteos de movimientos de BD distintos; una entrada/salida puede producir dos filas. Debe aclararse qué unidad se cuenta.

## 12. Documentación académica

- `00_Inventario_Soportes.md`: documenta 46 capturas y cantidades/estados que no corresponden al inventario presente.
- `02_Matriz_Requisitos.md`: incluye RF/RNF, pero su trazabilidad asigna erróneamente HU y afirma cobertura manual global RF-01…RF-38 sin demostrar caso por caso.
- `03_Historias_Usuario.md`: contiene solo 10 historias; EA2 define 38 y su tabla HU→RF contradice el documento fuente.
- `04_Diagramas.md`: diagramas Mermaid en texto, no exportaciones visuales ni fuentes editables dedicadas. No se encontró artefacto de mockups en los soportes inspeccionados.
- `05_Modelo_Entidad_Relacion.md`: conserva una nota de esquema de clientes sin columnas de autorización, contradictoria con la estructura consultada ahora; debe actualizarse tras revisión autorizada.
- `09_Matriz_Pruebas.md` y `13_Evidencias_Pruebas_Manuales.md`: presentan 42/42 y 18/18, pero los pasos/evidencias no cubren explícitamente cada criterio (por ejemplo RF-18, RF-25 y los filtros completos RF-38).
- `10_Auditoria_Cumplimiento_EA2.md`, `11_Informe_Final_Iteracion2.md` y `14_Acta_Cierre_Iteracion2.md` afirman 37/38 RF, 13/13 RNF y cierre total. La evidencia revisada no permite sostener esos porcentajes sin reservas.
- EA2 contiene los rótulos “URL Repositorio GitHub” y “URL Video de presentación”, pero no valores URL. El README no registra el enlace del repositorio ni del video.
- Los diagramas y el diccionario deben cotejarse con las 14 tablas reales; las dos tablas auxiliares sí aparecen identificadas en el modelo/diccionario como respaldo y bitácora.

## 13. README

El README ya tiene cambios locales previos a esta auditoría. **No se modificó** porque no es prudente declararlo definitivo mientras persisten inconsistencias. Además de los problemas documentales anteriores, sus cifras están desactualizadas: consigna 28 módulos y 16 advertencias; esta ejecución obtuvo 29 módulos y 14 advertencias. La descripción de instalación y el orden `schema.sql`+`002`…`007` sí corresponden al procedimiento documentado; `RF-12` deja claro que el correo real requiere proveedor externo.

No incluir usuarios/contraseñas reales. Antes de publicarlo, actualizar fechas/resultados con una validación aprobada y agregar URLs solo cuando el responsable las confirme.

## 14. Hallazgos prioritarios y recomendaciones

1. **Alta — Alta de cliente eludible:** `POST /api/clientes` permite crear cliente sin vehículo ni autorización, mientras que `POST /api/clientes/registro` implementa el flujo transaccional. Alinear el contrato de API con RF-23/RNF-12 y definir el alcance de la ruta alterna antes de publicarlo.
2. **Alta — Campos obligatorios incompletos:** servicios/DB aceptan datos vacíos para apellidos/email/teléfono de operadores y email/teléfono de clientes, y marca/modelo/color del vehículo. Ajustar validación de servicio y esquema/formulario a HU-16/HU-23/HU-24 tras autorización.
3. **Alta — Dato mensual vigente fuera de regla:** una de dos mensualidades `VIGENTE` en `autoscolombia` no tiene 30 días. Revisar origen/impacto con el responsable antes de cualquier corrección; esta auditoría no modificó la fila.
4. **Alta — Auditoría no inmutable en DB:** sin triggers ni evidencia de permisos restringidos; los valores anterior/nuevo se registran, pero la prohibición de modificación/eliminación no queda garantizada.
5. **Media — Integridad débil a nivel esquema:** `operadores.documento` y `vehiculos.cliente_id` son nullable; el último administrador y la duración/traslape de suscripciones dependen de lógica de aplicación. El estado actual no muestra duplicados/orfandad salvo la mensualidad señalada.
6. **Media — Matriz HU y documentos contradicen EA2:** completar HU-11…HU-38, corregir las asignaciones, recontar capturas y alinear informe/cierre/modelo de datos.
7. **Media — Evidencia manual no reproducible:** 43 PNG frente a 46 declaradas, tres grupos de duplicados y arnés Playwright fuera del repositorio. Preservar un reporte con ejecución y datos aislados que permita verificar cada escenario.
8. **Media — Rendimiento sin medición representativa:** medir consultas objetivo bajo el volumen/carga definidos por EA2; el health check no demuestra RNF-03.
9. **Baja — Filtro/presentación de historial:** documentar el conteo de movimientos frente a filas de eventos y revisar la duplicidad de botones por movimiento representado en varias filas.
10. **Publicación bloqueada — Git:** la rama local esperada no está publicada en GitHub, el upstream está eliminado y hay 57 cambios sin commit. No se publica ni se sincroniza sin autorización expresa.

## 15. Pendientes que requieren autorización

- Corregir validaciones de RF-16/RF-23/RF-24 y decidir el destino del endpoint alterno de alta de cliente.
- Decidir la remediación de la mensualidad irregular en la base real, con respaldo y criterio del responsable.
- Reforzar la inmutabilidad de auditoría y restricciones de esquema.
- Alinear README, historias, matrices, modelo, acta e inventario de evidencias.
- Reejecutar los casos manuales faltantes/afectados y generar capturas distintas y reproducibles.
- Configurar proveedor real de correo para comprobar envío RF-12 (dependencia externa).
- Publicar `Iteracion_2` y realizar commit/push solo cuando se autorice.

## 16. Estado final de Git

Al cierre de la auditoría, los conteos observados siguen siendo 27 modificados, 1 eliminado y 29 nuevos/no rastreados; ninguno staged. Se agregó solamente este informe a `Documentacion/`. No se hizo commit, push, merge, cambio de rama ni modificación de `main`. El árbol de trabajo no está listo para una publicación controlada mientras sus 57 cambios no se revisen y aprueben.

## 17. Conclusión

**Dictamen: no listo para publicar como entrega académica definitiva; listo con observaciones solo para continuar revisión local.** El backend, build y lint actuales pasan, y existe una base funcional significativa. No obstante, la alta de cliente puede eludir transacción/consentimiento, algunos campos requeridos no son exigidos por el backend, hay un período vigente no conforme en la base real, RNF-07 no está garantizado por MySQL y la documentación/evidencia sobrestima cobertura y cierre. Se recomienda resolver y volver a auditar estos puntos antes de actualizar la documentación como definitiva o autorizar publicación.
