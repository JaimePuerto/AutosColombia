# Diagramas — Iteración 2

Los diagramas se entregan en **Mermaid** (texto), por lo que se renderizan en GitHub/VS Code y pueden exportarse a imagen.
Reflejan únicamente las funciones implementadas y los endpoints reales.

---

## 1. Diagrama de casos de uso

```mermaid
flowchart LR
  OP(("Operador"))
  AD(("Administrador"))

  subgraph AC["AutosColombia"]
    UC1["Iniciar / cerrar sesión"]
    UC2["Registrar entrada"]
    UC3["Registrar salida"]
    UC4["Consultar historial con filtros (HU-07)"]
    UC5["Consultar si un vehículo está dentro"]
    UC6["Ver panel principal"]
    UC7["Administrar usuarios"]
    UC8["Administrar clientes"]
    UC9["Administrar vehículos"]
    UC10["Administrar celdas e historial"]
    UC11["Administrar suscripciones"]
    UC12["Anular / corregir movimientos"]
    UC13["Consultar auditoría"]
  end

  OP --> UC1
  OP --> UC2
  OP --> UC3
  OP --> UC4
  OP --> UC5
  OP --> UC6

  AD --> UC1
  AD --> UC2
  AD --> UC3
  AD --> UC4
  AD --> UC6
  AD --> UC7
  AD --> UC8
  AD --> UC9
  AD --> UC10
  AD --> UC11
  AD --> UC12
  AD --> UC13
```

---

## 2. Diagrama de actividades — Registrar entrada

```mermaid
flowchart TD
  A(["Operador envía placa y acceso"]) --> B["POST /api/movimientos/entrada"]
  B --> C{"¿Token válido?"}
  C -- No --> Z1(["401 Sesión no válida"])
  C -- Sí --> D{"¿Operador activo?"}
  D -- No --> Z2(["Error: operador no habilitado"])
  D -- Sí --> E["Buscar vehículo por placa (NO se crea)"]
  E --> F{"¿Vehículo registrado y activo?"}
  F -- No --> Z3(["Error: vehículo no registrado / inactivo"])
  F -- Sí --> G{"¿Tipo coincide?"}
  G -- No --> Z4(["Error: tipo incorrecto"])
  G -- Sí --> H["Buscar suscripción ACTIVA vigente"]
  H --> I{"¿Suscripción vigente?"}
  I -- No --> Z5(["Error: sin suscripción vigente"])
  I -- Sí --> J["BEGIN TRANSACTION"]
  J --> K{"¿Vehículo ya está dentro?"}
  K -- Sí --> Z6(["Rollback: ingreso activo duplicado"])
  K -- No --> L["Buscar celda disponible del tipo (FOR UPDATE)"]
  L --> M{"¿Celda libre?"}
  M -- No --> Z7(["Rollback: sin celdas disponibles"])
  M -- Sí --> N["INSERT movimiento (fecha_entrada)"]
  N --> O["INSERT auditoría ENTRADA (misma transacción)"]
  O --> P["COMMIT"]
  P --> Q(["201 Entrada registrada con celda asignada"])
```

---

## 3. Diagrama de actividades — Registrar salida

```mermaid
flowchart TD
  A(["Operador envía placa y acceso"]) --> B["POST /api/movimientos/salida"]
  B --> C["BEGIN TRANSACTION"]
  C --> D["Buscar movimiento activo por placa (FOR UPDATE)"]
  D --> E{"¿Tiene entrada abierta?"}
  E -- No --> Z1(["Rollback: no hay entrada abierta"])
  E -- Sí --> F["UPDATE fecha_salida y acceso_salida"]
  F --> G["INSERT auditoría SALIDA (misma transacción)"]
  G --> H["COMMIT"]
  H --> I(["200 Salida registrada"])
```

---

## 4. Diagrama de secuencia — Inicio de sesión

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant F as Frontend (React)
  participant A as API (Express)
  participant S as auth.service
  participant DB as MySQL

  U->>F: documento + contraseña
  F->>A: POST /api/auth/login
  A->>S: iniciarSesion(credenciales)
  S->>DB: SELECT operador por documento
  alt Credenciales válidas
    S->>DB: INSERT sesiones_operadores (hash del token)
    S->>DB: INSERT auditoria_autenticacion (LOGIN_EXITOSO)
    S-->>A: { token, usuario }
    A-->>F: 200 { ok, data }
    F-->>U: Acceso al panel según rol
  else Credenciales inválidas
    S->>DB: UPDATE intentos_fallidos / bloqueado
    S->>DB: INSERT auditoria_autenticacion (LOGIN_FALLIDO)
    S-->>A: error
    A-->>F: 401 { ok:false, mensaje }
    F-->>U: Mensaje de error
  end
```

---

## 5. Diagrama de secuencia — Registrar entrada (con auditoría transaccional)

```mermaid
sequenceDiagram
  autonumber
  actor U as Operador
  participant F as Frontend (React)
  participant A as API (Express)
  participant M as movimientos.service
  participant DB as MySQL

  U->>F: placa + acceso
  F->>A: POST /api/movimientos/entrada (Bearer token)
  A->>A: requiereAutenticacion (token válido)
  A->>M: registrarEntrada({placa, tipo, acceso, operadorId})
  M->>DB: SELECT vehículo (existe y activo)
  M->>DB: SELECT suscripción ACTIVA vigente
  M->>DB: BEGIN TRANSACTION
  M->>DB: SELECT celda disponible FOR UPDATE
  M->>DB: INSERT movimiento
  M->>DB: INSERT auditoría ENTRADA
  M->>DB: COMMIT
  M-->>A: resultado
  A-->>F: 201 { ok, data }
  F-->>U: Confirmación con celda asignada
```

> Si cualquiera de los pasos dentro de la transacción falla, se ejecuta `ROLLBACK`: no se crea el movimiento ni el evento de auditoría.
