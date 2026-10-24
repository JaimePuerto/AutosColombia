# AutosColombia

Sistema web para gestionar la operación de un parqueadero, incluyendo el registro de entradas y salidas de vehículos, la administración de celdas y operadores, y el seguimiento de la información operativa.

## Tecnologías

- **Frontend:** React y Vite.
- **Backend:** Node.js y Express.
- **Base de datos:** MySQL.
- **Comunicación:** API REST mediante solicitudes HTTP.

## Estructura del proyecto

```text
AutosColombia/
├── backend/
│   ├── sql/
│   │   └── schema.sql
│   ├── src/
│   │   ├── config/
│   │   └── routes/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── .gitignore
└── README.md
```

## Requisitos previos

Antes de ejecutar el proyecto, se necesita tener instalado:

- Node.js y npm.
- MySQL 8.0.16 o una versión compatible con las instrucciones del script SQL.
- Git.

## Configuración de la base de datos

1. Iniciar el servicio de MySQL.
2. Abrir un cliente MySQL y ejecutar el archivo `backend/sql/schema.sql` para crear la base de datos `autoscolombia`, sus tablas y las 80 celdas iniciales.
3. Configurar las credenciales de conexión en el archivo `backend/.env`.

**Importante:** el script SQL está diseñado para una inicialización limpia. No se debe ejecutar nuevamente sobre una base de datos que ya tenga creadas las tablas y los registros iniciales.

## Configuración y ejecución del backend

Abrir una terminal en la carpeta `backend`:

```bash
cd backend
npm install
```

Crear el archivo `.env` a partir de `.env.example` y configurar los datos de conexión a MySQL:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=autoscolombia
```

Los valores deben ajustarse a la configuración local de cada integrante. No se deben publicar contraseñas ni otros secretos en el repositorio.

Iniciar el servidor en modo desarrollo:

```bash
npm run dev
```

El backend estará disponible por defecto en `http://localhost:3000`.

Para comprobar la conexión con MySQL, visitar:

`http://localhost:3000/api/health`

Una respuesta satisfactoria indicará que la API y MySQL están conectados.

## Configuración y ejecución del frontend

Abrir una segunda terminal desde la raíz del proyecto:

```bash
cd frontend
npm install
npm run dev
```

Vite mostrará en la terminal la dirección local en la que se puede abrir la aplicación.

Actualmente, el frontend utiliza `http://localhost:3000/api` para comunicarse con el backend.

## Iteraciones del proyecto

### Iteración 1. Gestión de entradas y salidas

Implementación de las funcionalidades para registrar movimientos de vehículos, asociarlos con celdas y operadores, y consultar la información operativa mediante el dashboard.

### Iteración 2. Gestión de usuarios y celdas

Iteración destinada a desarrollar las funcionalidades de administración de usuarios y celdas del parqueadero.

### Iteración 3. Gestión de pagos

Iteración destinada a desarrollar las funcionalidades de gestión de pagos.

## Equipo de trabajo

- Jaime
- Estefanya Romero
- Manuel Pemberthy

## Estado del proyecto

El proyecto se desarrolla de manera iterativa. Las funcionalidades y mejoras se incorporarán progresivamente durante cada etapa.
