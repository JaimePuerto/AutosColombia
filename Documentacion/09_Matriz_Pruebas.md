# Matriz de pruebas — AutosColombia (Iteración 2)

Este documento conserva registros históricos y añade el resultado de la validación post-auditoría del 2026-11-13. Las pruebas manuales descritas más abajo no se reejecutaron en esta fase; sus resultados anteriores no se presentan como evidencia vigente.

Entorno: Windows, Node.js 24, MySQL 8.4.13. La base `autoscolombia` solo se consultó en modo de lectura para investigar la suscripción ID 1; las pruebas de integración escriben únicamente en una base temporal.

---

## 1. Pruebas automatizadas — EJECUTADAS

Comando: `npm test` (backend → `node --test`). Validación post-auditoría: **tests 52 · pass 52 · fail 0 · skipped 0**. Incluye la integración real con MySQL en `autoscolombia_test_<pid>`, que crea y elimina una base independiente y aplica `schema.sql` más migraciones 002–011.

La suite incluye casos de consentimiento afirmativo estricto, rechaza `autorizacion: "false"` antes de insertar cliente o vehículo, y comprueba que revocar consentimiento actualiza la fila y registra los valores anterior/nuevo. El inventario por caso de referencia T-01 a T-42 que aparece abajo corresponde al registro anterior y no enumera todos los casos añadidos desde entonces.

### 1.1 Pruebas unitarias y de validación

| ID | Archivo | Caso de prueba | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| T-01 | `auth.test.js` | Genera hash scrypt y no guarda la contraseña en texto plano | Hash distinto a la contraseña | Correcto | Aprobado |
| T-02 | `auth.test.js` | Rechaza contraseñas menores a 10 caracteres | Lanza error | Correcto | Aprobado |
| T-03 | `auth.test.js` | Permite un rol autorizado | Verdadero | Correcto | Aprobado |
| T-04 | `auth.test.js` | Bloquea roles no autorizados | Falso | Correcto | Aprobado |
| T-05 | `movimientos.filtros.test.js` | Sin estado no aplica filtro | `null` | Correcto | Aprobado |
| T-06 | `movimientos.filtros.test.js` | Estado `TODOS` no aplica filtro | `null` | Correcto | Aprobado |
| T-07 | `movimientos.filtros.test.js` | `ACTIVOS` exige sin salida y no anulado | Condición correcta | Correcto | Aprobado |
| T-08 | `movimientos.filtros.test.js` | `FINALIZADOS` exige con salida y no anulado | Condición correcta | Correcto | Aprobado |
| T-09 | `movimientos.filtros.test.js` | `ANULADOS` exige marca de anulación | Condición correcta | Correcto | Aprobado |
| T-10 | `movimientos.filtros.test.js` | Acepta el estado en minúsculas | Condición correcta | Correcto | Aprobado |
| T-11 | `movimientos.filtros.test.js` | Rechaza un estado desconocido | Lanza error | Correcto | Aprobado |
| T-12 | `suscripciones.validation.test.js` | Acepta período de 30 días calendario | Verdadero | Correcto | Aprobado |
| T-13 | `suscripciones.validation.test.js` | Rechaza período de 29 días | Falso | Correcto | Aprobado |
| T-14 | `suscripciones.validation.test.js` | Rechaza período de 31 días | Falso | Correcto | Aprobado |
| T-15 | `suscripciones.validation.test.js` | Rechaza fechas imposibles | Falso | Correcto | Aprobado |
| T-16 | `suscripciones.validation.test.js` | Calcula el día siguiente al finalizar | Fecha correcta | Correcto | Aprobado |
| T-17 | `suscripciones.validation.test.js` | Respeta el cambio de año en 30 días | Verdadero | Correcto | Aprobado |
| T-18 | `password.politica.test.js` | Acepta una contraseña que cumple la política | Verdadero | Correcto | Aprobado |
| T-19 | `password.politica.test.js` | Rechaza una contraseña sin números | Lanza error | Correcto | Aprobado |
| T-20 | `password.politica.test.js` | Rechaza una contraseña sin letras | Lanza error | Correcto | Aprobado |
| T-21 | `password.politica.test.js` | Rechaza una contraseña con espacios | Lanza error | Correcto | Aprobado |
| T-22 | `password.politica.test.js` | Rechaza un valor que no es texto | Lanza error | Correcto | Aprobado |
| T-23 | `password.politica.test.js` | La contraseña temporal cumple la política y la longitud pedida | Verdadero | Correcto | Aprobado |
| T-24 | `vehiculos.tipos.test.js` | Carro y camioneta aceptan el formato de 3 letras y 3 números | Verdadero | Correcto | Aprobado |
| T-25 | `vehiculos.tipos.test.js` | Carro y camioneta rechazan el formato de moto | Falso | Correcto | Aprobado |
| T-26 | `vehiculos.tipos.test.js` | La moto acepta 3 letras, 2 números y una letra final | Verdadero | Correcto | Aprobado |
| T-27 | `vehiculos.tipos.test.js` | Un tipo de vehículo desconocido no valida ninguna placa | Falso | Correcto | Aprobado |
| T-28 | `vehiculos.tipos.test.js` | La normalización elimina espacios y pasa a mayúsculas | Placa normalizada | Correcto | Aprobado |
| T-29 | `vehiculos.tipos.test.js` | La camioneta usa celdas de carro | `CARRO` | Correcto | Aprobado |
| T-30 | `vehiculos.tipos.test.js` | Una celda de carro admite carros y camionetas | Verdadero | Correcto | Aprobado |

