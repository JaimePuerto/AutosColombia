# AutosColombia

Sistema web para gestionar la operación de un parqueadero, incluyendo el registro de entradas y salidas de vehículos, la administración de celdas y operadores, y el seguimiento de la información operativa.

## Tecnologías

- **Frontend:** React y Vite.
- **Backend:** Node.js y Express.
- **Base de datos:** MySQL (utf8mb4 / utf8mb4_unicode_ci).
- **Comunicación:** API REST mediante solicitudes HTTP.

## Estructura del proyecto

```text
AutosColombia/
├── backend/
│   ├── sql/
│   │   ├── schema.sql
│   │   └── migrations/
│   │       ├── 002_autenticacion_operadores.sql
│   │       ├── 003_gestion_celdas_auditoria.sql
│   │       ├── 004_iteracion2_auditoria_movimientos.sql
│   │       ├── 005_cierre_iteracion2_seguridad.sql
│   │       ├── 006_estados_suscripcion_ea2.sql
│   │       ├── 007_tipo_vehiculo_camioneta.sql
│   │       ├── 008_datos_obligatorios_clientes.sql
│   │       ├── 009_historicos_append_only.sql
│   │       ├── 010_integridad_campos_ea2.sql
│   │       └── 011_normalizacion_mensualidades_30_dias.sql
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   └── app.js
│   ├── test/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   └── App.jsx
│   └── package.json
├── Documentacion/          # Soportes de la entrega (ver sección "Documentación")
│   └── Evidencias/
│       └── Iteracion_2/     # Capturas reales de las pruebas manuales M-01 a M-18
├── .gitignore
└── README.md
```

> Las carpetas locales `Implementaciones/` y `Respaldo/` (scripts de apoyo, exportaciones y respaldos internos)
> **no forman parte del repositorio** y están excluidas en `.gitignore`.

## Requisitos previos

Antes de ejecutar el proyecto, se necesita tener instalado:

- Node.js y npm.
- MySQL 8.0.29 o superior (triggers idempotentes de la migración 009).
- Git.

## Configuración de la base de datos

1. Iniciar el servicio de MySQL.
2. Crear la base de datos con la codificación correcta:
   ```sql
   CREATE DATABASE IF NOT EXISTS autoscolombia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Ejecutar los scripts **en este orden** (instalación limpia):

   | Paso | Archivo |
   |---|---|
   | 1 | `backend/sql/schema.sql` |
   | 2 | `backend/sql/migrations/002_autenticacion_operadores.sql` |
   | 3 | `backend/sql/migrations/003_gestion_celdas_auditoria.sql` |
   | 4 | `backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql` |
   | 5 | `backend/sql/migrations/005_cierre_iteracion2_seguridad.sql` |
   | 6 | `backend/sql/migrations/006_estados_suscripcion_ea2.sql` |
   | 7 | `backend/sql/migrations/007_tipo_vehiculo_camioneta.sql` |
   | 8 | `backend/sql/migrations/008_datos_obligatorios_clientes.sql` |
   | 9 | `backend/sql/migrations/009_historicos_append_only.sql` |
   | 10 | `backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql` |
   | 11 | `backend/sql/migrations/010_integridad_campos_ea2.sql` |

   ```bash
   mysql -u root -p autoscolombia < backend/sql/schema.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/002_autenticacion_operadores.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/003_gestion_celdas_auditoria.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/004_iteracion2_auditoria_movimientos.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/005_cierre_iteracion2_seguridad.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/006_estados_suscripcion_ea2.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/007_tipo_vehiculo_camioneta.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/008_datos_obligatorios_clientes.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/009_historicos_append_only.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/011_normalizacion_mensualidades_30_dias.sql
   mysql -u root -p autoscolombia < backend/sql/migrations/010_integridad_campos_ea2.sql
   ```
4. Configurar las credenciales de conexión en el archivo `backend/.env`.

**Importante:** `schema.sql` y `002` están diseñados para una inicialización limpia (ejecutar una sola vez). Las migraciones `003` a `009` y `011` son aditivas e idempotentes. La migración `011` normaliza las mensualidades a 30 días calendario (`fecha_fin = fecha_inicio + 29`) y **debe ejecutarse antes de `010`**, porque `010` incorpora la restricción `chk_suscripcion_30_dias`. En una instalación limpia `011` no tiene efectos (no hay mensualidades). La migración `008` añade campos explícitos para nombres y apellidos sin dividir ni modificar clientes históricos; los formularios y servicios exigen estos campos en nuevas altas. Las migraciones `009` y `010` agregan append-only y restricciones MySQL.

**Bases con datos existentes:** ejecutar `011` antes que `010`. `011` corrige las mensualidades irregulares con respaldo verificable y auditoría; si un período corregido se cruzaría con otra mensualidad del mismo vehículo, no se modifica y queda registrado en `mensualidades_sin_conciliar` para decisión manual. `010` incluye un preflight que aborta sin cambiar filas si aún quedan campos obligatorios vacíos o períodos distintos de 30 días. El detalle está en [`Documentacion/07_Orden_Migraciones.md`](Documentacion/07_Orden_Migraciones.md).

## Configuración y ejecución del backend

Abrir una terminal en la carpeta `backend`:

```bash
cd backend
npm ci
```

Crear el archivo `.env` a partir de `.env.example` y configurar los datos de conexión a MySQL:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=autoscolombia_app     # cuenta de ejecución (mínimo privilegio)
DB_PASSWORD=
DB_NAME=autoscolombia
DB_ADMIN_USER=root            # cuenta administrativa (migraciones / mantenimiento / arnés E2E)
DB_ADMIN_PASSWORD=
```

