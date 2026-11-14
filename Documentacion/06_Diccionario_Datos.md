# Diccionario de datos — AutosColombia

Estructura tomada de la **base de datos real** (`autoscolombia`, MySQL 8) al 2026-11-13, verificada contra `information_schema`.
Convenciones: `PK` = clave primaria, `FK` = clave foránea, `UQ` = índice único, `IDX` = índice.
El conteo de filas corresponde a la base real al momento de la verificación.

---

## 1. `operadores`
Usuarios del sistema (administradores y operadores). 3 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | int unsigned | No | PK | auto | Identificador |
| nombre | varchar(100) | No | | | Nombre completo |
| apellidos | varchar(100) | Sí | | | Apellidos (migración 005) |
| documento | varchar(30) | Sí | UQ | | Documento de acceso (único) |
| email | varchar(150) | Sí | UQ | | Correo (único, migración 005) |
| password_hash | varchar(255) | Sí | | | Hash scrypt de la contraseña |
| password_temporal | tinyint(1) | No | | 0 | Contraseña temporal que obliga al cambio (migración 005) |
| rol | enum('ADMINISTRADOR','OPERADOR') | No | | OPERADOR | Perfil |
| estado | enum('ACTIVO','SUSPENDIDO','DESVINCULADO') | No | | ACTIVO | Estado del usuario |
| intentos_fallidos | tinyint unsigned | No | | 0 | Intentos de login fallidos |
| bloqueado | tinyint(1) | No | | 0 | Cuenta bloqueada |
| ultimo_ingreso | datetime | Sí | | | Último inicio de sesión |
| actualizado_en | datetime | Sí | | | Última modificación (migración 005) |
| telefono | varchar(20) | Sí | | | Teléfono |
| activo | tinyint(1) | No | | 1 | Habilitación general |

## 2. `sesiones_operadores`
Sesiones activas por token. 35 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| operador_id | int unsigned | No | FK/IDX | | Operador de la sesión |
| token_hash | char(64) | No | UQ | | SHA-256 del token |
| ultima_actividad | datetime | No | | CURRENT_TIMESTAMP | Última actividad (expira a los 90 min) |
| creada_en | datetime | No | | CURRENT_TIMESTAMP | Creación |
| revocada_en | datetime | Sí | | | Cierre o revocación |

## 3. `auditoria_autenticacion`
Eventos de autenticación. 61 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| operador_id | int unsigned | Sí | FK/IDX | | Operador involucrado |
| documento_intentado | varchar(30) | Sí | | | Documento usado (aun si no existe) |
| accion | enum('LOGIN_EXITOSO','LOGIN_FALLIDO','CIERRE_SESION','CUENTA_BLOQUEADA') | No | | | Tipo de evento |
| fecha_hora | datetime | No | IDX | CURRENT_TIMESTAMP | Fecha del evento |
| detalle | varchar(255) | Sí | | | Información adicional |

## 4. `clientes`
Propietarios de vehículos. 3 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| tipo_cliente | enum('PERSONA','EMPRESA') | No | | | Naturaleza del cliente |
| tipo_documento | varchar(20) | No | IDX (UQ compuesto) | | Tipo de documento |
| numero_documento | varchar(30) | No | IDX (UQ compuesto) | | Número de documento |
| nombre_razon_social | varchar(150) | No | | | Nombre o razón social |
| telefono | varchar(20) | Sí | | | Teléfono |
| correo | varchar(150) | Sí | | | Correo |
| direccion | varchar(200) | Sí | | | Dirección |
| activo | tinyint(1) | No | | 1 | Habilitación |
| autorizacion_datos | tinyint(1) | No | | 0 | Autorización de tratamiento de datos (Ley 1581) |
| autorizacion_fecha | datetime | Sí | | | Fecha de la autorización |
| creado_en | timestamp | No | | CURRENT_TIMESTAMP | Creación |
| actualizado_en | timestamp | Sí | | | Última modificación |

Índice único: `uq_cliente_documento (tipo_documento, numero_documento)`.

> La migración `008` añade `clientes.nombres` y `clientes.apellidos` como columnas aditivas (nullable para históricos). En la base real `autoscolombia` esta migración está **pendiente de aplicar**; en una instalación limpia con los 11 pasos las columnas existen.

