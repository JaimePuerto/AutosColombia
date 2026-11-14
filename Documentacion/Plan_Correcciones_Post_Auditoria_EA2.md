# Plan de correcciones post-auditoría EA2 — AutosColombia

- **Fecha de análisis:** 2026-11-13
- **Base de análisis:** `Documentacion/15_Auditoria_Final_Cumplimiento_EA2_2026-11-13.md` y EA2 original en `C:\Users\ADMINISTRADOR\Downloads\Grupo03_Iteracion_2_EA2.docx`
- **Rama observada:** `Iteracion_2`
- **Modo de trabajo:** análisis y planificación únicamente. No se modificaron archivos existentes, código, configuraciones, base de datos ni migraciones. No se ejecutaron pruebas que escriban datos.

> **Seguimiento de ejecución:** después de este plan se implementaron correcciones locales para alta transaccional, campos obligatorios, consentimiento y acciones del historial. Una ejecución intermedia pasó 51/51; la última ejecución pasó **52/52 pruebas** en base temporal, tras añadir la verificación de revocación auditada del consentimiento. El rastro adicional de la suscripción ID 1 y los pendientes vigentes se documentan en [`16_Informe_Final_Correcciones_EA2.md`](16_Informe_Final_Correcciones_EA2.md). Este plan conserva su contenido como propuesta inicial y no describe por sí solo el estado final.

## 1. Resumen ejecutivo

La implementación tiene cobertura funcional amplia, pero conviene tratar como bloqueantes de cierre los flujos que permiten omitir consentimiento/campos obligatorios, la mensualidad irregular, la falta de protección append-only para auditoría y las restricciones que aún dependen exclusivamente del servicio.

Este documento convierte los diez hallazgos del informe en acciones futuras con dependencias, pruebas de aceptación y decisiones explícitas. No autoriza ni ejecuta esas acciones. El único archivo nuevo de esta actividad es este plan.

La lectura controlada de `autoscolombia` identificó la mensualidad **ID 1**, estado `VIGENTE`, inicio `2026-11-04`, vencimiento `2027-11-03`: **365 días calendario** contando ambas fechas. La fila no se modificó ni se leyeron datos del cliente/vehículo. La regla EA2 para HU-28/RF-28 es vencimiento igual a fecha de inicio más 29 días, es decir, 30 días calendario.

## 2. Hallazgos y prioridades

| ID | Prioridad | Hallazgo | Requisitos | Complejidad | Dependencia clave |
|---|---|---|---|---|---|
| H-01 | P1, bloquea cumplimiento | `POST /api/clientes` permite alta sin vehículo ni autorización | RF-23, RNF-10/12, HU-23 | Alta | Decidir compatibilidad del endpoint |
| H-02 | P1, bloquea cumplimiento | Los campos obligatorios de operador, cliente y vehículo no coinciden con EA2 | RF-16/23/24, HU-16/23/24 | Alta | Definir el modelo de nombres y depurar datos |
| H-03 | P1, corregir dato antes de cerrar | Suscripción vigente ID 1 dura 365 días | RF-28, RNF-09, HU-28 | Media | Confirmar contrato/origen de la fila |
| H-04 | P1, control de seguridad | Auditoría sin garantía append-only comprobada | RF-37, RNF-07, HU-37 | Alta | Diseñar identidades y grants de despliegue |
| H-05 | P1/P2, reforzar integridad | Restricciones de filas/cross-row incompletas en MySQL | RF-16/23/24/28/37, RNF-02/07/09/10, HU relacionadas | Alta | H-02/H-03 y prevalidación de datos |
| H-06 | P2, bloquea consistencia documental | Historias y trazabilidad incompletas/incompatibles con EA2 | RF/HU-01…38 | Media | Cerrar nomenclatura/estados técnicos |
| H-07 | P2, bloquea evidencia reproducible | Capturas y pruebas manuales no son íntegramente distinguibles/reproducibles | RF/HU-01…38, RNF-01/03 | Media | Harness Playwright y datos de prueba aislados |
| H-08 | P2 | RNF-03 no tiene medición representativa | RNF-03 | Media | Definir volumen, concurrencia y entorno |
| H-09 | P3, mejora UX | Acciones repetidas para un movimiento que aparece como entrada y salida | RF-35/36, HU-35/36 | Baja | Confirmar diseño de historial |
| H-10 | P1 de publicación | `Iteracion_2` no está publicada/sincronizada y hay cambios locales | Preparación de entrega | Media | Revisión y autorización expresa de publicación |

**Prioridades:** P1 = criterio de aceptación/publicación bloqueado; P2 = debe resolverse antes del cierre documental; P3 = mejora de claridad que no compromete por sí sola la integridad del backend.

**Estado de ejecución (2026-11-13):**

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H-01, H-02, H-05 | Resueltos en código; despliegue a base real pendiente de conciliación | Rutas/servicios transaccionales; migraciones 008–010 probadas en base temporal |
| H-07 | **Resuelto** | Arnés Playwright versionado (`frontend/e2e/`): 33/33 pruebas y 43 capturas únicas |
| H-08 | **Resuelto** | Benchmark `frontend/e2e/rendimiento/rnf03.spec.js`; condiciones y resultado en `09_Matriz_Pruebas.md` §4.1 |
| H-09 | **Resuelto** | Validación gráfica en M-12 desde las acciones del historial |
| H-03, H-04, H-06, H-10 | **Abiertos** | Suscripción ID 1 sin conciliar; runtime con `root`; HU-01…HU-38 y trazabilidad pendientes; rama sin publicar |

## 3. Propuesta detallada para cada hallazgo

### H-01. Alta de cliente que elude RF-23/RNF-12