### 1.2 Pruebas de integración contra MySQL (base independiente)

Archivo: `backend/test/integracion/ciclo.operativo.test.js`. Cada ejecución crea la base `autoscolombia_test_<pid>`, aplica los **11 scripts** del orden de instalación limpia, ejecuta las operaciones y **elimina la base** al terminar. No toca la base `autoscolombia`. Si MySQL o el cliente `mysql` no están disponibles, estas pruebas se **omiten** (no fallan).

| ID | Caso de prueba | Requisitos cubiertos | Resultado obtenido | Estado |
|---|---|---|---|---|
| T-31 | Esquema: los 11 scripts crean las tablas clave y los ENUM de la iteración | RF-01, RF-28 | 11 tablas clave verificadas (12 en total, incl. `sesiones_operadores`); `vehiculos.tipo` incluye `CAMIONETA`; `suscripciones.estado` sin `PENDIENTE`; tablas de la migración 011 presentes | Aprobado |
| T-32 | Entrada: asigna celda disponible y audita dentro de la transacción | RF-01, RF-02, RF-37 | Movimiento activo + evento `ENTRADA` | Aprobado |
| T-33 | Entrada: rechaza vehículo no registrado y no lo crea | RF-02 | Error «no se encuentra registrado»; 0 vehículos nuevos | Aprobado |
| T-34 | Entrada: impide el doble ingreso del mismo vehículo | RF-02 | Error «ya está parqueado» | Aprobado |
| T-35 | Salida: registra la salida, libera la celda y audita | RF-04, RF-05, RF-37 | `fecha_salida` y `operador_salida_id`; evento `SALIDA` | Aprobado |
| T-36 | Salida: rechaza cuando no existe entrada abierta | RF-05 | Error «No hay una entrada abierta» | Aprobado |
| T-37 | Entrada: exige suscripción vigente | RF-02, RF-28 | Error «no tiene una suscripción vigente» | Aprobado |
| T-38 | Suscripción: exige 30 días calendario y rechaza traslapes | RF-28 | Errores «30 días calendario» y «se cruza» | Aprobado |
| T-39 | Anulación: exige motivo y conserva la trazabilidad | RF-35, RF-37, RNF-08 | Motivo < 5 rechazado; anulación con motivo; no reanulable; evento `ANULAR` | Aprobado |
| T-40 | RF-01: una camioneta ingresa ocupando una celda tipo CARRO | RF-01 | `celdas.tipo = 'CARRO'` | Aprobado |
| T-41 | Restricción: no se registran dos vehículos con la misma placa | RNF-09 | Error «Ya existe un vehículo» (comparación sin distinguir mayúsculas) | Aprobado |
| T-42 | Atomicidad: el registro de cliente + vehículos revierte todo si un vehículo es inválido | RF-23, RNF-10, RNF-12 | Ni el cliente ni el vehículo válido persisten | Aprobado |

