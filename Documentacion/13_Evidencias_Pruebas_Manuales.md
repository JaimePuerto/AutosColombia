# Evidencias de pruebas manuales — AutosColombia (Iteración 2)

**Proyecto:** AutosColombia — Sistema de gestión de parqueadero
**Rama:** `Iteracion_2`
**Fecha de ejecución reportada anteriormente:** 2026-11-13
**Entorno de referencia:** Windows · Node.js · React + Vite · Express 5 · MySQL 8.4

> **Estado post-auditoría:** los escenarios M-01 a M-18 fueron **reejecutados** con un arnés Playwright versionado
> en el repositorio (`frontend/e2e/`). La corrida `npx playwright test --reporter=list` ejecuta 33 pruebas
> (cada escenario con varios estados se divide en subcasos) contra la base efímera `autoscolombia_e2e_<pid>`,
> un backend de pruebas en el puerto 3311 y un Vite aislado en 5219, con **33 aprobadas / 0 fallidas / 0 omitidas**
> y **43 capturas únicas** regeneradas en `Documentacion/Evidencias/Iteracion_2/`. Las filas de resultados
> siguientes conservan el registro histórico reportado y ahora quedan confirmadas por esa corrida. La base real
> `autoscolombia` no se consulta en ningún caso.

---

## 0. Método de ejecución

Los escenarios M-01 a M-18 se ejecutan **desde la interfaz gráfica del sistema** mediante el arnés de navegador
**Playwright** versionado (`@playwright/test`, en modo *headless*). Para cada escenario el arnés:

1. Identifica el requisito relacionado.
2. Prepara los datos de prueba (clientes, vehículos, operadores, celdas y suscripciones) **desde la propia interfaz**.
3. Ejecuta la operación desde la interfaz y comprueba el resultado visual (mensajes y cambios en pantalla).
4. Verifica la persistencia y las reglas de integridad consultando MySQL sobre `autoscolombia_e2e`.
5. Captura una imagen real de la ejecución y la guarda en `Documentacion/Evidencias/Iteracion_2/`.

El arnés vigente **sí** está versionado en el repositorio (`frontend/e2e/`, con `playwright.config.js` y
`frontend/e2e/support/`), por lo que el procedimiento anterior es reproducible: crea la base efímera, siembra los
usuarios de prueba, levanta backend y Vite aislados, intercepta toda llamada del navegador a `localhost:3001` y la
redirige al backend de pruebas. Las 43 capturas actuales se regeneraron con ese arnés, una por subcaso y sin
reutilización; el conteo coincide con los archivos en disco. La base real `autoscolombia` no forma parte de la corrida.

---

## 1. Evidencia automatizada (resultados históricos y validación actual)

| ID | Verificación | Comando | Resultado |
|---|---|---|---|
| E-01 | Pruebas del backend | `npm test` (backend, 2026-11-13) | **52/52 aprobadas**, integración MySQL contra base temporal independiente |
| E-02 | Compilación del frontend | `npm run build` (frontend) | Compila sin errores |
| E-03 | Análisis estático | `npm run lint` (frontend) | 0 errores |
| E-04 | Sintaxis backend | `node --check` sobre `src`, `scripts`, `test` | Sin errores |
| E-05 | Arranque del backend | `npm run dev` / `node src/app.js` | «AutosColombia API disponible en http://localhost:3001» |
| E-06 | Salud de la API y MySQL | `GET /api/health` | `{"ok":true,"mensaje":"API y MySQL conectados."}` |
| E-07 | Arnes E2E M-01…M-18 | `npx playwright test` (frontend) | **33/33 aprobadas**; base efímera `autoscolombia_e2e_<pid>`; 43 capturas únicas |
| E-08 | Benchmark RNF-03 | `npm run rendimiento:rnf03` (frontend) | **1/1 aprobada**; historial con 4.000 movimientos: p95 87,02 ms (C1) y 249,36 ms (C10); SQL 84,9 ms |