- **EA2 / HU afectados:** RF-23 y RNF-10/RNF-12; HU-23.
- **Archivos/tablas actuales:** `backend/src/routes/clientes.routes.js`; `backend/src/services/clientes.service.js`; `frontend/src/components/Clientes.jsx`; tablas `clientes`, `vehiculos`, `auditoria_eventos`.
- **Situación:** la UI normal usa `POST /api/clientes/registro`, que exige al menos un vehículo, autorización afirmativa y realiza cliente+vehículo(s)+auditoría en transacción. La ruta también expone `POST /api/clientes`, que llama `crearCliente()`: exige tipo/documento/nombre, acepta contacto vacío, puede registrar `autorizacion_datos=false` y no exige vehículo. Ambas rutas requieren autenticación, pero el middleware global no hace que el flujo simple sea conforme.
- **Causa:** dos contratos de creación distintos quedaron publicados; `crearCliente()` no comparte las invariantes del servicio transaccional.
- **Riesgo:** se almacenan clientes sin vehículo o sin autorización/fecha, se elude el “todo o nada” y se amplía el tratamiento de datos sin evidencia de consentimiento. La pantalla principal no evita llamadas directas al endpoint.
- **Recomendación:** no borrar la ruta ni cambiar silenciosamente su contrato. Primero inventariar consumidores (frontend, scripts, integraciones y logs disponibles). Mantener `POST /api/clientes` como ruta transicional y la envoltura/respuesta actuales, pero dirigirla a la operación canónica transaccional. Aceptar el payload antiguo solo cuando incluya los datos requeridos, vehículo(s) y autorización; de lo contrario responder 400/422 con código y mensaje de migración, sin insertar nada. Documentar deprecación y fecha/versión de retiro solo tras conocer consumidores. Mantener `POST /api/clientes/registro` como endpoint canónico durante la transición.
- **Archivos futuros:** `clientes.routes.js`, `clientes.service.js`, `Clientes.jsx`, contrato OpenAPI/README de API si existe; pruebas de rutas/servicio.
- **Efectos secundarios:** consumidores antiguos que registren solo un cliente pasarán a recibir rechazo; preservar path y envelope no preserva el comportamiento semántico. La migración debe anunciarse y ofrecer el payload de reemplazo.
- **Prueba de aceptación:** para admin y operador autenticados, `POST /api/clientes` con payload incompleto responde 400/422 y deja 0 filas nuevas en clientes, vehículos y auditoría; con payload completo crea cliente, mínimo un vehículo, autorización y auditoría atómicamente. Forzar fallo en el vehículo demuestra rollback de todo. Repetir por `POST /api/clientes/registro` y comprobar la misma regla.
- **Prioridad / complejidad:** P1 / alta. Depende de H-02 para el contrato final de campos y de H-05 para endurecer la base.

### H-02. Datos requeridos inconsistentes entre EA2 y las capas

- **EA2 / HU afectados:** RF-16/HU-16; RF-23/HU-23; RF-24/HU-24.
- **Archivos/tablas actuales:** `frontend/src/components/Operadores.jsx`, `Clientes.jsx`, `Vehiculos.jsx`; `backend/src/routes/operadores.routes.js`, `clientes.routes.js`, `vehiculos.routes.js`; `backend/src/services/operadores.service.js`, `clientes.service.js`, `vehiculos.service.js`; validadores; `operadores`, `clientes`, `vehiculos`; migraciones 002/003/005.
- **Situación por capa:**
  - **Operador, EA2:** nombres, apellidos, documento, email y teléfono obligatorios; contraseña temporal y estado activo.
  - **UI operador:** `nombre` y documento tienen `required`; apellidos/email/teléfono no.
  - **Servicio operador:** valida únicamente nombre/documento como presencia; email solo se valida si existe. Apellidos, email y teléfono se normalizan a `NULL`.
  - **MySQL operador:** documento/email y campos de contacto/apellidos son anulables en el esquema actual (documento fue añadido por migración 002 como `NULL`); hay unicidad, pero `UNIQUE` permite varios `NULL`.
  - **Cliente, EA2:** documento, nombres, apellidos, email y teléfono obligatorios.
  - **UI cliente:** exige tipo, tipo/número de documento y un único `nombre_razon_social`; email/teléfono son opcionales. No separa nombres de apellidos.
  - **Servicio cliente:** `validarCliente()` exige tipo de cliente, tipo/número de documento y `nombre_razon_social`; permite teléfono/correo vacíos.
  - **MySQL cliente:** documento y `nombre_razon_social` son `NOT NULL`; teléfono/correo aceptan `NULL`. El modelo no tiene columnas separadas de nombres/apellidos.
  - **Vehículo, EA2:** placa válida, tipo, color, marca y modelo obligatorios.
  - **UI de alta cliente y vehículo:** placa/tipo son señalados como obligatorios; marca/modelo/color no lo son. El consentimiento se valida mediante lógica del formulario.
  - **Servicio vehículo:** `validarDatosVehiculo()` valida tipo, formato de placa y cliente. `marca`, `modelo` y `color` se insertan como `NULL` cuando no se envían.
  - **MySQL vehículo:** placa/tipo son `NOT NULL`; marca/modelo/color son anulables. `cliente_id` también es anulable pese a existir FK.
- **Causa:** se priorizó la nulabilidad para compatibilidad con datos heredados, y la validación quedó incompleta en frontend y servicio. La base usa `nombre_razon_social` para cubrir personas y empresas en un único campo, mientras EA2 enumera nombres y apellidos.
- **Riesgo:** datos incompletos por API directa, informes/consultas sin contacto suficiente, aceptación académica incorrecta y nuevos `NULL` que después impedirían `NOT NULL`.
- **Recomendación:** acordar primero el modelo de persona/empresa. Para persona natural añadir campos `nombres` y `apellidos` o aprobar formalmente un mapeo equivalente; no dividir automáticamente cadenas heredadas. Definir regla para empresa (razón social, y si contacto se modela aparte). Luego aplicar un esquema de validación compartido en frontend y backend, conservando la validación de servicio como autoridad. Agregar `NOT NULL`/CHECK únicamente después de inventariar, depurar y respaldar registros existentes.
- **Archivos futuros:** componentes mencionados, servicios/validadores/rutas, esquema/migraciones aditivas, `.env.example` solo si se separan cuentas para migraciones y runtime, diccionario y pruebas.
- **Efectos secundarios:** edición de datos históricos, cambios en respuestas/formularios y rechazo de clientes/vehículos previamente aceptados; separar nombres puede requerir adaptación de listado, búsquedas, exportes y reportes.
- **Prueba de aceptación:** para cada perfil, probar el formulario y enviar requests HTTP directas con cada campo faltante, vacío o inválido; todos deben rechazarse sin escrituras parciales. Datos completos deben persistirse y leerse sin pérdida. Ejecutar preflight de `NULL`/duplicados antes de activar restricciones.
- **Prioridad / complejidad:** P1 / alta. Depende de H-01 para el payload de registro conjunto y precede a H-05.

### H-03. Mensualidad de 365 días en una regla de 30 días