---

## 2. Verificaciones técnicas ejecutadas — EJECUTADAS

| ID | Verificación | Comando / medio | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-01 | Pruebas del backend | `npm test` (backend) | 52/52 aprobadas | 52 pass / 0 fail / 0 skipped | Aprobado |
| V-02 | Compilación del frontend | `npm run build` (frontend) | Compila sin errores | 29 módulos; build completado | Aprobado |
| V-03 | Análisis estático | `npm run lint` (frontend) | 0 errores | 0 errores, 14 advertencias de hooks React | Aprobado con observaciones |
| V-04 | Arranque del backend | `node src/app.js` | Sin errores | «AutosColombia API disponible en http://localhost:3001» | Aprobado |
| V-05 | Salud de la API | `GET /api/health` | `ok:true` | `{"ok":true,"mensaje":"API y MySQL conectados."}` | Aprobado |
| V-06 | Protección de rutas | `GET /api/movimientos` sin token | `401` | `HTTP 401` | Aprobado |
| V-07 | Filtro por estado (SQL real) | `listarMovimientos` contra MySQL | Coincidir con la tabla | TODOS 7 · ACTIVOS 0 · FINALIZADOS 7 · ANULADOS 0 | Aprobado |
| V-08 | Filtro por placa | `listarMovimientos({placa:'abc123'})` | Normaliza y filtra | 4 resultados, todas `ABC123` | Aprobado |
| V-09 | Orden descendente | `listarMovimientos({})` | `fecha_entrada DESC` | `true` | Aprobado |
| V-10 | Estado inválido | `listarMovimientos({estado:'INVALIDO'})` | Lanza error | «El estado del movimiento no es válido.» | Aprobado |
| V-11 | **RNF-03** Rendimiento | `npm run rendimiento:rnf03` (`frontend/e2e/rendimiento/rnf03.spec.js`) | Consulta funcional ≤ 3000 ms bajo volumen y concurrencia definidos | Historial `GET /api/movimientos?limite=200` con 400 clientes, 400 vehículos, 4.000 movimientos y 80 celdas: **p95 87,02 ms** (C1) y **249,36 ms** (C10); plan real 84,9 ms | Aprobado (banco de pruebas local) |
| V-12 | Sintaxis del backend | `node --check` sobre `src`, `scripts`, `test` | Sin errores | Correcto | Aprobado |

---

## 3. Pruebas manuales M-01…M-18 — REEJECUTADAS CON ARNÉS PLAYWRIGHT VERSIONADO

Los 18 escenarios están automatizados en `frontend/e2e/specs/` (los que tienen varios estados se dividen en subcasos). La corrida `npx playwright test --reporter=list` ejecuta **33 pruebas** contra la base efímera `autoscolombia_e2e_<pid>`, el backend de pruebas (puerto 3311) y un Vite aislado (5219); resultado de la última ejecución: **33 aprobadas / 0 fallidas / 0 omitidas**. La base real `autoscolombia` nunca se consulta: el navegador intercepta toda llamada a `localhost:3001` y la redirige al backend de pruebas.