## 5. `vehiculos`
Vehículos registrados. 4 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| cliente_id | bigint unsigned | Sí | FK/IDX | | Cliente propietario |
| placa | varchar(10) | No | UQ | | Placa normalizada |
| tipo | enum('CARRO','MOTO','CAMIONETA') | No | | | Tipo de vehículo (migración 007 admite `CAMIONETA`) |
| marca | varchar(50) | Sí | | | Marca |
| modelo | varchar(50) | Sí | | | Modelo |
| color | varchar(30) | Sí | | | Color |
| anio | smallint unsigned | Sí | | | Año |
| creado_en | timestamp | No | | CURRENT_TIMESTAMP | Creación |
| activo | tinyint(1) | No | | 1 | Habilitación |

FK: `fk_vehiculo_cliente` → `clientes(id)` `ON DELETE RESTRICT`.

## 6. `celdas`
Celdas del parqueadero. 81 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | int unsigned | No | PK | auto | Identificador |
| codigo | varchar(20) | No | UQ | | Código de celda |
| tipo | enum('CARRO','MOTO') | No | | | Tipo admitido |
| ubicacion | varchar(100) | Sí | | | Ubicación física |
| activa | tinyint(1) | No | | 1 | Disponible (0 = bloqueada) |

## 7. `movimientos`
Entradas y salidas. 8 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| vehiculo_id | bigint unsigned | No | FK/IDX | | Vehículo |
| celda_id | int unsigned | No | FK/IDX | | Celda asignada |
| operador_entrada_id | int unsigned | No | FK/IDX | | Operador que registró la entrada |
| operador_salida_id | int unsigned | Sí | FK/IDX | | Operador que registró la salida |
| acceso_entrada | enum('PRINCIPAL','SECUNDARIO') | No | | PRINCIPAL | Acceso de entrada |
| acceso_salida | enum('PRINCIPAL','SECUNDARIO') | Sí | | | Acceso de salida |
| fecha_entrada | datetime | No | IDX | CURRENT_TIMESTAMP | Fecha/hora de entrada |
| fecha_salida | datetime | Sí | | | Fecha/hora de salida (NULL = activo) |
| observaciones | varchar(500) | Sí | | | Observaciones |
| vehiculo_activo | bigint unsigned | Sí | UQ | | Generada (STORED): vehiculo_id si el movimiento está activo |
| celda_activa | int unsigned | Sí | UQ | | Generada (STORED): celda_id si el movimiento está activo |
| anulado_en | datetime | Sí | IDX | | Fecha de anulación (NULL = vigente) |
| anulado_por | int unsigned | Sí | | | Operador que anuló |
| motivo_anulacion | varchar(500) | Sí | | | Motivo de anulación |
| codigo_celda_snapshot | varchar(20) | Sí | | | Código de celda al momento del movimiento |
| tipo_celda_snapshot | varchar(10) | Sí | | | Tipo de celda al momento del movimiento |

Índices únicos: `uq_vehiculo_movimiento_activo`, `uq_celda_movimiento_activo`.
Índices: `idx_movimientos_anulados (anulado_en, fecha_entrada)`, `idx_movimientos_fecha_entrada`, `idx_movimientos_vehiculo`, `idx_movimientos_celda`, `idx_movimientos_operador`.

## 8. `suscripciones`
Períodos de 30 días por vehículo. 2 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| vehiculo_id | bigint unsigned | No | FK/IDX | | Vehículo suscrito |
| valor | decimal(12,2) | No | | | Valor del período (CHECK `chk_valor_suscripcion`) |
| estado | enum('PROGRAMADA','VIGENTE','VENCIDA','CANCELADA') | No | IDX | PROGRAMADA | Estado EA2 (migración 006) |
| fecha_inicio | date | No | IDX | | Inicio del período |
| fecha_fin | date | No | IDX | | Fin del período (`fecha_inicio + 29`; CHECK `chk_fechas_suscripcion`) |
| motivo_cancelacion | varchar(500) | Sí | | | Motivo al cancelar (migración 005) |
| creado_en | timestamp | No | | CURRENT_TIMESTAMP | Creación |
| actualizado_en | datetime | Sí | | | Última modificación (migración 005) |

Índices: `idx_suscripciones_vehiculo_fechas (vehiculo_id, fecha_inicio, fecha_fin)`, `idx_suscripcion_estado_fechas (estado, fecha_fin)`.

> La migración `010` añade el CHECK `chk_suscripcion_30_dias` (`fecha_fin = fecha_inicio + 29`). En la base real `autoscolombia` esta migración está **pendiente de aplicar** hasta conciliar la mensualidad ID 1; en una instalación limpia con los 11 pasos queda activa.