- **EA2 / HU afectados:** RF-28, RNF-09 y HU-28.
- **Archivos/tablas actuales:** `backend/src/services/suscripciones.service.js`; `suscripciones`; `backend/sql/schema.sql` y futura migración aditiva de restricción; `auditoria_eventos`.
- **Registro identificado (solo metadatos funcionales):** `suscripciones.id=1`, `estado=VIGENTE`, `fecha_inicio=2026-11-04`, `fecha_fin=2027-11-03`, 365 días calendario inclusivos. Para el mismo inicio, EA2 esperaría `2026-12-03`.
- **Situación/causa:** `crearSuscripcion()` actual valida `fecha_fin = fecha_inicio + 29 días`, además de inicio no pasado y no traslape. La fila no pudo generarse por el flujo actual tal como está escrito. No se inspeccionó el historial JSON ni se puede atribuir el origen: posibilidades no comprobadas son dato de prueba/legado, inserción SQL administrativa anterior, comportamiento de otra versión o una intención anual que no corresponde al alcance de EA2.
- **Riesgo:** acceso autorizado por un año bajo una regla de mensualidad de 30 días; inconsistencias de vencimiento, panel y evidencia; un CHECK nuevo fallaría mientras exista la fila.
- **Recomendación:** no actualizarla automáticamente. Confirmar con soporte/contrato si fue error o intención anual. Si es error y se confirma que el inicio correcto es el registrado, corregir por una operación administrativa auditada que guarde fecha/vencimiento anterior y nuevo, motivo y actor; el vencimiento propuesto por EA2 sería `2026-12-03`. Si fue una alta anual intencional, no reetiquetarla como mensual: dejar constancia y pedir decisión sobre cancelación/reemplazo mensual auditado o cambio formal del requisito/modelo. No usar UPDATE manual sin auditoría.
- **Archivos futuros:** `suscripciones.service.js` solo si se requiere comando administrativo trazable; rutas/UI de suscripciones; migración posterior de CHECK; pruebas de integración; informe de conciliación. La fila no se tocó en esta actividad.
- **Efectos secundarios:** acortar una vigencia puede impedir accesos después de la nueva fecha; cancelarla puede alterar reportes y consultas. Un CHECK se debe desplegar solo después de resolver y validar todos los históricos.
- **Prueba de aceptación:** conservar evidencia antes/después con ID interno, motivo/actor y evento auditoría; confirmar duración inclusiva 30, estado correcto, consulta por placa y rechazo de períodos de 29/31/365 días. Verificar no traslape bajo dos altas concurrentes.
- **Prioridad / complejidad:** P1 / media. H-03 precede a H-05 y a declarar RF-28 cerrado.

### H-04. Inmutabilidad de auditoría no garantizada

- **EA2 / HU afectados:** RF-37, RNF-07 y HU-37.
- **Archivos/tablas actuales:** `backend/src/services/auditoria.service.js`; `backend/src/config/database.js`; `auditoria_eventos`, `auditoria_autenticacion`, `historial_celdas`, `auditoria_rectificaciones_texto`; credenciales de despliegue/migración.
- **Situación:** el servicio inserta valores anteriores/nuevos y consulta eventos; no se observó endpoint de edición/borrado ni trigger MySQL. La auditoría no verificó los grants del usuario efectivo. `RESTRICT` protege referencias FK, pero no impide UPDATE/DELETE por una cuenta con privilegios suficientes.
- **Causa:** la conexión de aplicación no está documentada como identidad de privilegio mínimo y la inmutabilidad se confía principalmente al código.
- **Riesgo:** una operación directa o vulnerabilidad podría alterar o borrar evidencia; un usuario con privilegios de despliegue/DBA puede eludir controles SQL locales.
- **Recomendación compatible con MySQL actual:**
  1. Separar usuario de runtime de una cuenta administrativa/migración; las credenciales DDL no deben estar en el proceso web.
  2. Otorgar a runtime solo los privilegios DML necesarios por tabla. En las tablas de auditoría permitir `SELECT` e `INSERT`, negar `UPDATE` y `DELETE`, y evitar grants globales que anulen la separación.
  3. Mantener escritura de evento dentro de la misma transacción de negocio; guardar actor, fecha del servidor, acción, entidad/ID y valores anterior/nuevo.
  4. Excluir contraseñas, hashes, tokens, secretos y datos personales innecesarios de los JSON de auditoría.
  5. Considerar triggers `BEFORE UPDATE/DELETE` que fallen explícitamente como defensa en profundidad, no como control principal. Los triggers no protegen frente a un administrador que pueda quitarlos.
  6. Si el riesgo incluye al DBA, exportar a almacenamiento externo de solo anexado/WORM con retención y acceso separados.
- **Archivos futuros:** `backend/src/config/database.js`, `.env.example`, documentación de despliegue, script de grants/migración y, si se aprueba, triggers en migración versionada; `auditoria.service.js` solo para robustecer campos/redacción.
- **Efectos secundarios:** permisos de runtime demasiado estrechos pueden romper migraciones o funcionalidades si se reutiliza una única identidad. Se requiere separar conexión de migración de conexión web y administrar rotación de credenciales.
- **Prueba de aceptación:** con cuenta runtime real, INSERT y SELECT de auditoría funcionan; UPDATE y DELETE directos retornan `ER_TABLEACCESS_DENIED_ERROR`; flujos transaccionales registran su evento; cuentas de migración pueden ejecutar DDL bajo procedimiento controlado; confirmar SHOW GRANTS y probar que el test no emplea credenciales de producción.
- **Prioridad / complejidad:** P1 / alta. Depende de una decisión de despliegue/operación; debe preceder la declaración de RNF-07.

### H-05. Restricciones de integridad insuficientes en MySQL

- **EA2 / HU afectados:** RF-16/23/24/28/37; RNF-02/07/09/10; HU-16/23/24/28/37.
- **Archivos/tablas actuales:** `backend/sql/schema.sql`; migraciones `002`–`007`; `operadores`, `clientes`, `vehiculos`, `suscripciones`, `movimientos`, históricos y auditoría.
- **Situación/causa:** varias reglas son validaciones de servicio y columnas siguen anulables. MySQL ya proporciona FKs, unicidad de documentos/placas/celdas, columnas generadas para un movimiento activo por vehículo/celda y CHECK de fechas de movimiento, pero no exactamente 30 días, administrador activo ni append-only. El traslape y el último administrador son reglas entre filas, no CHECK de una fila.
- **Recomendación por regla:**
  - **Documentos:** `NOT NULL`, normalización de espacios/mayúsculas y UNIQUE sobre clave canónica. Antes, detectar/corregir vacíos y colisiones; conservar formato mostrado separado de la clave normalizada.
  - **Relación vehículo-cliente:** mantener FK `ON DELETE RESTRICT`; convertir `vehiculos.cliente_id` a `NOT NULL` solo tras backfill/confirmación de que cada vehículo debe tener cliente. La consulta anterior encontró 0 nulos, pero repetir preflight al implementar.
  - **Período:** CHECK row-local `DATEDIFF(fecha_fin,fecha_inicio)=29` cuando se haya resuelto H-03 y depurado históricos. El traslape es cross-row: conservar servicio transaccional que bloquea el vehículo y probar concurrencia; no intentar imponerlo con CHECK.
  - **Administrador activo:** conservar regla en servicio/transacción y serializar todas las altas/bajas/cambios de rol de administradores mediante bloqueo común (por ejemplo, bloquear la colección de admins o una fila de control). Un CHECK no puede contar administradores.
  - **Movimientos:** mantener FKs y UNIQUE de columnas generadas; conservar CHECK de salida no anterior a entrada. Evaluar CHECK de coherencia salida/operador/anulación y evitar borrado físico mediante privilegios/soft delete.
  - **Históricos/auditoría:** conservar FK con `RESTRICT`, sin cascadas de borrado; runtime no debe poder borrar y las tablas de auditoría deben ser append-only según H-04.
  - **Responsabilidad:** MySQL debe proteger nulabilidad, formato/local uniqueness, valores de enum, FKs y reglas row-local. Servicios conservan autorización, mensajes, política de último admin, secuencia de fechas/traslapes, atomicidad y reglas que requieren contexto.