Cada subcaso genera su propia captura en `Documentacion/Evidencias/Iteracion_2/` (**43 PNG, sin reutilizar imágenes**). Las filas siguientes conservan el resultado histórico reportado y ahora se confirman con la corrida automatizada. Ver [`13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md).

| ID | Requisito | Procedimiento (resumen) | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| M-01 | RNF-01 | Recorrer las doce secciones con la consola abierta | Sin errores en consola | 12 secciones sin errores en consola | Aprobado |
| M-02 | RF-08 | Iniciar sesión con contraseña inválida y válida | Inválida: error; válida: acceso | Rechazo con mensaje; acceso correcto | Aprobado |
| M-03 | RF-11 | Fallar la contraseña cinco veces | Cuenta bloqueada + evento | `bloqueado=1`, `intentos_fallidos=5`, evento `CUENTA_BLOQUEADA` | Aprobado |
| M-04 | RF-16…RF-21 | Crear operador; suspender con sesión activa; suspender sin sesión; reactivar | Alta ok; rechazo con sesión activa; motivo obligatorio | Rechazo «tiene una sesión activa»; suspensión y reactivación con motivo | Aprobado |
| M-05 | RF-22, RF-23 | Registrar cliente + vehículo + autorización; documento repetido; consultar | Registro ok; duplicado rechazado; consulta con mensualidad | Cliente y vehículo creados; duplicado `409` | Aprobado |
| M-06 | RF-24, RF-26, RF-27 | Registrar vehículo; placa repetida; cambiar tipo con movimiento activo; cambiar titular | Alta ok; duplicado; bloqueo de tipo; titular con historial | Los cuatro comportamientos correctos | Aprobado |
| M-07 | RF-02 | Entrada de placa no registrada | Rechazo y **no** crea vehículo | Rechazo; 0 vehículos creados | Aprobado |
| M-08 | RF-01, RF-02 | Entrada de carro (ZZT101) y camioneta (ZZT303) | Celda asignada; camioneta → celda CARRO | C01 y C02; `tipo_celda_snapshot=CARRO` | Aprobado |
| M-09 | RF-04, RF-05 | Salida de ZZT101; salida sin entrada abierta | Finaliza; segunda salida rechazada | Salida registrada; segunda rechazada | Aprobado |
| M-10 | RF-07 / HU-07 | Filtros Activos/Finalizados/Anulados/Todos + búsqueda por placa | Conteos y orden descendente correctos | Coincide con BD; búsqueda «ZZT» solo coincidencias | Aprobado |
| M-11 | RF-37 | Auditoría filtrada por entidad MOVIMIENTO | Filas ENTRADA y SALIDA con operador | Eventos ENTRADA y SALIDA con operador | Aprobado |
| M-12 | RF-35, RF-36 | Corregir un movimiento abierto y luego anularlo con motivo | Actualiza sin borrar; anula conservando motivo | Corrección ok; anulación con motivo; registro conservado | Aprobado |
| M-13 | RF-30…RF-34 | Crear celda; modificar; bloquear; desbloquear; ver historial | Cada acción registrada con valores anterior/nuevo | 4 eventos de historial para Z99 | Aprobado |
| M-14 | RF-28, RF-29 | Suscripción 30 días; solapamiento; modificar fecha; vencimiento | Creada; rechazada; recalculada; pasa a VENCIDA | Correcto; estado final `VENCIDA` | Aprobado |
| M-15 | RF-06 | Panel principal vs. base de datos | Totales y ocupación coherentes | Los 4 indicadores del panel coinciden con la base efímera (capacidad, vehículos dentro, celdas libres y movimientos) | Aprobado |
| M-16 | RNF-11 | Ingresar como operador; abrir clientes; invocar ruta admin | Sin menús admin; botones deshabilitados; `403` | 6 ítems de menú; botón deshabilitado; `403` | Aprobado |
| M-17 | RF-10, RF-13 | Operador sin contraseña; ingreso con temporal; desbloquear cuenta | Cambio obligatorio; desbloqueo emite temporal | Cambio forzado verificado; desbloqueo con nueva temporal | Aprobado |
| M-18 | RF-12 | Solicitar recuperación (documento existente/inexistente); restablecer con el enlace de consola | Respuesta equivalente; enlace restablece y desbloquea | Anti-enumeración ok; restablecimiento ok (**envío real no probado**) | Aprobado con observación |

Consulta de apoyo para M-11:

```sql
SELECT accion, entidad, operador_id, fecha_hora
FROM auditoria_eventos
WHERE entidad = 'MOVIMIENTO'
ORDER BY fecha_hora DESC;
```

> **M-18 (RF-12):** el flujo completo (solicitud → token → restablecimiento → auditoría) se verificó con el enlace generado en modo `MAIL_PROVIDER=consola`. El **envío real del correo no se declara probado** porque depende de la configuración de un proveedor SMTP/API externo (ver `11_Informe_Final_Iteracion2.md`, sección RF-12).

---

## 4. Resumen de resultados

| Categoría | Total | Aprobados | Con observaciones | Pendientes |
|---|---|---|---|---|
| Pruebas automatizadas | 52 | 52 | 0 | 0 |
| Verificaciones técnicas | 12 | 11 | 1 (V-03) | 0 |
| Pruebas manuales M-01 a M-18 | 18 | 18 automatizadas | 1 (M-18, envío real de correo) | 0 |
| Pruebas E2E del arnés Playwright | 33 | 33 | 0 | 0 |
| Benchmark RNF-03 (V-11) | 1 | 1 | 0 | 0 |

> Nota: la advertencia de V-03 corresponde a reglas de estilo de React (`react-hooks/exhaustive-deps`, `set-state-in-effect`) presentes en el patrón de los componentes; no son errores ni regresiones funcionales. La observación de M-18 no es un fallo: el flujo se ejecutó completo; únicamente el envío real de correo queda pendiente de configurar el proveedor.
>
> **Alcance del benchmark V-11:** las cifras provienen de un banco de pruebas local (equipo del desarrollador, MySQL 8.4, backend en 3311, base efímera) con datos sintéticos; no acreditan rendimiento en producción ni en un entorno EA2 con datos reales. Comando y reporte: `npm run rendimiento:rnf03` → `frontend/e2e/.artifacts/rnf03-rendimiento.json`.

### 4.1 Condiciones del benchmark RNF-03 (H-08)

| Condición | Definición aplicada |
|---|---|
| Consulta evaluada | `GET /api/movimientos?limite=200` (historial de movimientos: 4 JOIN, `ORDER BY fecha_entrada DESC, id DESC`, `LIMIT`); es la lectura más costosa de la operación diaria |
| Consultas de referencia | `GET /api/dashboard` (concurrencia 1) y el evento de auditoría |
| Volumen de datos | 400 clientes, 400 vehículos, 400 suscripciones, **4.000 movimientos finalizados**, 4.000 eventos de auditoría, 80 celdas del esquema |
| Concurrencia | 1 (secuencial, 50 iteraciones) y 10 (5 lotes × 10 peticiones paralelas) |
| Calentamiento | 5 peticiones descartadas |
| Percentil | p50, p95 y máximo; el criterio de aceptación se evalúa sobre **p95** |
| Tiempo de API | Medido en el cliente entre el envío y la respuesta de cada petición |
| Tiempo de SQL | `EXPLAIN ANALYZE` de la consulta del historial (tiempo real del plan, sin caché de resultado de la API) |
| Entorno | Equipo local del desarrollador; MySQL 8.4.13; Node 24; backend de pruebas en 3311; base efímera `autoscolombia_e2e_<pid>` (nunca la base real) |
| Límite EA2 | 3.000 ms por consulta, según RNF-03 |
| Resultado | p95 87,02 ms (C1) · p95 249,36 ms (C10) · p50 72,23 ms (C1) / 213,38 ms (C10) · SQL 84,9 ms → **dentro del límite** |