Las pruebas de integración (E-01) crean una base independiente, aplican los **11 scripts** del orden de instalación
limpia, verifican el comportamiento y la eliminan al terminar. Detalle de cada caso en [`09_Matriz_Pruebas.md`](09_Matriz_Pruebas.md).

---

## 2. Resultado de M-01 a M-18 (reejecutadas con el arnés Playwright versionado)

Los estados "APROBADO" de la tabla se confirman con la corrida automatizada del arnés versionado en `frontend/e2e/`
(**33/33 aprobadas** sobre la base efímera `autoscolombia_e2e_<pid>`, con 43 capturas únicas y sin reutilizar
imágenes), no con la ejecución manual previa no reproducible. La base real `autoscolombia` no se consulta en ningún caso.

| ID | Requisito | Procedimiento | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observaciones |
|---|---|---|---|---|---|---|---|
| M-01 | RNF-01 (calidad de interfaz) | Iniciar sesión como administrador y recorrer las doce secciones del menú con la consola del navegador abierta. | Navegación completa sin errores en consola. | Las doce secciones cargaron sin mensajes de error en consola. | APROBADO | `M-01_recorrido_secciones.png` | Secciones recorridas: 12. Errores en consola hasta este punto: 0. |
| M-02 | RF-08 (inicio de sesión) | Intentar iniciar sesión con contraseña inválida y luego con credenciales válidas. | Inválidas: mensaje de error y sin acceso. Válidas: acceso al sistema. | Credenciales inválidas rechazadas con mensaje; credenciales válidas otorgaron acceso. | APROBADO | `M-02a_login_invalido.png`, `M-02b_login_valido.png` | Mensaje con credenciales inválidas: «No fue posible iniciar sesión. Verifica tus credenciales o el estado de tu cuenta.». |
| M-03 | RF-11 (bloqueo de cuenta) | Fallar la contraseña cinco veces consecutivas con el operador 1000003. | La cuenta queda bloqueada y se registra el evento de auditoría. | Tras cinco intentos fallidos la cuenta quedó bloqueada y el evento se auditó. | APROBADO | `M-03_cuenta_bloqueada.png` | BD: `bloqueado=1`, `intentos_fallidos=5`. Eventos `CUENTA_BLOQUEADA`: 1. |
| M-04 | RF-16 a RF-21 (gestión de usuarios) | Crear un operador; intentar suspender un operador con sesión activa; suspender un operador sin sesión; reactivarlo. | Alta correcta; el sistema impide suspender una cuenta con sesión activa; motivo obligatorio; suspensión y reactivación operan según la regla. | Se creó el operador; el sistema impidió suspender una cuenta con sesión activa; la suspensión y la reactivación operaron con motivo obligatorio. | APROBADO | `M-04a_usuario_creado.png`, `M-04b_suspension_con_sesion_activa.png`, `M-04c_usuario_suspendido.png`, `M-04d_usuario_reactivado.png` | Botón «Confirmar cambio» deshabilitado sin motivo: `true`. Suspensión con sesión activa (1000002): «No se puede suspender o desvincular: el operador tiene una sesión activa.» → estado conservado ACTIVO. Suspensión de 1000005 (sin sesión): «Estado del operador actualizado.» → SUSPENDIDO. Reactivación → ACTIVO con nueva contraseña temporal. Eventos de auditoría SUSPENDER/REACTIVAR: 2. |
| M-05 | RF-22, RF-23 (clientes) | Registrar un cliente con vehículo y autorización de datos; repetir el mismo documento; consultar por documento. | Registro correcto; documento duplicado rechazado; la consulta devuelve el vehículo y su mensualidad. | Cliente y vehículo registrados con autorización; documento duplicado rechazado; consulta devuelve el vehículo. | APROBADO | `M-05a_cliente_registrado.png`, `M-05b_documento_duplicado.png`, `M-05c_consulta_documento.png` | Registro: «Cliente y vehículo registrados correctamente.». Duplicado: «Ya existe un cliente con ese tipo y número de documento.». BD: cliente activo=1, autorización=1, vehículo=ZZT101, vehículo del duplicado=0. |
| M-06 | RF-24, RF-26, RF-27 (vehículos) | Registrar un vehículo; repetir la placa; cambiar el tipo de un vehículo con movimiento activo; cambiar el titular con historial. | Alta correcta; placa duplicada rechazada; el cambio de tipo se bloquea con movimiento activo; el cambio de titular queda en el historial. | Vehículo registrado; placa duplicada rechazada; cambio de titular registrado en el historial; cambio de tipo bloqueado por movimiento activo. | APROBADO | `M-06a_vehiculo_registrado.png`, `M-06b_placa_duplicada.png`, `M-06c_cambio_titular.png`, `M-06d_cambio_tipo_bloqueado.png` | Alta: «Vehículo registrado correctamente.». Placa duplicada: «La placa ZZT202 ya está registrada a nombre de otro cliente…». Cambio de titular: «Titular actualizado correctamente.» (1 fila en `historial_titulares_vehiculo`). Cambio de tipo con movimiento activo: «No se puede cambiar el tipo del vehículo mientras tenga un movimiento activo.» (tipo en BD: CARRO). |
| M-07 | RF-02 (control de ingreso) | Registrar la entrada de una placa no registrada previamente. | La operación se rechaza y NO se crea el vehículo automáticamente. | Entrada rechazada y el vehículo no fue creado. | APROBADO | `M-07_entrada_placa_no_registrada.png` | Mensaje: «El vehículo no se encuentra registrado. Debe registrarse antes de ingresar al parqueadero.». Vehículos ZZT999 en BD: 0. |
| M-08 | RF-01, RF-02 (entrada válida) | Registrar la entrada de un carro (ZZT101) y de una camioneta (ZZT303). | Entradas registradas con celda asignada; la camioneta ocupa una celda de tipo CARRO. | Ambas entradas registradas con celda asignada; la camioneta recibió una celda de tipo CARRO. | APROBADO | `M-08a_entrada_carro.png`, `M-08b_entrada_camioneta.png` | Carro: «Entrada registrada correctamente. Celda asignada: C01.». Camioneta: «Entrada registrada correctamente. Celda asignada: C02.» (`tipo_celda_snapshot=CARRO`). |
| M-09 | RF-04, RF-05 (salida) | Registrar la salida del vehículo ZZT101 y luego intentar una salida sin entrada abierta. | La salida finaliza el movimiento; la segunda salida se rechaza. | Salida registrada y movimiento finalizado; la segunda salida fue rechazada. | APROBADO | `M-09a_salida_registrada.png`, `M-09b_salida_sin_entrada.png` | Salida: «Salida registrada correctamente.». Segunda salida: «No hay una entrada abierta para esta placa.». `fecha_salida` registrada. |
| M-10 | RF-07 / HU-07 (historial de movimientos) | Alternar los filtros Activos / Finalizados / Anulados / Todos y buscar por placa. | Conteos correctos por estado y resultados ordenados de forma descendente. | Los cuatro filtros coinciden con la base de datos y la búsqueda por placa devolvió únicamente coincidencias, en orden descendente. | APROBADO | `M-10_historial_filtros.png` | Conteos UI (eventos): `ACTIVOS:0, FINALIZADOS:2, ANULADOS:1, TODOS:3` = BD (`activos:0, finalizados:1, anulados:1`; un movimiento finalizado genera dos eventos entrada/salida). Búsqueda «ZZT» → sólo placas ZZT*. |
| M-11 | RF-37 (auditoría) | Tras registrar entrada y salida, abrir Auditoría y filtrar por entidad MOVIMIENTO. | Existen filas ENTRADA y SALIDA asociadas al operador que ejecutó la operación. | La auditoría muestra eventos ENTRADA y SALIDA de movimientos con su operador. | APROBADO | `M-11_auditoria_movimientos.png` | Acciones visibles: SALIDA, ENTRADA. Eventos MOVIMIENTO en BD: 3; operadores distintos: 1. |
| M-12 | RF-35, RF-36 (anular y corregir) | Corregir un movimiento abierto (ZZT303) y luego anularlo indicando el motivo. | La corrección actualiza sin borrar; la anulación marca el registro y conserva el motivo. | Movimiento corregido (acceso actualizado sin borrado) y anulado con motivo; el registro se conserva marcado. | APROBADO | `M-12a_movimiento_corregido.png`, `M-12b_movimiento_anulado.png` | Corrección: «Movimiento corregido correctamente.». Anulación: «Movimiento anulado correctamente.». Registro conservado: id=2, `anulado_en` con fecha, `motivo_anulacion` presente. |
| M-13 | RF-30 a RF-34 (gestión de celdas) | Crear una celda, modificar su ubicación, bloquearla con motivo, desbloquearla y consultar su historial. | Cada acción se registra en el historial con valores anterior y nuevo. | Celda creada, modificada, bloqueada y desbloqueada; el historial conserva los valores anterior y nuevo. | APROBADO | `M-13a_celda_creada.png`, `M-13b_celda_modificada.png`, `M-13c_celda_bloqueada.png`, `M-13d_celda_desbloqueada.png`, `M-13e_historial_celda.png` | Mensajes: «Celda creada correctamente.» / «Celda actualizada correctamente.» / «Celda bloqueada correctamente.» / «Celda desbloqueada correctamente.». Eventos de historial para Z99 en BD: 4. |
| M-14 | RF-28, RF-29 (suscripciones) | Crear una suscripción de 30 días para ZZT101; intentar un período solapado; modificar la fecha de activación; verificar el vencimiento. | Creada; solapamiento rechazado; fecha recalculada a 30 días; la suscripción pasa a VENCIDA por sincronización automática. | Suscripción de 30 días creada; período solapado rechazado; fecha de activación recalculada; la suscripción pasó a VENCIDA por la sincronización automática. | APROBADO | `M-14a_suscripcion_creada.png`, `M-14b_solapamiento_rechazado.png`, `M-14c_fecha_activacion_modificada.png`, `M-14d_estado_vencida.png` | Alta: «Suscripción registrada. El estado se actualizará automáticamente según su fecha de inicio.». Solapamiento: «El período se cruza con la suscripción #1 (…). Las suscripciones canceladas sí liberan sus fechas.». Modificación: «Fecha de activación actualizada correctamente.». Estado final tras la sincronización automática: VENCIDA (estados EA2). |
| M-15 | RF-06 (panel principal) | Abrir el Panel principal y comparar los indicadores con la base de datos. | Totales y ocupación coherentes con la base de datos. | Los cuatro indicadores del panel coinciden con la base efímera en el momento de la consulta. | APROBADO | `M-15_panel_principal.png` | Corrida automatizada: el test crea cliente+vehículo, su suscripción vigente y una entrada, y compara los cuatro `.stat-number` del panel contra `celdas` y `movimientos` de la base efímera. |
| M-16 | RNF-11 (restricción por perfil) | Ingresar como operador (1000002), revisar el menú y abrir «Gestión de clientes»; invocar una ruta de administrador. | Sin menús administrativos; botones de modificación deshabilitados; rutas de administrador responden 403. | El operador no ve secciones administrativas, los botones de modificación están deshabilitados y las rutas de administrador responden 403. | APROBADO | `M-16_menu_y_clientes_operador.png` | Ítems de menú visibles para el operador: 5 (Panel principal, Ingreso, Salida, Historial, Gestión de clientes). «Mi cuenta» no está en el menú lateral: se abre desde el menú del perfil (`.user-menu-trigger`). Botón Editar deshabilitado: `true`. `GET /api/auditoria` como operador → HTTP 403. |
| M-17 | RF-10, RF-13 (contraseña temporal y desbloqueo) | Crear un operador sin contraseña; ingresar con la contraseña temporal; desbloquear una cuenta bloqueada. | Se exige el cambio de contraseña antes de continuar; el desbloqueo emite una nueva contraseña temporal. | Se exigió el cambio de la contraseña temporal antes de continuar (la cuenta quedó sin contraseña temporal) y el desbloqueo emitió una nueva contraseña temporal. | APROBADO | `M-17a_operador_con_temporal.png`, `M-17b_desbloqueo_cuenta.png`, `M-17c_cambio_obligatorio.png`, `M-17d_password_cambiada.png` | Pantalla «Cambio de contraseña obligatorio» mostrada: `true`. Tras el cambio, acceso al sistema (layout visible): `true`; `password_temporal` de 1000007 en BD: 0. Desbloqueo de 1000003 emitió nueva contraseña temporal (`bloqueado=0`). |
| M-18 | RF-12 (recuperación de contraseña) | Bloquear 1000002; solicitar recuperación con documento existente e inexistente; abrir el enlace generado en modo consola y restablecer la contraseña. | Respuesta equivalente (no revela la existencia); el enlace restablece la contraseña y desbloquea la cuenta. | Respuesta anti-enumeración verificada; el enlace restableció la contraseña, la cuenta quedó desbloqueada y el acceso fue exitoso. | APROBADO | `M-18a_solicitud_documento_existente.png`, `M-18b_solicitud_documento_inexistente.png`, `M-18c_restablecimiento.png`, `M-18d_login_con_nueva_password.png` | Respuestas equivalentes para documento existente e inexistente: `true`. Enlace obtenido del modo consola (`MAIL_PROVIDER=consola`). Restablecimiento: «Contraseña restablecida correctamente. Ya puedes iniciar sesión.». Uso único registrado (`usado_en`) y expiración a 30 minutos. **El envío real de correo NO se declara probado**: depende del proveedor externo no configurado. |