- **Archivos futuros:** esquema/migración nueva; servicios relevantes; plan de preflight/backfill; pruebas de integración; diccionario y modelo ER.
- **Efectos secundarios:** `ALTER ... NOT NULL/CHECK` puede fallar por datos existentes y bloquear escrituras durante el DDL según versión/tamaño. Restricciones nuevas requieren orden de despliegue y rollback restaurable. No editar migraciones antiguas ya entregadas; crear migración aditiva.
- **Prueba de aceptación:** validar duplicados, NULL y huérfanos antes del DDL; después intentar INSERT inválidos por SQL directo y confirmar rechazo; probar los casos válidos; probar concurrencia para traslapes y último administrador; ejecutar los 42 casos existentes además de los nuevos en DB temporal.
- **Prioridad / complejidad:** P1/P2 según regla / alta. Depende de H-02/H-03 y de aprobación de H-04.

### H-06. Historias, matriz y cierre documental no coinciden con EA2

- **EA2 / historias afectadas:** RF/RNF/HU-01…38.
- **Documentos:** `Documentacion/00_Inventario_Soportes.md`, `02_Matriz_Requisitos.md`, `03_Historias_Usuario.md`, `05_Modelo_Entidad_Relacion.md`, `06_Diccionario_Datos.md`, `09_Matriz_Pruebas.md`, `10_Auditoria_Cumplimiento_EA2.md`, `11_Informe_Final_Iteracion2.md`, `14_Acta_Cierre_Iteracion2.md`, `README.md`.
- **Situación:** 03 cubre HU-01…HU-10 en vez de 38; tablas HU→RF difieren de EA2; el cierre afirma 37/38 RF y 13/13 RNF frente al análisis detallado del informe de auditoría; 05 conserva una nota sobre columnas de autorización ya presentes en la base; inventario/reportes mezclan línea base y estado final.
- **Causa:** documentos actualizados en etapas distintas, algunas conclusiones no se recalcularon desde una matriz de evidencia única.
- **Riesgo:** evaluación académica cuestiona trazabilidad; números de cumplimiento y modelo no son reproducibles.
- **Recomendación:** usar EA2 como fuente, enlazar cada HU→RF/RNF→componente/endpoint/tabla→prueba/evidencia→estado; diferenciar “implementado”, “probado” y “evidenciado”; mantener diagnóstico de línea base separado del cierre final. No declarar 100 % hasta resolver parciales y ejecutar pruebas.
- **Archivos futuros:** lista completa arriba, especialmente 02/03/09/10/11/14 y README; actualizar 05/06 al esquema que se apruebe en H-05.
- **Efectos secundarios:** cambiar porcentajes/recomendaciones de cierre puede modificar el dictamen y requerir aprobación académica.
- **Prueba de aceptación:** script/revisión de trazabilidad asegura 38 RF, 13 RNF y 38 HU presentes una vez; 100 % de vínculos apuntan a IDs EA2 existentes; toda prueba reportada tiene procedimiento y resultado distinguible; alinear totales y estados entre 00/02/03/09/10/11/14.
- **Prioridad / complejidad:** P2 / media. Depende de cerrar las decisiones técnicas y repetir las pruebas afectadas.

### H-07. Evidencia manual y automatización no reproducibles

- **EA2 / requisitos:** pruebas que validan RF/HU-01…38; RNF-01/03.
- **Archivos:** `Documentacion/09_Matriz_Pruebas.md`, `13_Evidencias_Pruebas_Manuales.md`, `Documentacion/Evidencias/Iteracion_2/`; futuro arnés de Playwright/CI.
- **Situación:** se declaran 18/18 escenarios y 46 capturas; hay 43 PNG y tres grupos de capturas idénticas. `playwright-core` se menciona, pero el arnés no está en el repo.
- **Causa:** resultados/capturas creados fuera de un flujo versionado y conteos copiados entre documentos.
- **Riesgo:** imposibilidad de reproducir la evidencia, escenarios que comparten una captura que no acredita sus estados y riesgo de incluir datos personales.
- **Recomendación:** versionar pruebas UI aprobadas; ejecutar contra seed aislado; capturar una imagen por estado, mantener reporte HTML/JSON y artefactos de fallo; enmascarar documento, correo, token y contraseña. No reutilizar capturas. M-10 debe contar movimientos DB frente a filas de eventos en unidades separadas.
- **Archivos futuros:** pruebas Playwright nuevas; configuración `playwright.config.*`; `09`, `13`, evidencias; workflow CI.
- **Efectos secundarios:** dependencias/browsers aumentan tiempo de CI; capturas pueden revelar datos, por lo que los seeds deben ser sintéticos.
- **Prueba de aceptación:** corrida limpia produce report de 18 escenarios con IDs, estado, duración y capturas únicas; la misma corrida en CI es descargable; fallos preservan trace/screenshot; ningún artefacto incluye secretos o PII real.
- **Prioridad / complejidad:** P2 / media. Depende de decisión de herramientas y entorno aislado; no reemplaza las 42 pruebas existentes.

### H-08. RNF-03 sin benchmark representativo

