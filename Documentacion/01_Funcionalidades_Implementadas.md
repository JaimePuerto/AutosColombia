# Funcionalidades implementadas — AutosColombia (Iteración 2)

Este documento describe **únicamente lo que está implementado en el código** a la fecha de cierre (2026-11-13).
No se describen funcionalidades futuras ni parciales sin soporte en el repositorio.

> **Estado post-auditoría:** este documento describe funcionalidades que existen en el código; su descripción no certifica por sí sola el cumplimiento EA2. La suite actual pasó **52/52 pruebas automatizadas** en base temporal y las pruebas manuales M-01 a M-18 se reejecutaron con el arnés Playwright versionado (**33/33** sobre base efímera, 43 capturas únicas). RNF-03 se acredita con el benchmark del historial (p95 87,02 ms en C1 y 249,36 ms en C10). RF-12 mantiene pendiente la integración externa de correo. Dictamen vigente: [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md).

## 1. Arquitectura general

| Capa | Tecnología | Ubicación |
|---|---|---|
| Backend | Node.js + Express (ESM) + `mysql2/promise` | `backend/src` |
| Frontend | React + Vite | `frontend/src` |
| Base de datos | MySQL 8 (utf8mb4 / utf8mb4_unicode_ci) | `backend/sql` |
| Autenticación | Token opaco en `sessionStorage`, hash de sesión (SHA-256) y contraseña con **scrypt** | `backend/src/services/auth.service.js` |

El backend expone la API bajo `/api`. Todas las rutas (excepto `/api/health` y `/api/auth`) exigen token válido; las rutas de administración exigen rol `ADMINISTRADOR`. Con `password_temporal` activo, el middleware limita el acceso a `/api/auth/me`, `/api/auth/cambiar-password` y `/api/auth/logout` (responde `403 CAMBIO_PASSWORD_REQUERIDO`).

## 2. Módulos y funcionalidades

### 2.1 Autenticación, sesiones y contraseñas
- Inicio de sesión por **documento + contraseña** con verificación scrypt.
- Token de sesión almacenado como hash `SHA-256` en `sesiones_operadores`; expira por **inactividad mayor a 90 minutos**.
- **Bloqueo de cuenta** tras 5 intentos fallidos (`intentos_fallidos`, `bloqueado`).
- **Cambio de contraseña** (RF-10) con política (`validators/password.js`): mínimo 10 caracteres, con letras y números, sin espacios; invalida las demás sesiones.
- **Cambio obligatorio** cuando la contraseña es temporal (bloqueo de módulos protegidos).
- **Recuperación por correo** (RF-12): token aleatorio de un solo uso, **solo se guarda su hash** (`recuperacion_password`), vencimiento de 30 minutos y auditoría; la respuesta pública es equivalente exista o no el documento.
- **Desbloqueo con contraseña temporal** (RF-13) por el administrador.
- Registro de eventos en `auditoria_autenticacion` (`LOGIN_EXITOSO`, `LOGIN_FALLIDO`, `CIERRE_SESION`, `CUENTA_BLOQUEADA`, `CAMBIO_PASSWORD`, `PASSWORD_TEMPORAL_ASIGNADA`, `RECUPERACION_SOLICITADA`, `PASSWORD_RESTABLECIDA`, `DESBLOQUEO_CUENTA`).
- Archivos: `services/auth.service.js`, `services/correo.service.js`, `validators/password.js`, `routes/auth.routes.js`, `middleware/auth.middleware.js`.

### 2.2 Gestión de usuarios (operadores) — solo administrador
- Listar y **buscar** operadores por documento, nombre y estado (**filtros en SQL**, RF-17).
- Crear operador con nombres, apellidos, documento, correo (único), teléfono, rol y estado; si no se define contraseña, se genera una **contraseña temporal** que se muestra una sola vez (RF-16).
- **Editar** datos del operador con validación de unicidad y auditoría de valores anterior/nuevo (RF-18).
- **Suspender / desvincular / reactivar** con **motivo obligatorio** y auditoría (RF-19/20/21). Reglas: no suspender/desvincular la propia cuenta; no si el operador tiene sesión activa; debe permanecer al menos un administrador activo; al reactivar se entrega contraseña temporal.
- **Desbloquear** cuenta (RF-13) generando contraseña temporal.
- **No elimina** operadores (baja lógica).
- Archivos: `services/operadores.service.js`, `routes/operadores.routes.js`, `frontend/src/components/Operadores.jsx`.

