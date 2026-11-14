# Informe de Correcciones Post-Auditoría EA2 — AutosColombia

**Fecha:** 2026-11-13 (actualizado tras cerrar el arnés E2E M-01…M-18 y el benchmark RNF-03)
**Rama:** `Iteracion_2`
**Base académica:** `Grupo03_Iteracion_2_EA2`
**Dictamen:** **No listo para cierre/publicación**. Las correcciones locales principales pasan la suite automatizada, el arnés E2E y el benchmark de rendimiento, pero siguen abiertos controles críticos de producción y evidencias exigidas para la entrega.

> **Vigencia:** este informe es un antecedente intermedio. El dictamen de cierre vigente, con las cifras definitivas y el estado final de cada hallazgo, está en [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md).

## 1. Alcance y restricciones

Se continuó sobre los cambios locales existentes sin cambiar de rama. No se hicieron commits, push, merge ni cambios en `main`. No se ejecutaron migraciones ni escrituras en la base real `autoscolombia`; la consulta de datos y privilegios fue de solo lectura. Las migraciones 002–011 se probaron únicamente en las bases temporales creadas y eliminadas por las suites: `autoscolombia_test_<pid>` (pruebas del backend) y `autoscolombia_e2e_<pid>` (arnés E2E y benchmark).

Este informe supersede los porcentajes y la declaración de cierre de [`11_Informe_Final_Iteracion2.md`](11_Informe_Final_Iteracion2.md) y [`14_Acta_Cierre_Iteracion2.md`](14_Acta_Cierre_Iteracion2.md). Las pruebas manuales que esos documentos presentan como aprobadas quedan ahora cubiertas por el arnés automatizado `frontend/e2e/`, no por la ejecución previa no reproducible.

## 2. Correcciones implementadas

| ID | Hallazgo / requisito | Estado y cambio | Ubicación, endpoint o componente | Prueba |
|---|---|---|---|---|
| C-01 | Alta de cliente no atómica (RF-23, RNF-10/12) | Las rutas de alta canónica y transicional comparten el registro atómico cliente + vehículos + consentimiento. | `backend/src/routes/clientes.routes.js`; `clientes.service.js`; `POST /api/clientes/registro` y `POST /api/clientes` | Integración `RF-23` y rollback por vehículo inválido en `backend/test/integracion/ciclo.operativo.test.js` |
| C-02 | Campos obligatorios (RF-16/23/24) | Backend valida operador, cliente y atributos esenciales del vehículo; formularios marcan los campos exigidos. Nombres y apellidos quedan separados para altas nuevas; no se hizo backfill de históricos. | `backend/src/validators/gestion.js`; servicios de operadores/clientes/vehículos; componentes `Operadores.jsx`, `Clientes.jsx`, `Vehiculos.jsx` | `backend/test/gestion.validation.test.js`; integración MySQL |
| C-03 | Consentimiento ambiguo (RNF-12) | Se eliminó `Boolean("false") === true`: el normalizador acepta booleanos y representaciones inequívocas; valores ambiguos responden 400. La cadena `"false"` impide crear registros. | `normalizarAutorizacionDatos()` en `backend/src/validators/gestion.js`; `clientes.service.js` | Test unitario de valores afirmativos/falsos/ambiguos y test de integración que verifica cero clientes/vehículos |
| C-04 | Restricciones e históricos (RNF-02/07/09) | Migraciones 009–010 crean triggers append-only, preflight, `NOT NULL` y CHECK de 30 días. Su operación pasó en base aislada; no se aplicaron a producción. | `backend/sql/migrations/009_historicos_append_only.sql`; `010_integridad_campos_ea2.sql` | Integración MySQL: idempotencia, rechazo de UPDATE/DELETE, campos requeridos y período |
| C-05 | Acciones duplicadas en historial (RF-35/36) | Las acciones se muestran una sola vez por movimiento: fila Entrada o Anulación, no también en la fila Salida. Se conservan el rol administrador y las guardas del backend. | `frontend/src/App.jsx`, `MovimientosTabla` | Build y lint; validación gráfica en M-12 (`frontend/e2e/specs/14-auditoria-movimientos.spec.js`) |
| C-06 | Acceso a Mi cuenta (RF-10) | Se verificó por inspección que el menú de perfil abre el modal de cuenta y no hay acceso independiente en el sidebar. No se rehízo el componente. | `frontend/src/App.jsx`; `Cuenta.jsx` | Inspección de código y M-16 (menú por perfil). El modal de cuenta aún no está cubierto por el arnés |