Los valores deben ajustarse a la configuración local de cada integrante. No se deben publicar contraseñas ni otros secretos en el repositorio.

### Cuentas de MySQL y mínimo privilegio

El sistema separa dos cuentas para reducir el impacto de un error o de un compromiso:

- **Cuenta de ejecución (`DB_USER`, por defecto `autoscolombia_app`):** es la que usa el backend en operación normal. Solo tiene `SELECT/INSERT/UPDATE/DELETE` **por tabla**; sobre las tablas de auditoría e históricos (`auditoria_eventos`, `auditoria_autenticacion`, `historial_celdas`, `historial_titulares_vehiculo`) **solo tiene `SELECT` e `INSERT`**, por lo que **no puede modificar ni eliminar** registros de auditoría, y **no tiene privilegios DDL** (no puede alterar el esquema).
- **Cuenta administrativa (`DB_ADMIN_USER`, por defecto `root`):** se usa solo para crear la base, aplicar migraciones y ejecutar el arnés E2E (que crea una base efímera). El backend **no la usa** en operación normal.

Aprovisionar ambas cuentas (con el esquema ya instalado):

```bash
cd backend
# Las contraseñas se leen de variables de entorno y NUNCA se versionan.
DB_ADMIN_USER=root DB_ADMIN_PASSWORD='<clave-dba>' \
ADMIN_DB_USER=autoscolombia_admin ADMIN_DB_PASSWORD='<clave-admin>' \
APP_DB_USER=autoscolombia_app     APP_DB_PASSWORD='<clave-app>' \
npm run crear-usuarios-bd
```

El script es idempotente (recrea las cuentas) y otorga los privilegios por tabla descritos arriba. La contraseña de ejecución debe tener 10 caracteres o más, sin espacios.

Iniciar el servidor en modo desarrollo:

```bash
npm run dev
```

El backend estará disponible por defecto en `http://localhost:3001`.

Para comprobar la conexión con MySQL, visitar `http://localhost:3001/api/health`. Una respuesta `{"ok":true,...}` indica que la API y MySQL están conectados.

## Configuración y ejecución del frontend

Abrir una segunda terminal desde la raíz del proyecto:

```bash
cd frontend
npm ci
npm run dev
```

Vite mostrará en la terminal la dirección local en la que se puede abrir la aplicación.

Actualmente, el frontend utiliza `http://localhost:3001/api` para comunicarse con el backend.

## Pruebas y validación

