# AutosColombia - Entrega 1: autenticación y usuarios

## Alcance implementado

- Inicio de sesión por documento y contraseña.
- Hash de contraseñas con `scrypt` de Node.js; no se almacenan contraseñas en texto plano.
- Sesiones con token aleatorio, almacenamiento del hash del token y vencimiento por 90 minutos de inactividad.
- Cierre de sesión y revocación de sesión.
- Bloqueo de cuenta después de cinco intentos fallidos consecutivos.
- Perfiles `ADMINISTRADOR` y `OPERADOR` validados en el backend.
- Administrador puede consultar, crear, suspender y reactivar operadores.
- Operador puede usar dashboard, entradas, salidas, historial y consulta de celdas disponibles.
- Gestión de clientes, vehículos y suscripciones restringida al administrador.
- El ID del operador en entradas y salidas ahora se toma de la sesión autenticada, no del cuerpo enviado por el navegador.
- Se conserva la tabla `operadores` y las relaciones de movimientos existentes.

## Antes de ejecutar

1. Haz un respaldo de la base `autoscolombia`.
2. Verifica que el backend esté detenido.
3. Copia los archivos de esta entrega sobre el proyecto local, conservando tu archivo `backend/.env` actual. Este paquete no contiene credenciales.
4. No ejecutes `backend/sql/schema.sql` sobre la base actual.

## Migración de base de datos

Ejecuta una sola vez en MySQL Workbench o en el cliente MySQL:

```sql
SOURCE C:/Users/ADMINISTRADOR/Documents/Proyectos/AutosColombia/backend/sql/migrations/002_autenticacion_operadores.sql;
```

La migración agrega columnas a `operadores` y crea `sesiones_operadores` y `auditoria_autenticacion`. No elimina ni reconstruye tablas ni registros existentes.

## Configurar la cuenta administradora inicial

Después de ejecutar la migración, abre PowerShell:

```powershell
Set-Location "C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia\backend"
npm run configurar-admin
```

El asistente configura como administrador el primer operador existente (normalmente ID 1). Solicita documento y contraseña. La contraseña debe tener mínimo 10 caracteres. No la escribas en un comando ni la compartas por chat.

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

## Pruebas incluidas

En `backend/test/auth.test.js` se verifican el hash de contraseña, la política mínima de longitud y la autorización por roles. Se ejecutan con `npm test`.

## Validaciones pendientes antes de dar por cerrada esta entrega

- Ejecutar la migración sobre una copia de la base real y confirmar que conserva todos los registros.
- Configurar el administrador inicial y probar login real contra MySQL.
- Crear un operador de prueba y comprobar que no puede acceder a clientes, vehículos, suscripciones ni administración de usuarios (debe recibir HTTP 403).
- Comprobar que entrada y salida guardan automáticamente los IDs de los usuarios autenticados, incluso cuando sean operadores diferentes.
- Confirmar que la sesión expira después de 90 minutos sin actividad.
- Ejecutar `npm run build` en el entorno Windows del proyecto. El ZIP original incluye dependencias instaladas para Windows; no fue posible reutilizarlas en el entorno Linux de revisión porque sus binarios nativos son específicos de plataforma.

## Consideraciones

- La recuperación por correo y el envío de enlaces aún no se implementan porque falta configurar y validar el proveedor de correo.
- La auditoría de esta entrega cubre eventos de autenticación. La auditoría general de cambios de clientes, celdas, movimientos y valores anteriores/nuevos corresponde al siguiente bloque.
- No se hicieron commits ni publicaciones en GitHub.
