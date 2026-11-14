# Manual de usuario — AutosColombia (Iteración 2)

Aplicación web de gestión de parqueadero. Este manual describe los flujos **implementados** y cómo operarlos.

## 1. Requisitos previos

- Backend en ejecución (`http://localhost:3001`).
- Frontend en ejecución (`npm run dev` en `frontend`).
- Base de datos `autoscolombia` creada y migrada (ver `07_Orden_Migraciones.md`).
- Un usuario con contraseña. Los administradores ven todo el menú; los operadores, solo las secciones operativas.

## 2. Ingreso al sistema

1. Abrir la aplicación en el navegador.
2. En la pantalla de inicio de sesión, escribir **Documento** y **Contraseña**.
3. Pulsar **Iniciar sesión**.

- Credenciales correctas → se abre el panel principal con el menú según el rol.
- Credenciales incorrectas → mensaje de error. Tras 5 intentos fallidos la cuenta se bloquea.
- La sesión expira tras 90 minutos de inactividad. El botón **Cerrar sesión** (arriba a la derecha) finaliza la sesión.

## 3. Panel principal

Muestra:
- Total de celdas, celdas para carros y celdas para motos.
- Vehículos dentro (total, carros, motos) y celdas libres.
- Lista de los últimos movimientos.

## 4. Registrar la entrada de un vehículo

1. Menú → **Ingreso de vehículos**.
2. Completar:
   - **Placa del vehículo** (carro: 3 letras + 3 números, p. ej. `ABC123`; moto: 3 letras + 2 números + 1 letra, p. ej. `KLM45D`).
   - **Tipo de vehículo**: Carro o Moto.
   - **Acceso**: principal o secundario.
3. Pulsar **Registrar ingreso**.

Resultado esperado: mensaje de éxito con la **celda asignada**.
Errores posibles: placa no registrada (el sistema **no crea** el vehículo), vehículo inactivo, tipo que no corresponde con la placa, vehículo ya parqueado, sin suscripción ACTIVA vigente o sin celdas disponibles.

## 5. Registrar la salida de un vehículo

1. Menú → **Salida de vehículos**.
2. Ingresar la **placa** y el **acceso** de salida.
3. Pulsar **Registrar salida**.

Resultado esperado: el movimiento queda finalizado y la celda vuelve a estar disponible.
Error posible: no hay una entrada abierta para esa placa.

## 6. Historial de movimientos (filtros en backend)

1. Menú → **Historial de movimientos**.
2. Usar el filtro de estado: **Activos**, **Finalizados**, **Anulados** o **Todos**.
3. Usar el buscador **«Buscar por placa…»** para filtrar por placa.
4. Los resultados siempre se ordenan por **fecha de entrada descendente**.

Cada fila muestra placa, tipo, movimiento (Entrada/Salida/Anulación), celda, hora y operador. Los movimientos anulados se resaltan.

## 7. Gestión de vehículos (administrador)

1. Menú → **Gestión de vehículos**.
2. **Registrar**: pulsar *Nuevo*, completar placa, tipo, cliente, marca, modelo, color y año, y guardar.
3. **Consultar**: usar el buscador (placa, marca, modelo) y el filtro por tipo.
4. **Editar**: pulsar *Editar* en la fila y actualizar los datos.
5. **Inactivar/Activar**: pulsar la acción de estado.

Reglas: la placa debe ser válida según el tipo; no se puede cambiar el propietario de un vehículo con historial; no se puede inactivar un vehículo que está dentro.

## 8. Gestión de clientes (administrador)

Menú → **Gestión de clientes**. Permite listar/buscar, crear, editar y activar/inactivar clientes. Un cliente es requisito para asociar vehículos.

## 9. Gestión de celdas (administrador)

Menú → **Gestión de celdas**. Permite ver el resumen por tipo, crear celdas, modificar su ubicación/tipo, **bloquear/desbloquear** y consultar el **historial** de cambios de una celda.

## 10. Suscripciones (administrador)

Menú → **Suscripciones**. Permite:
- Consultar y buscar suscripciones por placa, marca, modelo o cliente.
- Registrar una suscripción de **exactamente 30 días calendario** (sin solapamientos; la renovación inicia el día siguiente al último período no cancelado).
- Cambiar el estado (Pendiente/Activa/Vencida/Cancelada).

El sistema marca automáticamente como **Vencida** las suscripciones cuya fecha fin ya pasó (al iniciar el servidor y cada 60 segundos).

## 11. Gestión de usuarios (administrador)

Menú → **Gestión de usuarios**. Permite consultar operadores, **crear** uno nuevo (nombre, documento, contraseña, teléfono, rol) y **suspender/reactivar** su acceso. No incluye edición de datos.

## 12. Auditoría (administrador)

Menú → **Auditoría**. Muestra los eventos registrados con operador, entidad, acción, valores anterior/nuevo y fecha. Se puede filtrar por usuario, rango de fechas, acción y entidad.

## 13. Preguntas frecuentes

| Situación | Qué hacer |
|---|---|
| La pantalla quedó en blanco o con datos viejos | Refrescar con **Ctrl + F5** |
| «La sesión no es válida o ha expirado» | Volver a iniciar sesión |
| «El vehículo no se encuentra registrado» | Registrar primero el vehículo en **Gestión de vehículos** |
| «Sin suscripción vigente» | Registrar/renovar la suscripción en **Suscripciones** |
| «No hay celdas disponibles» | Revisar **Gestión de celdas** (bloqueadas/activas) |