| Comando | Ubicación | Qué hace |
|---|---|---|
| `npm test` | `backend` | Ejecuta las pruebas automatizadas (`node --test`), incluidas integraciones contra una base MySQL temporal |
| `npm run build` | `frontend` | Compila la aplicación con Vite |
| `npm run lint` | `frontend` | Análisis estático (oxlint) |
| `npm run test:e2e` | `frontend` | Ejecuta el arnés Playwright con los escenarios M-01…M-18 sobre una base efímera |
| `npm run rendimiento:rnf03` | `frontend` | Benchmark de rendimiento RNF-03 (`e2e/rendimiento/rnf03.spec.js`) |

Última validación técnica (2026-11-13): backend **52/52 pruebas aprobadas**, incluidas pruebas MySQL aisladas que instalan el esquema y migraciones 002–011; frontend compilado correctamente (29 módulos); lint con **0 errores y 14 advertencias** de hooks React. El resultado incluye pruebas de consentimiento explícito y de revocación auditada. Detalle en [`Documentacion/09_Matriz_Pruebas.md`](Documentacion/09_Matriz_Pruebas.md).

Las pruebas M-01 a M-18 están **automatizadas y en verde** con un arnés Playwright versionado en `frontend/e2e/`: la corrida `npm run test:e2e` ejecuta **33 pruebas (33 aprobadas, 0 fallidas)** contra una base efímera `autoscolombia_e2e_<pid>`, un backend de pruebas en el puerto 3311 y un Vite aislado en 5219, y regenera **43 capturas únicas** en `Documentacion/Evidencias/Iteracion_2/`. La base real `autoscolombia` no se consulta. Ver [`Documentacion/13_Evidencias_Pruebas_Manuales.md`](Documentacion/13_Evidencias_Pruebas_Manuales.md).

RNF-03 se mide con `npm run rendimiento:rnf03` sobre una **consulta funcional** (historial de movimientos, `GET /api/movimientos?limite=200`) con 400 clientes, 400 vehículos, 4.000 movimientos y 80 celdas: **p95 87,02 ms** en concurrencia 1 y **249,36 ms** en concurrencia 10, frente al límite de 3.000 ms; el plan real de la consulta tarda 84,9 ms. Condiciones completas en [`Documentacion/09_Matriz_Pruebas.md`](Documentacion/09_Matriz_Pruebas.md) §4.1. La medición corresponde a un banco de pruebas local, no a producción, y el valor histórico de `GET /api/health` (35,7 ms) solo acreditaba disponibilidad.

> Las pruebas de integración crean una base de datos propia (`autoscolombia_test_<pid>`), aplican el orden de instalación limpia y la eliminan al terminar. Si no hay servidor MySQL o cliente `mysql` disponibles, esas pruebas se **omiten** (no fallan) y el resto continúa.

## RF-12 — Recuperación de contraseña por correo

El flujo de recuperación (solicitud → token de un solo uso → restablecimiento) está **implementado y probado**.
El **envío real del correo** está **preparado pero pendiente de habilitar**: depende de que el responsable del
proyecto configure las credenciales de un proveedor SMTP/API. Sin esa configuración, el sistema genera el enlace y
lo escribe en la consola del servidor, **sin simular un envío real**.

Variables de entorno (definidas en `backend/.env.example`):

```env
MAIL_PROVIDER=consola                     # consola (no envía) | http (proveedor real)
MAIL_API_URL=                             # requerido si MAIL_PROVIDER=http
MAIL_API_KEY=                             # requerido si MAIL_PROVIDER=http
MAIL_FROM=Sistema AutosColombia <no-reply@autoscolombia.local>
APP_BASE_URL=http://localhost:5173        # URL pública del frontend (se usa para construir el enlace)
```

### Cómo habilitar el envío real

1. Contratar o disponer de un proveedor transaccional que exponga un **endpoint HTTP** de envío
   (por ejemplo un *relay* SMTP→HTTP, Resend, SendGrid u otro similar). El backend no acopla un proveedor concreto:
   envía un `POST` JSON con la cabecera `Authorization: Bearer <MAIL_API_KEY>`.