## 3. Investigación de `suscripciones.id=1`

La fila real permanece intacta. La consulta de solo lectura confirmó un período del `2026-11-04` al `2027-11-03`, es decir, 365 días calendario inclusivos. No hay eventos asociados en `auditoria_eventos`, en `auditoria_eventos_backup_dep_20261113` ni en `auditoria_rectificaciones_texto`; tampoco hubo eventos de autenticación en la ventana de creación. El log general está desactivado.

El binlog local retenido sí conserva la secuencia:

- `2026-11-04 00:05:03`: inserción de `id=1`, `vehiculo_id=2`, fechas `2026-11-04` a `2027-11-03`; el estado era `PENDIENTE`.
- `2026-11-04 00:08:30`: el estado pasó de `PENDIENTE` a `ACTIVA`.
- La definición histórica del `ENUM` en esa instalación era `PENDIENTE/ACTIVA/VENCIDA/CANCELADA`. La migración 006 traduce `ACTIVA` a `VIGENTE`, estado actual.

Esto aporta fecha y secuencia, pero **no identifica el usuario, la herramienta ni la intención contractual**. El cambio es compatible con la activación al comenzar el período, pero esa causa no queda demostrada. La fila sigue fuera de la regla EA2 de 30 días. No corregirla ni cancelar sin autorización administrativa; no ejecutar la migración 010 en `autoscolombia` hasta conciliarla y validar el resto del preflight.

## 4. Verificaciones ejecutadas

| Verificación | Resultado | Alcance |
|---|---|---|
| `backend`: `npm test` | **52/52 aprobadas**, 0 fallidas, 0 omitidas | Última ejecución: 2026-11-13; MySQL 8.4.13; integración contra `autoscolombia_test_<pid>`; esquema y migraciones 002–011; incluye revocación auditada de consentimiento |
| `frontend`: `npm run build` | Correcto, 29 módulos | Compilación de producción |
| `frontend`: `npm run lint` | **0 errores**, 14 advertencias de hooks React | Análisis estático |
| Migraciones 009–010 | Aprobadas en base temporal | Idempotencia, triggers, `NOT NULL`, CHECK y rechazo del preflight cuando corresponde |
| Base `autoscolombia` | Sin escrituras | Lecturas de fila ID 1, fuentes de auditoría, binlog y grants |
| `frontend`: `npx playwright test` (E2E M-01…M-18) | **33/33 aprobadas**, 0 fallidas, 0 omitidas | Arnés versionado `frontend/e2e/`; base efímera `autoscolombia_e2e_<pid>`, backend 3311, Vite 5219; 43 capturas |
| `frontend`: `npm run rendimiento:rnf03` | **1/1 aprobada** | Historial con 400 clientes, 400 vehículos y 4.000 movimientos: p95 87,02 ms (C1) y 249,36 ms (C10); p50 72,23/213,38 ms; SQL 84,9 ms; bajo el límite de 3.000 ms |
| Interfaz en navegador | Ejecutada en entorno aislado | Solo contra la base efímera; el navegador redirige toda llamada a `localhost:3001` al backend de pruebas |

## 5. Matriz de cumplimiento post-auditoría