- **EA2 / requisito:** RNF-03, límite de respuesta de consultas bajo las condiciones de EA2.
- **Archivos:** backend de consultas (`clientes`, `vehiculos`, `movimientos`, `auditoria`, `suscripciones`); `09_Matriz_Pruebas.md`, README y futuro CI/performance job.
- **Situación:** se cita aproximadamente 35,7 ms de `/api/health`; no representa una consulta funcional bajo volumen/carga EA2.
- **Causa:** health check usado como sustituto de medición y no se fijaron dataset, concurrencia, percentil ni ambiente.
- **Riesgo:** afirmar cumplimiento de rendimiento sin evidencia y descubrir lentitud con datos reales.
- **Recomendación:** acordar con EA2 la consulta crítica, tamaño/dataset, hardware, carga, warm-up y percentil; medir tiempo API y SQL separadamente, incluir índices/plan si falla.
- **Archivos futuros:** harness de carga aislado, configuración/dataset sintético, resultados `09` y README.
- **Efectos secundarios:** ambiente CI compartido no es determinista; separar benchmark de gate funcional o usar runner controlado.
- **Prueba de aceptación:** reproducir benchmark desde instrucción versionada y cumplir el límite EA2 con los volúmenes y percentiles predefinidos; guardar comando y reporte con versión/commit y sin datos reales.
- **Prioridad / complejidad:** P2 / media.

### H-09. Botones duplicados para un movimiento representado como entrada/salida

- **EA2 / historias:** RF-35/36, HU-35/36; mejora de usabilidad RNF-01.
- **Archivos:** `frontend/src/App.jsx`, `MovimientosTabla`, `formatearMovimientos`; `MovimientosAdmin.jsx`; backend `movimientos.admin.service.js`.
- **Situación:** una operación final se transforma en dos filas (entrada y salida) con el mismo `registroOriginal`. Cada fila repite Anular/Corregir. Corregir está deshabilitado para finalizados; Anular puede aparecer en ambas. El backend vuelve a validar el mismo ID, bloquea fila y rechaza la segunda anulación con `anulado_en`.
- **Causa:** las acciones se agregan al evento visual, aunque la operación que modifican es el movimiento padre.
- **Riesgo:** principalmente confusión/duplicidad visual; una segunda llamada no debe producir doble efecto por los bloqueos/validaciones backend, pero puede dar un error innecesario y el usuario puede creer que cada evento se anula por separado.
- **Recomendación:** no rehacer el historial. Elegir una representación: una acción por movimiento (p. ej. solo fila de entrada/grupo) o agrupar entrada/salida por movimiento y conservar las columnas. Mantener los controles de rol y autoridad del backend.
- **Archivos futuros:** `App.jsx`, estilos de acciones si hace falta y pruebas UI; no cambiar `movimientos.admin.service.js` salvo que las pruebas descubran un defecto.
- **Efectos secundarios:** puede cambiar orden/visualización del historial y accesibilidad de controles, no el contrato del API.
- **Prueba de aceptación:** un movimiento final aparece con una sola acción Anular; movimiento activo ofrece Anular y Corregir solo una vez; registro anulado no permite repetir; usuario operador no ve acciones y API rechaza la operación no autorizada.
- **Prioridad / complejidad:** P3 / baja. Puede decidirse después del cierre funcional.

### H-10. Rama no publicada y cambios locales sin integrar

- **EA2 / preparación de entrega:** condición de publicación, no RF/HU concreto.
- **Archivos/estado:** raíz Git; rama `Iteracion_2`; upstream `origin/desarrollo-autoscolombia [gone]`; `README.md`, documentación, backend y frontend con cambios locales previos.
- **Situación:** el remoto muestra `Iteracion_1` y `main`, pero no `Iteracion_2`. El árbol tiene cambios modificados, eliminados y no rastreados. El informe previo registra 57 entradas; el estado exacto debe volver a leerse antes de cualquier publicación.
- **Causa:** iteración no se publicó y el tracking local apunta a una rama remota eliminada.
- **Riesgo:** no hay revisión remota reproducible; un push sin reconciliar podría publicar archivos incompletos o incluir documentos/cambios no aprobados.
- **Recomendación:** mantener la rama local y no cambiar `main`; inventariar cada archivo, separar cambios autorizados, revisar secretos/ignorados y ejecutar validación limpia. Acordar nombre/upstream de publicación antes de crear rama remota. No add/commit/push hasta autorización explícita.
- **Archivos futuros:** ninguno por corrección de código; solo configuración Git remota si el responsable lo aprueba y la documentación de release tras publicar.
- **Efectos secundarios:** sincronizar puede exponer trabajo local; crear upstream cambia el destino de futuros push. Requiere revisión de cada cambio y no debe confundirse con una corrección funcional.
- **Prueba de aceptación:** `git status` limpio después de revisión y commits autorizados; rama remota correcta y commit de cabecera coincidente; CI pasa desde checkout limpio; `main` no cambia.
- **Prioridad / complejidad:** P1 para liberar / media; bloqueado por autorización del responsable.

## 4. Revisión especial A: rutas de alta de clientes

| Ruta | Comportamiento actual | Riesgo / tratamiento propuesto |
|---|---|---|
| `POST /api/clientes/registro` | Servicio transaccional; exige autorización y al menos un vehículo. Revierte cliente/vehículos si cualquier alta falla. | Debe ser la operación canónica conforme a RF-23. Ampliar a todos los campos EA2 y preservar envelope/API documentado. |
| `POST /api/clientes` | Servicio `crearCliente`; acepta cliente sin vehículo; no exige consentimiento, aunque puede guardar un valor opcional. | Mantener la ruta durante transición, no borrarla silenciosamente. Inventariar consumidores; convertirla en alias estricto a la operación canónica y rechazar payload sin vehículo/autorización. Avisar el cambio y versionar/deprecar si existe cliente externo. |

La UI de `Clientes.jsx` ya llama `/registro` para altas nuevas. Eso reduce el riesgo en el flujo gráfico, pero no cierra el API: cualquier cliente autenticado puede invocar la ruta simple. Ambas rutas están tras autenticación global; esa protección no sustituye autorización de tratamiento ni transacción.

**Compatibilidad recomendada:** conservar URL, método y formato `{ok, mensaje, data}` de `POST /api/clientes`, pero documentar el nuevo payload requerido y la fecha de retiro del comportamiento client-only. Antes del despliegue, buscar consumidores no versionados y acordar respuesta 400/422 para clientes antiguos. Si hay consumidores que legítimamente necesitan el alta simple, responsable debe decidir entre una versión de API deprecada o rechazar explícitamente ese caso por incompatibilidad con RF-23; no mantener en paralelo un camino que eluda los requisitos.

## 5. Revisión especial B: garantizar campos obligatorios en todas las capas

### Matriz comparativa