### Notas sobre límites de las pruebas

- **RF-12 (M-18):** el flujo completo se verifica con el **enlace generado** en modo consola. El **envío real del correo**
  no se declara probado porque depende de la configuración de un proveedor SMTP/API externo (ver `11_Informe_Final_Iteracion2.md`, sección de RF-12).
- **M-14:** el paso a `VENCIDA` se alcanza por la **sincronización automática** del backend (cada 60 s); en la prueba se
  ajustaron las fechas de la suscripción en la **base de pruebas** y se esperó la sincronización real.
- **M-08 / M-10 / M-12:** dependen de operaciones previas (suscripción VIGENTE y movimientos); el arnés respeta el orden
  operativo real del sistema.

---

## 3. Consultas SQL de apoyo para evidencias

```sql
USE autoscolombia_e2e;   -- base independiente de pruebas (no la base real)

-- Auditoría de movimientos (M-11)
SELECT accion, entidad, operador_id, fecha_hora
FROM auditoria_eventos
WHERE entidad = 'MOVIMIENTO'
ORDER BY fecha_hora DESC;

-- Estados de suscripción alineados con EA2 (M-14)
SELECT id, vehiculo_id, estado, fecha_inicio, fecha_fin
FROM suscripciones
ORDER BY id DESC;

-- Historial de titulares (M-06)
SELECT * FROM historial_titulares_vehiculo ORDER BY fecha DESC;

-- Trazabilidad de tokens de recuperación (solo hash; M-18)
SELECT id, operador_id, expira_en, usado_en FROM recuperacion_password ORDER BY id DESC;
```

---

## 4. Estado del documento

| Categoría | Total | Ejecutadas | Pendientes |
|---|---|---|---|
| Evidencia automatizada | 6 | 6 | 0 |
| Pruebas manuales de guion | 18 | 18 | 0 |

> Ninguna fila se marca como aprobada sin su evidencia correspondiente. Las capturas listadas existen en
> `Documentacion/Evidencias/Iteracion_2/` y corresponden a la ejecución del 2026-11-13.