### 2.3 Gestión de clientes
- Listar y buscar clientes; crear, editar y activar/inactivar.
- **Consulta por documento** (RF-22): devuelve datos, vehículos y **estado de la mensualidad** de cada vehículo.
- **Registro transaccional** (RF-23): crea cliente + al menos un vehículo + **autorización de tratamiento de datos** (con fecha) en una sola operación; si falla algo, se revierte todo (RNF-10/RNF-12).
- Modificación con auditoría de valores anterior/nuevo (RF-25).
- Archivos: `services/clientes.service.js`, `routes/clientes.routes.js`, `frontend/src/components/Clientes.jsx`.

### 2.4 Gestión de vehículos
- Listar y buscar vehículos; crear, editar y activar/inactivar.
- Filtro por **tipo** (CARRO/MOTO/CAMIONETA) y estado resueltos en SQL (`listarVehiculos`), no en el cliente (HU-07).
- Validación de placa por tipo, incluido **CAMIONETA** (`validators/placas.js`).
- Rechazo de placa de otro cliente con mensaje explícito de **cambio de titular** (RF-24).
- **No** se cambia el tipo con un movimiento activo (RF-26).
- **Cambio de titular** administrativo (RF-27) que conserva los movimientos y registra el vínculo con el titular anterior en `historial_titulares_vehiculo`, con motivo, operador y fecha; se consulta el historial con `GET /api/vehiculos/:id/titulares`.
- Archivos: `services/vehiculos.service.js`, `routes/vehiculos.routes.js`, `frontend/src/components/Vehiculos.jsx`.

### 2.5 Gestión de celdas
- Listar celdas con filtros y consultar disponibles por tipo; resumen por tipo.
- Administrador: crear, modificar, bloquear y desbloquear celdas (con motivo).
- **Snapshot** de código y tipo de celda en cada entrada (RF-31).
- **Historial de celda** (RF-34) que une `historial_celdas` (creación, modificación, bloqueo, desbloqueo) con los **movimientos** (entradas, salidas y anulaciones), ordenado cronológicamente.
- Archivos: `services/celdas.service.js`, `routes/celdas.routes.js`, `frontend/src/components/Celdas.jsx`.

### 2.6 Movimientos (entrada y salida)
- **Registrar entrada** con validaciones: operador activo, vehículo registrado y activo, tipo coincidente, suscripción `VIGENTE`, celda disponible del tipo correcto, sin ingreso activo duplicado; guarda el **snapshot** de la celda.
- **Registrar salida** de un vehículo dentro (no exige suscripción vigente).
- **Historial** con filtros en SQL: estado (`ACTIVOS`, `FINALIZADOS`, `ANULADOS`, `TODOS`), búsqueda por placa y límite; orden descendente.
- Consulta de si un vehículo está dentro por placa.
- **Auditoría** de entrada y salida dentro de la misma transacción.
- Archivos: `services/movimientos.service.js`, `routes/movimientos.routes.js`.

### 2.7 Movimientos administrativos — solo administrador
- **Anular** (RF-35) con motivo (no elimina; libera la celda si estaba abierta).
- **Corregir** (RF-36) observaciones, accesos y celda de movimientos activos.
- Interfaz administrativa: `frontend/src/components/MovimientosAdmin.jsx`.
- Archivos: `services/movimientos.admin.service.js`, `routes/movimientos.admin.routes.js`.

### 2.8 Suscripciones / mensualidades — solo administrador
- Listar y buscar suscripciones; consultar por ID y por placa.
- Crear con **período exacto de 30 días calendario**, sin solapamiento y con renovación consecutiva.
- Cambiar estado (`PROGRAMADA`, `VIGENTE`, `VENCIDA`, `CANCELADA`) con motivo e historial. La nomenclatura es la del documento EA2 (RF-28); la migración `006` tradujo los valores anteriores (`PENDIENTE → PROGRAMADA`, `ACTIVA → VIGENTE`) de forma aditiva.
- **Modificar la fecha de activación** (RF-29) con recálculo del vencimiento, validación de traslapes y auditoría.
- Sincronización automática de estados vencidos al iniciar y cada 60 segundos.
- Archivos: `services/suscripciones.service.js`, `routes/suscripciones.routes.js`, `frontend/src/components/Suscripciones.jsx`, `backend/src/app.js`.

### 2.9 Panel principal (dashboard)
- Totales de celdas y ocupación; últimos movimientos.
- Archivos: `routes/dashboard.routes.js`, panel en `frontend/src/App.jsx`.