| Entidad | EA2 obligatorio | Formulario actual | Servicio/validador | MySQL actual | Plan |
|---|---|---|---|---|---|
| Operador | nombres, apellidos, documento, email, teléfono; contraseña temporal; activo | Nombres/documento required; resto opcional | Exige solo nombre/documento; valida formato de email solo si llega | Documento/email/apellidos/contacto pueden ser NULL; documento UNIQUE nullable | Un esquema de request en ruta + regla común de servicio; required en UI; normalizar/validar email/teléfono/documento; limpiar NULL/duplicados antes de NOT NULL |
| Cliente | documento, nombres, apellidos, email, teléfono | Documento/nombre compacto required; correo/teléfono opcionales; nombre/apellidos en `nombre_razon_social` | `validarCliente` exige tipo/documento/nombre compacto; correo/teléfono opcionales | Documento/nombre NOT NULL; contacto NULL; no existen nombres/apellidos separados | Decidir modelo PERSONA/EMPRESA; agregar y migrar campos con revisión de datos, o formalizar mapeo que demuestre ambos componentes; validar contacto en API y UI |
| Vehículo | placa válida, tipo, color, marca, modelo | Placa/tipo/clientes con requerido; marca/modelo/color opcionales | Valida placa/tipo/cliente, no marca/modelo/color | Placa/tipo NOT NULL; marca/modelo/color NULL; `cliente_id` NULL con FK | Validar en servicio; required/longitud/formato en UI; FK mantenida; `cliente_id NOT NULL` solo tras preflight y backfill |

### Secuencia recomendada de validación

1. Validar payload HTTP con esquema explícito (tipos, trim, longitud, formato, campos desconocidos según política) y responder 400/422 sin acceso a DB.
2. Repetir las invariantes de negocio en el servicio, porque API/UI pueden ser eludidos. Compartir helpers puros con tests; no confiar en `required` del navegador.
3. En transacciones compuestas, insertar todo junto; usar FK/UNIQUE para integridad referencial y concurrencia.
4. Añadir `NOT NULL`, UNIQUE canónico y CHECK por fila en migración nueva después de inventario/backfill y prueba de upgrade.
5. Mantener reglas contextuales/cross-row (rol, consentimiento, mínimo un vehículo, último admin, traslape) en servicio transaccional y pruebas concurrentes.

## 6. Revisión especial C: mensualidad irregular

La consulta segura mostró `id=1`, `VIGENTE`, `2026-11-04` a `2027-11-03`, 365 días inclusive. No se consultaron nombre, placa, operador, dirección ni valores de auditoría. No se cambió el registro.

**Regla infringida:** RF-28/HU-28 calcula vencimiento en `fecha_inicio + 29 días`, sin traslapes. Inicio 2026-11-04 implicaría fin 2026-12-03. La fila reporta 2027-11-03.

**Origen investigado, actor aún desconocido:** las tablas `auditoria_eventos`, `auditoria_eventos_backup_dep_20261113` y `auditoria_rectificaciones_texto` no contienen un evento asociado; tampoco hay evento de autenticación alrededor del alta. El binlog local muestra un `INSERT` del ID 1 el 2026-11-04 00:05:03 en estado histórico `PENDIENTE` y un cambio a `ACTIVA` a las 00:08:30. La definición histórica del `ENUM` confirma esos estados, pero el binlog no identifica operador ni herramienta. No es posible concluir si la duración anual fue intención comercial, error o carga; la fila sigue intacta.

**Opciones para responsable (sin ejecutar):**

1. Si fue error y se confirma inicio/documentación: ajustar vencimiento a 2026-12-03 por una operación administrativa trazable, guardando anterior/nuevo/motivo/actor.
2. Si fechas son intencionales como plan anual: no declarar que cumple HU-28. Decidir entre cancelación auditada y nueva mensualidad de 30 días según autorización comercial, o solicitar cambio formal EA2/modelo para planes de distinta duración.
3. Si es dato de prueba/legado: documentar evidencia de origen y decidir baja lógica/cancelación o corrección aprobada; no borrarlo.

El futuro CHECK de 30 días debe desplegarse únicamente después de decidir esta fila y comprobar el resto de históricos. La auditoría posterior debe verificar el evento con el valor anterior, valor nuevo, motivo y usuario. No ejecutar UPDATE directo.

## 7. Revisión especial D: inmutabilidad de auditoría

### Alternativas

- **Solo restricción de rutas:** insuficiente; la API puede no ofrecer UPDATE/DELETE, pero SQL directo continúa posible.
- **Cuenta MySQL runtime de mínimo privilegio (recomendada como control principal):** conceder permisos por tabla y no grants globales. Para tablas de auditoría, permitir `SELECT`/`INSERT`, no `UPDATE`/`DELETE`; para negocio, limitar DML a las tablas necesarias. Migraciones usan otra cuenta temporal/separada con DDL.
- **Separación de identidades:** proceso web no conecta como DBA; cuenta de despliegue no vive en `.env` del runtime. Rotación/secrets se administran en entorno, no en Git.
- **Triggers BEFORE UPDATE/DELETE:** alternativa complementaria que rechaza cambios con señal SQL; útil para detectar regresión, no reemplaza grants ni protege contra DBA que pueda alterar triggers.
- **Almacenamiento externo append-only:** si el requisito protege también frente a administradores DB, exportar eventos firmados/a almacenamiento WORM con retención y acceso separados.
- **Contenido de eventos:** servidor registra usuario, hora, acción/entidad, motivo y anterior/nuevo; omitir credenciales, hashes, tokens y PII innecesaria. Los accesos exitosos/fallidos siguen en `auditoria_autenticacion`.

La opción compatible con la app actual es conservar `registrarAuditoria(connection, evento)` y las transacciones, pero cambiar el usuario runtime a uno que pueda insertar/consultar esas tablas y no modificarlas ni borrarlas; usar migrator separado. Antes hay que confirmar los grants efectivos, que en la auditoría anterior no fueron consultados.

**Prueba:** correr endpoints con cuenta runtime; probar INSERT y SELECT de auditoría, luego intentar UPDATE/DELETE sobre fila de prueba y comprobar denegación del motor. Probar rollback transaccional y operaciones de negocio; comprobar que cada operación exitosa conserva su evento. `SHOW GRANTS` forma parte de aceptación y los tests usan únicamente DB aislada. Aclarar que un DBA con privilegios de administración requiere defensa externa si también está dentro del modelo de amenaza.

## 8. Revisión especial E: restricciones MySQL frente a reglas de servicio