## 9. `historial_celdas`
Historial de cambios de celdas. 5 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| celda_id | int unsigned | No | FK/IDX | | Celda afectada |
| operador_id | int unsigned | Sí | FK/IDX | | Operador que ejecutó la acción |
| accion | enum('CREAR','MODIFICAR','BLOQUEAR','DESBLOQUEAR') | No | | | Acción |
| motivo | varchar(500) | Sí | | | Motivo |
| valor_anterior | json | Sí | | | Estado anterior |
| valor_nuevo | json | Sí | | | Estado nuevo |
| fecha_hora | datetime | No | | CURRENT_TIMESTAMP | Fecha |

## 10. `auditoria_eventos`
Auditoría operativa general. 1 fila.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| operador_id | int unsigned | Sí | FK/IDX | | Operador que ejecutó |
| entidad | varchar(40) | No | IDX | | Entidad afectada (p. ej. `MOVIMIENTO`) |
| entidad_id | bigint unsigned | Sí | IDX | | ID del registro afectado |
| accion | varchar(50) | No | | | Acción (`ENTRADA`, `SALIDA`, `CREAR`, …) |
| motivo | varchar(500) | Sí | | | Descripción del evento |
| valor_anterior | json | Sí | | | Datos previos |
| valor_nuevo | json | Sí | | | Datos nuevos |
| fecha_hora | datetime | No | IDX | CURRENT_TIMESTAMP | Fecha |

Índices: `idx_auditoria_eventos_entidad (entidad, entidad_id)`, `idx_auditoria_eventos_fecha`, `idx_auditoria_eventos_usuario (operador_id, fecha_hora)`.

## 11. `recuperacion_password`
Tokens de recuperación de contraseña (RF-12, migración 005). 1 fila.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| operador_id | int unsigned | No | FK/IDX | | Operador que solicita |
| token_hash | char(64) | No | UQ | | SHA-256 del token de un solo uso |
| expira_en | datetime | No | | | Vencimiento del enlace |
| usado_en | datetime | Sí | | | Momento de uso (NULL = vigente) |
| creado_en | datetime | No | | CURRENT_TIMESTAMP | Creación |

## 12. `historial_titulares_vehiculo`
Historial de cambios de titular (RF-27, migración 005). 0 filas.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| vehiculo_id | bigint unsigned | No | FK/IDX | | Vehículo |
| cliente_anterior_id | bigint unsigned | Sí | FK/IDX | | Titular anterior |
| cliente_nuevo_id | bigint unsigned | No | FK/IDX | | Titular nuevo |
| operador_id | int unsigned | Sí | FK/IDX | | Operador que registró el cambio |
| motivo | varchar(500) | Sí | | | Motivo del cambio |
| fecha_cambio | datetime | No | | CURRENT_TIMESTAMP | Fecha/hora del cambio |

## 13. `suscripciones_respaldo_normalizacion`
Respaldo verificable de la normalización de mensualidades (migración 011). 1 fila.

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| id | bigint unsigned | No | PK | auto | Identificador |
| vehiculo_id | bigint unsigned | No | | | Vehículo |
| estado_anterior | varchar(20) | No | | | Estado antes de normalizar |
| fecha_inicio | date | No | | | Inicio del período (no cambia) |
| fecha_fin_anterior | date | No | | | Fin antes de normalizar |
| estado_nuevo | varchar(20) | No | | | Estado recalculado tras normalizar |
| fecha_fin_nueva | date | No | | | Fin normalizado (`fecha_inicio + 29`) |
| respaldado_en | datetime | No | | CURRENT_TIMESTAMP | Fecha del respaldo |

## 14. `mensualidades_sin_conciliar`
Períodos que la migración 011 no pudo corregir por solapamiento (0 filas).

| Campo | Tipo | Nulo | Clave | Predet. | Descripción |
|---|---|---|---|---|---|
| suscripcion_id | bigint unsigned | No | PK | | Mensualidad que requiere decisión manual |
| vehiculo_id | bigint unsigned | No | | | Vehículo |
| fecha_inicio | date | No | | | Inicio del período |
| fecha_fin | date | No | | | Fin del período |
| motivo | varchar(300) | No | | | Motivo por el que no se normalizó |
| detectado_en | datetime | No | | CURRENT_TIMESTAMP | Fecha de detección |

---

## 15. Tablas auxiliares

| Tabla | Descripción |
|---|---|
| `auditoria_eventos_backup_dep_20261113` | Copia de `auditoria_eventos` previa a la depuración de registros de prueba (6 filas). |
| `auditoria_rectificaciones_texto` | Bitácora de la corrección de codificación UTF-8 (1 fila). |