### 2.10 Auditoría — solo administrador
- **Registro** (RF-37) de autenticación, operadores, clientes, vehículos, celdas, movimientos, suscripciones y anulaciones/correcciones, con operador, fecha, entidad, acción, motivo y valores anterior/nuevo.
- **Consulta unificada** (RF-38) de `auditoria_eventos` y `auditoria_autenticacion` con filtros por usuario, rango de fechas, acción, entidad y tipo de evento.
- Archivos: `services/auditoria.service.js`, `routes/auditoria.routes.js`, `frontend/src/components/Auditoria.jsx`.

## 3. Interfaz de usuario (secciones del menú)

| Sección | Visible para | Componente |
|---|---|---|
| Panel principal | Todos | `frontend/src/App.jsx` |
| Ingreso de vehículos | Todos | `frontend/src/App.jsx` |
| Salida de vehículos | Todos | `frontend/src/App.jsx` |
| Historial de movimientos | Todos | `frontend/src/App.jsx` |
| Mi cuenta (cambio de contraseña) | Todos | `components/Cuenta.jsx` |
| Recuperación de contraseña | Público (query `?recuperacion=`) | `components/Recuperacion.jsx` |
| Gestión de clientes | Administrador | `components/Clientes.jsx` |
| Gestión de vehículos | Administrador | `components/Vehiculos.jsx` |
| Gestión de usuarios | Administrador | `components/Operadores.jsx` |
| Anular / corregir movimientos | Administrador | `components/MovimientosAdmin.jsx` |
| Auditoría | Administrador | `components/Auditoria.jsx` |
| Gestión de celdas | Administrador | `components/Celdas.jsx` |
| Suscripciones | Administrador | `components/Suscripciones.jsx` |

**Comportamiento por perfil (RNF-11):** el menú se filtra por rol (`menuVisible`); las secciones exclusivas del administrador no se muestran al operador. La **consulta de clientes** sí está disponible para el operador (es parte de su operación), y en ese caso los botones de **modificar** e **inactivar** se muestran **deshabilitados** con la leyenda «Solo el administrador puede modificar clientes.» (`Clientes.jsx`·`esAdministrador`). Toda decisión de autorización real se mantiene en el backend (`requiereAdministrador`), que responde `403` aunque se invoque la ruta directamente.

## 4. Tabla resumen de endpoints

| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` · `/api/auth/recuperacion` · `/api/auth/recuperacion/restablecer` | Público |
| GET | `/api/auth/me` · POST `/api/auth/logout` · `/api/auth/cambiar-password` | Autenticado |
| GET | `/api/movimientos` (filtros `estado`, `placa`, `limite`) | Autenticado |
| POST | `/api/movimientos/entrada` · `/api/movimientos/salida` | Autenticado |
| GET | `/api/movimientos/vehiculo/:placa` | Autenticado |
| POST | `/api/movimientos-admin/:id/anular` · PATCH `/api/movimientos-admin/:id/corregir` | Administrador |
| GET | `/api/celdas` · `/api/celdas/disponibles` · `/api/celdas/resumen` | Autenticado |
| GET | `/api/celdas/:id/historial` · POST `/api/celdas` · PUT `/api/celdas/:id` · POST `/api/celdas/:id/bloquear` · `/desbloquear` | Administrador |
| GET | `/api/clientes` · `/api/clientes/consulta/:documento` · `/api/clientes/:id` | Administrador |
| POST | `/api/clientes/registro` · `/api/clientes` · PUT `/api/clientes/:id` · PATCH `/api/clientes/:id/estado` | Administrador |
| GET | `/api/vehiculos` (filtros `buscar`, `cliente_id`, `activo`, `tipo`) · `/api/vehiculos/:id` · `/api/vehiculos/:id/titulares` | Administrador |
| POST | `/api/vehiculos` · PUT `/api/vehiculos/:id` · POST `/api/vehiculos/:id/cambiar-titular` · PATCH `/api/vehiculos/:id/estado` | Administrador |
| GET | `/api/suscripciones` · `/api/suscripciones/:id` · `/api/suscripciones/vehiculo/:placa` | Administrador |
| POST | `/api/suscripciones` · PATCH `/api/suscripciones/:id/estado` · `/api/suscripciones/:id/fecha-activacion` | Administrador |
| GET | `/api/operadores` | Administrador |
| POST | `/api/operadores` · PUT `/api/operadores/:id` · PATCH `/api/operadores/:id/estado` · POST `/api/operadores/:id/desbloquear` | Administrador |
| GET | `/api/auditoria` | Administrador |
| GET | `/api/dashboard` | Autenticado |

> Las respuestas de listado devuelven `{ ok, total, data }`; las de operación, `{ ok, mensaje, data }`.