| Regla | MySQL recomendado | Debe seguir en servicios/transacción |
|---|---|---|
| Documentos obligatorios/únicos | `NOT NULL`, clave canónica y UNIQUE por tipo/documento; depurar y normalizar primero | Validar formato, normalizar entradas y devolver errores de dominio |
| Vehículo con cliente | FK existente; pasar `cliente_id` a NOT NULL después de confirmar/backfill | Validar cliente existente/activo y mensaje de titularidad |
| Mensualidad de 30 días | CHECK de diferencia 29 días en cada fila luego de reparar históricos | Inicio actual/futuro, renovación continua y traslapes (reglas entre filas con bloqueo) |
| Al menos un administrador activo | No usar CHECK agregado; no hay constraint simple que cuente filas | Transacción con bloqueo común al crear/suspender/desvincular/cambiar rol; probar concurrencia |
| Movimientos | Mantener FKs, índices únicos generados y CHECK temporal; valorar coherencia de `fecha_salida`/operador | Compatibilidad de celda/vehículo, autorización, ocupación y toda operación compuesta |
| Históricos y auditoría | FKs `RESTRICT`, append-only por grants y opcional trigger; no cascadas de borrado | Crear evento en misma transacción, motivo y anterior/nuevo; no registrar secretos |

La integridad row-local, tipos, unicidad y referencias pertenecen al motor como última defensa. Autorización, reglas que cruzan filas, mensajes, estados derivados y flujos atómicos pertenecen a servicios transaccionales. No convertir regla de negocio en SQL sin considerar actualización segura de instalaciones existentes.

## 9. Mi cuenta e Historial de movimientos

### Mi cuenta / RF-10

La opción del menú de perfil abre el modal `Cuenta.jsx`, que llama `POST /api/auth/cambiar-password`; la API verifica sesión y política y permite el cambio obligatorio para contraseña temporal. La implementación inspeccionada cumple el flujo funcional de RF-10. La política actual exige 10 caracteres, letra, número y no espacios; EA2 fija mínimo 8 con letras y números, por lo que 10 es más estricta y satisface el mínimo, aunque se debe documentar como política deliberada. Prueba de política ya existe; agregar una integración autenticada de contraseña actual incorrecta/correcta, temporal, token viejo y auditoría. No rehacer el componente.

### Anular/Corregir / RF-35 y RF-36

Los botones están en la fila del Historial y visibles a administradores; abren `MovimientosAdmin.jsx`. El backend protege por rol, pide motivo de al menos cinco caracteres, bloquea la fila, no permite doble anulación y permite corregir solo movimiento activo/campos permitidos. Esto corresponde a RF-35/36. M-12 está declarada; falta reproducirla con Playwright versionado.

Los duplicados para movimientos cerrados son **principalmente un problema de interacción**, no una vulnerabilidad de integridad: entrada y salida son dos filas de UI, ambas apuntan al mismo ID; el backend vuelve a validar y bloquea una segunda anulación. Aun así, los controles podrían hacer creer que cada evento se gestiona por separado y ocasionar un request redundante. Mejora acotada propuesta: una sola acción por movimiento agrupado o mostrar acciones en una sola de las filas; mantener roles/endpoint sin cambios. Prioridad P3.

## 10. Plan de automatización (sin instalar herramientas)

Preservar las 42 pruebas existentes y añadir archivos/casos, sin reemplazarlas:

### Unitarias adicionales

- `operadores.validation.test.js`: campos, correo, documento vacío/duplicado, estado y contraseña temporal.
- `clientes.validation.test.js`: datos persona/empresa, documento, correo/teléfono, consentimiento, vehículo mínimo.
- `vehiculos.validation.test.js`: placa por tipo, marca/modelo/color, cliente activo y nulos.
- `suscripciones.validation.test.js`: inicio pasado, hoy/futuro, 29/30/31/365 días, cambio de zona/año bisiesto, estados.
- Casos de rol, cambio de contraseña, motivos de anular/corregir y whitelist de campos.
- Auditoría: serialización anterior/nuevo con redacción de contraseña, token y secretos.

### Integración con MySQL aislado

- Mantener el test actual y su base `autoscolombia_test_<pid>`.
- Añadir rutas reales de clientes para ambos paths/perfiles, campos incompletos, consentimiento, duplicado y rollback.
- Operadores: prohibir quitar/desactivar al último admin con concurrencia; comprobar estado/sesiones.
- Vehículos: `NOT NULL`, UNIQUE/FK, cambio de titular e historial.
- Suscripciones: CHECK, vencimiento 30 días, traslape y dos solicitudes concurrentes; fixture para id=1 no conforme debe vivir solo en DB de prueba.
- Movimientos: roles, anulación duplicada, corrección activa/finalizada, snapshot y auditoría transaccional.
- Auditoría: usuario runtime restringido intenta UPDATE/DELETE y recibe denegación.
- No ejecutar test que apunte a `autoscolombia`; validar DB test por nombre y abortar si el nombre no tiene prefijo permitido.

### Playwright de punta a punta

Automatizar recorridos M-01…M-18 contra frontend/backend con semilla sintética: autenticación y bloqueo; ciclo cliente+vehículo y permiso; entrada/salida; filtros; roles; mensualidad; celda; auditoría; cambio temporal; recuperación con proveedor consola. Agregar prueba dirigida de que `POST /clientes` incompleto no elude `/registro`, error/rollback y ausencia de doble botón lógico. RF-12 confirma token/flujo de consola; no se simula ni configura entrega real de correo.

Guardar por corrida `report.json`, reporte HTML, capturas por escenario con IDs únicos y trace/video solo en fallo. Semillas con nombres/documentos ficticios; limpiar únicamente el schema efímero al terminar. Adjuntar resultados como artefactos de CI, sin subir capturas con información real al repo.

### Futuro GitHub Actions

Sin crear workflow ahora: checkout limpio; versión Node fijada; `npm ci` backend/frontend; MySQL service efímero con credenciales de test; esperar health; ejecutar 42+unitarias nuevas, integración, lint y build; instalar navegador Playwright solo cuando se apruebe esa dependencia; ejecutar E2E; publicar reporte/capturas como artifacts con retención. No exponer `.env`, credenciales reales ni base local; ninguna tarea toca `main` o publica cambios automáticamente. Mantener benchmark RNF-03 como job aparte si el runner no es estable.

## 11. Inventario documental a corregir

Corregir después de implementar y ejecutar, no antes:

