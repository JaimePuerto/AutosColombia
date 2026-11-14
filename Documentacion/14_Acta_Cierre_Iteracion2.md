# Acta de Cierre — Iteración 2 — AutosColombia

**Proyecto:** AutosColombia — Sistema de gestión de parqueadero
**Rama:** `Iteracion_2`
**Fuente oficial de requisitos:** `Grupo03_Iteracion_2_EA2`
**Documento de cierre:** `Documentacion/11_Informe_Final_Iteracion2.md`
**Fecha de cierre:** 2026-11-13

> **Estado actualizado:** esta acta corresponde al cierre previo y queda supersedida por el informe de cierre final [`17_Informe_Cierre_Final_EA2.md`](17_Informe_Cierre_Final_EA2.md). El dictamen vigente incorpora: M-01…M-18 reejecutadas (33/33 con el arnés Playwright versionado), benchmark RNF-03 representativo, mensualidad ID 1 conciliada a 30 días (migración 011) y separación de cuentas MySQL (ejecución vs. administración). Se conserva como registro histórico.

---

## 1. Objeto

Dejar constancia formal del cierre de la **Iteración 2** del sistema AutosColombia, describiendo el alcance entregado, los requisitos cubiertos, los resultados de las verificaciones, las limitaciones identificadas y las condiciones para la evaluación académica.

---

## 2. Alcance entregado

| Elemento | Estado |
|---|---|
| Proyecto fuente (backend + frontend + SQL + documentación) | Entregado (repositorio local, rama `Iteracion_2`) |
| Informe técnico final (11 secciones A–K) | Entregado |
| Documentación de soporte (matriz de requisitos, pruebas, migraciones) | Entregado |
| Evidencias de pruebas automatizadas | Entregadas |
| Evidencias de pruebas manuales (M-01 a M-18) | **Reejecutadas y aprobadas** (33/33; 43 capturas) — ver `13_Evidencias_Pruebas_Manuales.md` |

> La entrega se realiza **sobre el repositorio local** (rama `Iteracion_2`) preparado para su publicación en GitHub. No se genera paquete ZIP: la fuente de verdad es el repositorio.

---

## 3. Resultados de cumplimiento

**Requisitos funcionales (RF-01 a RF-38):**

| Estado | Cantidad |
|---|---|
| Implementado y verificado | 37 |
| Implementado con limitación externa (RF-12) | 1 |
| No implementado | 0 |

**Requisitos no funcionales (RNF-01 a RNF-13):**

| Estado | Cantidad |
|---|---|
| Implementado con evidencia | 13 |
| No implementado | 0 |

> Detalle por requisito en [`02_Matriz_Requisitos.md`](02_Matriz_Requisitos.md), [`10_Auditoria_Cumplimiento_EA2.md`](10_Auditoria_Cumplimiento_EA2.md) y [`11_Informe_Final_Iteracion2.md`](11_Informe_Final_Iteracion2.md).

---

## 4. Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| `npm test` (backend) | **52/52 aprobadas** (unitarias + integración contra MySQL; esquema y migraciones 002–011) |
| `npm run build` (frontend) | Compila sin errores (29 módulos) |
| `npm run lint` (frontend) | 0 errores, 14 advertencias de estilo preexistentes |
| `node --check` (backend) | Sin errores |
| `GET /api/health` | `{"ok":true,...}` (acredita disponibilidad, no RNF-03) |
| `npm run test:e2e` (M-01 a M-18) | **33/33 aprobadas** (arnés Playwright; base efímera `autoscolombia_e2e_<pid>`) |
| `npm run rendimiento:rnf03` | **1/1**; p95 87,02 ms (C1) y 249,36 ms (C10); SQL 84,9 ms |

---

## 5. Base de datos y migraciones