| ID | Descripción | Estado | Archivo / función | Endpoint / componente | Prueba o evidencia |
|---|---|---|---|---|---|
| H-01 / RF-23 | Ambas rutas de alta usan invariantes y transacción común | Corregido en código | `clientes.service.js`·`registrarClienteConVehiculos` | `POST /api/clientes`, `POST /api/clientes/registro` | Integración de rechazo y rollback |
| H-02 / RF-16, 23, 24 | Campos requeridos en validadores y UI | Corregido para nuevas operaciones; históricos no saneados | `validators/gestion.js`; servicios de gestión | Operadores, Clientes, Vehículos | Pruebas unitarias e integración; 010 valida en DB temporal |
| H-03 / RF-28, RNF-09 | Suscripción ID 1 de 365 días | **Pendiente de decisión y conciliación** | Tabla real `suscripciones`; migración 010 | Módulo Suscripciones | Binlog confirma INSERT/UPDATE, no el actor; preflight de producción no ejecutado |
| H-04 / RF-37, RNF-07 | Auditoría append-only y mínimo privilegio | **Bloqueante de seguridad** | Migración 009; `backend/src/config/database.js` | Conexión MySQL de runtime | Triggers probados en DB temporal; `SHOW GRANTS` muestra `root@localhost` con privilegios globales, incluidos UPDATE, DELETE, DROP, FILE y GRANT OPTION |
| H-05 / RNF-02/09/10 | Integridad desde el motor y transacciones | Implementado y probado en DB temporal; despliegue real bloqueado | Migración 010 y servicios transaccionales | Tablas operadores/clientes/vehículos/suscripciones | Integración SQL directa; falta conciliación de históricos en base real |
| H-06 | Historias, matriz y cierre coherentes con EA2 | **Parcial** | Documentos 00–16 | Matrices y acta | Se corrigieron afirmaciones de cierre; falta completar/validar HU-01…HU-38 y actualizar trazabilidad detallada |
| H-07 | Reproducción manual M-01…M-18 | **Corregido: 18/18 automatizados y 33/33 en verde** | Arnés Playwright versionado en `frontend/e2e/` (`npx playwright test`) | UI completa | Base efímera `autoscolombia_e2e_<pid>`, backend 3311 y Vite 5219; 43 capturas únicas en `Documentacion/Evidencias/Iteracion_2/` |
| H-08 / RNF-03 | Rendimiento funcional ≤ 3 s | **Medido con benchmark representativo** | `frontend/e2e/rendimiento/rnf03.spec.js` (`npm run rendimiento:rnf03`) | Historial `GET /api/movimientos?limite=200` con 400 clientes, 400 vehículos y 4.000 movimientos | p95 87,02 ms (C1) y 249,36 ms (C10); plan real 84,9 ms. Condiciones y alcance limitado al banco de pruebas local en `09_Matriz_Pruebas.md` §4.1 |
| H-09 / RF-35/36 | Acciones repetidas por cada evento Entrada/Salida | Corregido en código y validado en navegador | `frontend/src/App.jsx`·`MovimientosTabla` | Historial de movimientos | Build/lint y M-12: corrección y anulación ejecutadas desde las acciones de la fila del historial |
| H-10 | Publicación y sincronización Git | **Pendiente de autorización** | Rama `Iteracion_2` | Git remoto | No hubo checkout, commit, push ni merge |
| RF-12 | Envío externo de recuperación por correo | Lógica local conservada; integración externa pendiente | `correo.service.js`; configuración de entorno | Recuperación | No se configuró SMTP/API ni se declaró envío real |

## 6. Pendientes que impiden declarar cierre

1. Definir con el responsable de datos la intención de la suscripción ID 1. Toda corrección debe preservar valor anterior/nuevo, motivo y actor; no modificarla en esta fase.
2. Separar la cuenta MySQL de runtime de la cuenta de migraciones. La configuración inspeccionada utiliza `root@localhost` con privilegios globales; no se cambiaron credenciales ni grants.
3. ~~Preparar un entorno UI aislado con base sintética, versionar el arnés y reejecutar M-01…M-18 con capturas únicas.~~ **Resuelto:** el arnés está versionado en `frontend/e2e/`, corre sobre base efímera y produjo 33/33 con 43 capturas únicas. Falta únicamente decidir si el modal de cuenta (C-06) se incorpora al arnés.
4. ~~Definir dataset, concurrencia, percentil y consulta para medir RNF-03.~~ **Resuelto:** condiciones y resultado en `09_Matriz_Pruebas.md` §4.1 (historial con 400 clientes, 400 vehículos y 4.000 movimientos: p95 87,02 ms en C1 y 249,36 ms en C10; SQL 84,9 ms). Queda como limitación declarada que la medición es de banco local, no de producción.
5. Completar historias HU-01…HU-38 y la trazabilidad RF/HU → archivo, endpoint, componente, tabla, prueba y evidencia; recalcular la matriz sin contar pruebas reportadas como ejecutadas en esta fase.
6. Repetir build, lint, suite y revisiones de seguridad después de esos cambios. Mantener `Iteracion_2`; no publicar hasta autorización expresa.

## 7. Dictamen

Las correcciones de validación, transacción de altas y duplicidad de acciones están implementadas; la suite automatizada (52/52), el arnés E2E M-01…M-18 (33/33 sobre base efímera con 43 capturas únicas) y el benchmark RNF-03 (p95 94,3 ms en concurrencia 1 y 219,1 ms en concurrencia 10, frente a un límite de 3.000 ms) pasan en entorno MySQL aislado; las migraciones se validaron en base temporal. Aun así, no procede declarar cumplimiento total: el runtime tiene privilegios de `root`, la suscripción real incumple la duración de 30 días y no puede atribuirse su origen, la medición de rendimiento es de banco local y no de producción, el envío real de correo de RF-12 sigue sin proveedor y faltan las historias HU-01…HU-38 con su trazabilidad. La rama sigue local y sin publicar.