| Documento | Contradicción que resolver |
|---|---|
| `03_Historias_Usuario.md` | Agregar HU-11…HU-38; reproducir actores y criterios literalmente desde EA2; reparar el resumen HU→RF |
| `02_Matriz_Requisitos.md` | Rehacer estados RF/RNF con categorías Cumple/Parcial/No cumple/No probado; enlazar evidencia individual, no asignar M-01…18 en bloque |
| Matriz de trazabilidad | Una relación de EA2 HU↔RF/RNF por fila y enlaces a función, endpoint, tabla, prueba y captura |
| `09_Matriz_Pruebas.md` | Distinguir unit/integración/manual, condiciones/fixtures, resultado reejecutado y herramienta; actualizar build/lint y rendimiento |
| `13_Evidencias_Pruebas_Manuales.md` | Corregir conteo 46→conteo real tras recaptura; eliminar duplicidad como prueba distinta; registrar hashes/ID/reporte de cada corrida |
| `Documentacion/Evidencias/Iteracion_2/` | Reemplazar/añadir capturas solo tras nueva ejecución Playwright con datos sintéticos; nunca reutilizar una imagen para dos estados |
| `05_Modelo_Entidad_Relacion.md` | Quitar nota obsoleta sobre autorización en clientes tras verificar migración; modelar campos separados si se aprueba H-02; mostrar FKs/nullability reales |
| `06_Diccionario_Datos.md` | Reflejar `NOT NULL`, índices, checks y restricciones acordadas; explicar tablas auxiliares `auditoria_eventos_backup_dep_20261113` y `auditoria_rectificaciones_texto` sin datos personales |
| `10_Auditoria_Cumplimiento_EA2.md` | Mantener diagnóstico de línea base separado del cierre y enlazar este plan; no declarar resueltos hallazgos pendientes |
| `11_Informe_Final_Iteracion2.md` | Recalcular 37/38 RF y 13/13 RNF después de evidencia aceptada; describir RF-12 como limitación de envío externo pendiente |
| `14_Acta_Cierre_Iteracion2.md` | Ajustar decisión/firmas/cifras al resultado verificado; no afirmar cierre total antes de aceptación |
| `00_Inventario_Soportes.md` | Inventario real de documentos, 42 tests, capturas y artefactos, sin conteos replicados |
| `04_Diagramas.md` | Actualizar diagrama entidad-relación/arquitectura si cambia modelo; exportar visuales legibles además del Mermaid editable |
| `README.md` | Actualizar módulos/build/lint tras validación, pasos instalación/upgrade/restauración, limitaciones y enlaces solo cuando el responsable suministre las URLs |

**RF-12:** conservar `MAIL_PROVIDER=consola` para validación local; describir `MAIL_PROVIDER=http` como integración futura sin credenciales ni envío real. No configurar proveedor en este plan.

## 12. Orden de intervención, dependencias y complejidad

| Orden | Acción futura | Hallazgos | Complejidad | Depende de |
|---:|---|---|---|---|
| 0 | Decidir compatibilidad de alta cliente, modelo PERSONA/EMPRESA, origen de mensualidad y política de auditoría | H-01…H-05 | Media | Responsable de producto/datos |
| 1 | Inventariar consumidores API y sanear/backfill de los campos según criterios aceptados | H-01/H-02 | Alta | Orden 0 |
| 2 | Corregir ruta canónica/validación de operadores, clientes y vehículos y conservar transición | H-01/H-02 | Alta | Orden 1 |
| 3 | Resolver ID 1 mediante cambio administrativo auditado aprobado | H-03 | Media | Verificación de soporte/contrato |
| 4 | Diseñar migración aditiva de NOT NULL/FK/CHECK y ejecutarla primero en DB temporal | H-05 | Alta | Órdenes 1–3 |
| 5 | Separar usuario runtime/migrador y probar privilegios append-only | H-04 | Alta | Revisión de despliegue; puede avanzar en paralelo al orden 4 |
| 6 | Ampliar pruebas unitarias e integración; conservar 42 existentes y ejecutar suite aislada | H-01…H-05 | Media/alta | Contratos y esquema aprobados |
| 7 | Versionar Playwright y producir M-01…M-18 reproducibles | H-07/H-09 | Media | UI/API estables |
| 8 | Medir RNF-03 en entorno/dataset definidos | H-08 | Media | Entorno representativo |
| 9 | Ajustar botones repetidos si diseño aprobado; revalidar historial | H-09 | Baja | Decisión UX |
| 10 | Rehacer historias, trazabilidad, evidencias, modelo, diccionario, cierre y README | H-06/H-07/H-08 | Media | Resultados de 1–9 |
| 11 | Revisar cambios Git y publicación de rama cuando se autorice | H-10 | Media | Documentación y aprobación responsable |

**Dependencias principales:** H-02 precede al contrato definitivo de H-01. La limpieza de H-03 precede a CHECK de H-05. H-04 necesita identidad runtime/migrator y pruebas propias, aunque su diseño puede iniciarse antes. H-06 depende de tener estados y evidencias finales; README/acta se actualizan al final. H-10 siempre requiere autorización y revisión Git aparte.

## 13. Puntos que requieren decisión del responsable

1. ¿`POST /api/clientes` se convierte en alias estricto con periodo de transición, o se versiona/depreca por existir consumidores externos?
2. ¿Cómo separar nombres/apellidos de persona natural, y qué estructura se acepta para empresa sin perder datos anteriores?
3. ¿La mensualidad ID 1 es error, dato de prueba o plan anual intencional? Confirmar soporte/contrato antes de corregir o cancelar.
4. ¿El modelo de amenaza exige protección frente a administradores DB? Si sí, grants/trigger no bastan; se necesita almacenamiento externo inmutable.
5. ¿Aprobar migraciones aditivas para campos obligatorios y CHECK después del backfill, incluyendo la conversión de `vehiculos.cliente_id` a NOT NULL?
6. ¿Qué consultas, volumen, concurrencia y percentil definen el benchmark RNF-03?
7. ¿Se aprueba incorporar Playwright y publicar sus reportes como artefactos de CI en una futura fase?
8. ¿Se acepta mover/deduplicar los botones visuales de historial sin cambiar los endpoints?
9. ¿Cuándo se proporciona URL real de repositorio/video y se autoriza publicar `Iteracion_2`?

## 14. Confirmación de alcance

- La rama observada continúa siendo `Iteracion_2`; no hubo cambio de rama.
- No se modificó código, UI, configuración, documentación preexistente ni migraciones.
- No se modificó la base de datos. La identificación de la mensualidad fue una consulta `SELECT` dentro de transacción `READ ONLY`, seguida de `ROLLBACK`.
- No se ejecutaron migraciones ni pruebas que escribieran en bases de datos.
- No se realizó `git add`, commit, push ni merge.
- El único archivo creado en esta actividad es `Documentacion/Plan_Correcciones_Post_Auditoria_EA2.md`.