2. Definir en `backend/.env`:
   - `MAIL_PROVIDER=http`
   - `MAIL_API_URL=<endpoint de envío del proveedor>`
   - `MAIL_API_KEY=<clave de API del proveedor>`
   - `MAIL_FROM=<remitente autorizado>`
3. Ajustar `APP_BASE_URL` a la URL real del frontend (en producción, el dominio público).
4. Reiniciar el backend.

El cuerpo enviado es `{ from, to, subject, text }`. Si el proveedor requiere **SMTP puro** (no HTTP), basta con
interponer un servicio de *relay* SMTP→HTTP y apuntar `MAIL_API_URL` a ese relay.

> **Estado:** RF-12 implementado y preparado para habilitación del proveedor externo. **Envío real pendiente de
> configuración de credenciales**. No se deben publicar credenciales ni claves en el repositorio.

## Limitaciones conocidas

- **RF-12 (correo):** el envío real queda pendiente de configurar un proveedor SMTP/API (ver sección anterior). La lógica local de recuperación está completa y probada.
- **Migraciones `008`, `009` y `010`:** los scripts existen y son aditivos, pero **no se han aplicado a una base con datos** en esta entrega; una instalación limpia con el orden de 11 pasos sí las incluye. Aplíquelas en una ventana de mantenimiento con respaldo.
- **RNF-03:** la medición de rendimiento corresponde a un banco de pruebas local, no a un entorno de producción con carga real.
- **Pagos:** fuera del alcance de la Iteración 2.

## Documentación de la entrega

La carpeta [`Documentacion/`](Documentacion) reúne los soportes académicos:

| Documento | Contenido |
|---|---|
| `00_Inventario_Soportes.md` | Inventario de soportes existentes y faltantes |
| `01_Funcionalidades_Implementadas.md` | Funcionalidades y endpoints implementados |
| `02_Matriz_Requisitos.md` | Requisitos funcionales y criterios de aceptación |
| `03_Historias_Usuario.md` | Historias de usuario |
| `04_Diagramas.md` | Casos de uso, actividades y secuencia |
| `05_Modelo_Entidad_Relacion.md` | Modelo entidad-relación |
| `06_Diccionario_Datos.md` | Diccionario de datos |
| `07_Orden_Migraciones.md` | Orden de ejecución de migraciones |
| `08_Manual_Usuario.md` | Manual de usuario |
| `09_Matriz_Pruebas.md` | Matriz de pruebas |
| `10_Auditoria_Cumplimiento_EA2.md` | Auditoría de cumplimiento (línea base del diagnóstico) |
| `11_Informe_Final_Iteracion2.md` | Informe final del cierre de la Iteración 2 (secciones A–K) |
| `12_Reporte_Conciliacion_Mensualidades.md` | Conciliación de mensualidades a 30 días calendario (migración 011) |
| `13_Evidencias_Pruebas_Manuales.md` | Evidencias de las pruebas manuales y guion de demostración |
| `14_Acta_Cierre_Iteracion2.md` | Acta de cierre de la Iteración 2 |
| `15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md` | Segunda auditoría de cumplimiento (hallazgos críticos) |
| `16_Informe_Final_Correcciones_EA2.md` | Informe de correcciones posteriores a la auditoría final |
| `17_Informe_Cierre_Final_EA2.md` | Informe de cierre final de la Iteración 2 (EA2) |

## Iteraciones del proyecto

### Iteración 1. Gestión de entradas y salidas

Implementación de las funcionalidades para registrar movimientos de vehículos, asociarlos con celdas y operadores, y consultar la información operativa mediante el dashboard.

### Iteración 2. Gestión de usuarios y celdas

Autenticación con roles, gestión de usuarios (consultar, crear, suspender, reactivar), clientes, vehículos y celdas, auditoría operativa, suscripciones y filtros del historial de movimientos en el backend (HU-07).

### Iteración 3. Gestión de pagos

Iteración destinada a desarrollar las funcionalidades de gestión de pagos.

## Equipo de trabajo

- Jaime
- Estefanya Romero
- Manuel Pemberthy

## Estado del proyecto

El proyecto se desarrolla de manera iterativa. Las funcionalidades y mejoras se incorporarán progresivamente durante cada etapa.