- Instalación limpia en **11 pasos**: `schema.sql` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `011` → `010`. La migración `011` (normalización de mensualidades a 30 días) debe ejecutarse **antes** de `010`, que incorpora la restricción `chk_suscripcion_30_dias`.
- Migraciones `003` a `009` y `011`: **aditivas e idempotentes** (guardas `information_schema`). `schema.sql` y `002` se ejecutan una sola vez.
- **Cuentas MySQL separadas:** una cuenta de ejecución de mínimo privilegio (`autoscolombia_app`, sin DDL y sin poder modificar/eliminar auditoría) y una cuenta administrativa (`autoscolombia_admin`) para migraciones y mantenimiento.
- **Sin operaciones destructivas:** no se ejecutaron `DROP`, `TRUNCATE` ni `DELETE` masivos sobre datos reales.
- Pruebas de integración sobre una **base independiente y descartable** (`autoscolombia_test_<pid>`).
- Orden y verificación detallados en [`07_Orden_Migraciones.md`](07_Orden_Migraciones.md).

---

## 6. Limitaciones y dependencias externas

| # | Limitación | Causa | Mitigación |
|---|---|---|---|
| 1 | **RF-12:** envío real del correo de recuperación no probado | No hay proveedor SMTP/API configurado | El flujo está implementado end-to-end con proveedor abstraído; con `MAIL_PROVIDER=consola` genera el enlace sin simular el envío (verificado en M-18). Basta configurar `MAIL_PROVIDER=http` y las credenciales para habilitarlo |

> La única dependencia externa pendiente es la habilitación del proveedor de correo. Las pruebas manuales (M-01 a M-18) fueron **ejecutadas y aprobadas**; no se simularon resultados ni capturas.

---

## 7. Restricciones respetadas durante el cierre

- **Rama:** se conservó `Iteracion_2`; **no** se cambió de rama ni se modificó `main`.
- **Git:** **no** se realizaron commits, push ni merge. Último commit existente: `1ffb4f2c64711a763851ab40ec7444f31c1911ae`.
- **Datos:** no se ejecutaron `DROP`, `TRUNCATE` ni `DELETE` masivos; los datos existentes se conservaron.
- **Arquitectura:** se mantuvo la estructura y arquitectura existentes (Node/Express + `mysql2/promise`; React/Vite).

---

## 8. Entregables

| Entregable | Ubicación |
|---|---|
| Proyecto fuente (repositorio local) | `C:\Users\ADMINISTRADOR\Documents\Proyectos\AutosColombia` (rama `Iteracion_2`) |
| Informe técnico final | [`Documentacion/11_Informe_Final_Iteracion2.md`](11_Informe_Final_Iteracion2.md) |
| Matriz de requisitos | [`Documentacion/02_Matriz_Requisitos.md`](02_Matriz_Requisitos.md) |
| Matriz de pruebas | [`Documentacion/09_Matriz_Pruebas.md`](09_Matriz_Pruebas.md) |
| Evidencias de pruebas manuales | [`Documentacion/13_Evidencias_Pruebas_Manuales.md`](13_Evidencias_Pruebas_Manuales.md) + `Documentacion/Evidencias/Iteracion_2/` |
| Orden de migraciones | [`Documentacion/07_Orden_Migraciones.md`](07_Orden_Migraciones.md) |

---

## 9. Compromisos posteriores

1. Configurar el proveedor de correo (`MAIL_PROVIDER=http` + credenciales) y ejecutar la prueba de extremo a extremo del **envío real** de RF-12.
2. Publicar los cambios en GitHub mediante un commit autorizado por el responsable del proyecto (la preparación del repositorio ya está hecha; **no** se realizan `add`/`commit`/`push` sin autorización).

---

## 10. Conclusión

La Iteración 2 de AutosColombia queda **cerrada** con **37/38** requisitos funcionales implementados y verificados, los **13** requisitos no funcionales con evidencia, las pruebas automatizadas en verde (**52/52**) y las **pruebas de interfaz M-01 a M-18 reejecutadas y aprobadas (33/33 con el arnés Playwright)** con evidencia gráfica única. El único punto con limitación externa (RF-12, envío real de correo) está identificado y es habilitable mediante configuración, sin requerir cambios de código. El repositorio local queda preparado para su revisión y publicación en GitHub.
