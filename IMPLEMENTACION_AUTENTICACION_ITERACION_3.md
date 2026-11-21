# AutosColombia - Entrega 3: gestión de pagos

## Alcance implementado

- Registro, modificación y consulta de tarifas.
- Consulta de cuenta de cobro de cada vehículo asociado a un cliente.
- Registro de pago completo de la mensualidad por vehículo.
- Validación de pago y no permitir que exista una transacción aprobada duplicada.
- Actualizar el estado de la mensualidad claculando su fecha de activación y vencimiento.
- Consultar el estado del pago de una mensualidad.
- Generar un comprobante al momento del pago y poder obtener los comprobantes de pago registrados.
- Anular un pago registrado por error, indicando el motivo.

## Antes de ejecutar

1. Haz un respaldo de la base `autoscolombia`.
2. Verifica que el backend esté detenido.
3. Copia los archivos de esta entrega sobre el proyecto local, conservando tu archivo `backend/.env` actual. Este paquete no contiene credenciales.
4. No ejecutes `backend/sql/schema.sql` sobre la base actual.

## Migración de base de datos

Ejecuta una sola vez en MySQL Workbench o en el cliente MySQL:

```sql
SOURCE C:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/sql/migrations/012_crear_tabla_pagos.sql;
```

La migración agrega la tabla `pagos` y todos sus atributos correspondientes. No elimina registros existentes.

```sql
SOURCE C:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/sql/migrations/013_gestion_tarifas.sql;
```

La migración crea las tablas `tarifas` y `tipos_vehiculo` necesarias para que el administrador pueda definir y gestionar las tarifas estándar según cada tipo de vehículo. Estos valores se utilizarán posteriormente cuando el operador registre una suscripción permitiendo asignar automáticamente la tarifa correspondiente de acuerdo con el tipo de vehículo.

## Iniciar y probar

Terminal 1:

```powershell
Set-Location "C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia\backend"
npm test
npm run dev
```

Terminal 2:

```powershell
Set-Location "C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia\frontend"
npm run dev
```

Abre la URL que indique Vite (en el entorno actual se venía usando `http://localhost:5174`). Inicia sesión con el documento y la contraseña que acabas de configurar. Desde **Gestión de usuarios**, el administrador puede crear el usuario operador.

## Validaciones pendientes antes de dar por cerrada esta entrega

- Ejecutar la migración sobre una copia de la base real y confirmar que conserva todos los registros.
- Configurar el administrador inicial y probar login real contra MySQL.
- Crear un operador de prueba y comprobar que no puede acceder a clientes, vehículos, suscripciones ni administración de usuarios (debe recibir HTTP 403).
- Ejecutar `npm run build` en el entorno Windows del proyecto. El ZIP original incluye dependencias instaladas para Windows; no fue posible reutilizarlas en el entorno Linux de revisión porque sus binarios nativos son específicos de plataforma.

## Consideraciones

- La auditoría de este bloque integra los eventos de autenticación y las operaciones del sistema en una consulta unificada. Incluye el seguimiento de inicios y cierres de sesión, intentos fallidos de acceso y bloqueos de cuentas, así como el registro de operaciones sobre movimientos, celdas y la gestión de tarifas. Para las modificaciones de tarifas, se almacenan los valores anteriores y nuevos, junto con el operador responsable y la fecha de la operación, permitiendo mantener la trazabilidad de los cambios realizados.
- No se hicieron commits ni publicaciones en GitHub.
