# Minka Capital — Esquema y flujo del sistema

> **Entorno:** Stellar Testnet exclusivamente.  
> **Aviso:** Este prototipo no ofrece valores reales, custodia, KYC real ni mercado secundario. Demuestra infraestructura para una futura plataforma de Financiamiento Participativo Financiero (FPF) regulada.

## 1. Visión del producto

Minka Capital permite que una startup peruana ficticia, **LumiSolar Perú**, cree una oferta primaria de participaciones simuladas en ingresos futuros (`LUMI-RSN`). Los inversionistas demo aprobados adquieren unidades usando USDC en Stellar Testnet. Cuando la startup reporta ventas, un oráculo autorizado registra eventos de ingreso; el contrato calcula el retorno proporcional y cada inversionista puede reclamar su USDC cuando lo decida.

```mermaid
flowchart LR
    Startup["Startup peruana\nLumiSolar Perú"]
    Investors["Inversionistas aprobados\nWallets Stellar"]
    Platform["Minka Capital\nDashboard React"]
    Contract["Minka Market\nContrato Soroban"]
    Vault["Revenue Vault\nUSDC Testnet SAC"]
    Oracle["Oráculo de ingresos\nPOS / SaaS simulado"]
    Rpc["Stellar RPC\ngetEvents"]

    Startup -->|"Crea oferta de Revenue Share Notes"| Platform
    Platform -->|"Transacción firmada"| Contract
    Investors -->|"Invierte USDC Testnet"| Platform
    Platform -->|"invest(units)"| Contract
    Contract <-->|"Transferencias SEP-41"| Vault
    Startup -->|"Ventas o suscripciones"| Oracle
    Oracle -->|"record_revenue(event_id, amount)"| Contract
    Contract -->|"Eventos auditables"| Rpc
    Rpc -->|"Actualizaciones en tiempo real"| Platform
    Contract -->|"claim()"| Vault
    Vault -->|"USDC Testnet"| Investors
```

## 2. Componentes y responsabilidades

```mermaid
flowchart TB
    subgraph UI["Capa de experiencia — React / TypeScript"]
        Dashboard["Dashboard de oferta\ncapital levantado, unidades y progreso"]
        InvestorPanel["Panel del inversionista\nposición, saldo reclamable y botón Claim"]
        EventFeed["Feed auditable\ninversiones, ingresos y claims"]
        AdminPanel["Panel de administrador\naprobación demo y registro de ingresos"]
    end

    subgraph OFFCHAIN["Capa off-chain"]
        Wallet["Wallet compatible con Stellar\nFirma de transacciones"]
        OracleService["Servicio de oráculo\nvalida venta, firma y genera nonce"]
        Indexer["Indexador RPC\nconsulta getEvents y conserva cursor"]
    end

    subgraph STELLAR["Stellar Testnet"]
        Market["minka_market.wasm\nContrato Soroban"]
        USDC["USDC Stellar Asset Contract\nSAC / SEP-41"]
        Events["Eventos de contrato\nledger + transaction hash"]
    end

    Dashboard --> Wallet
    InvestorPanel --> Wallet
    AdminPanel --> Wallet
    Wallet --> Market
    OracleService --> Market
    Market --> USDC
    Market --> Events
    Events --> Indexer
    Indexer --> EventFeed
    Indexer --> Dashboard
```

| Componente | Responsabilidad en el MVP | Evidencia para el jurado |
|---|---|---|
| `minka_market` | Oferta, allowlist, unidades, eventos de ingresos, cálculo pro-rata y claims | WASM, Contract ID, tests Rust y transacciones Testnet |
| USDC SAC | Activo de pago y liquidación simulada | Transferencias verificables en Testnet |
| Oráculo demo | Convierte ventas simuladas en eventos firmados e idempotentes | `event_id`, timestamp y transacción `record_revenue` |
| Stellar RPC | Expone eventos del contrato para el dashboard | Feed con ledger, hash y tipo de evento |
| Dashboard | Muestra estado, retornos y trazabilidad | Demo grabada de punta a punta |

## 3. Flujo de emisión e inversión primaria

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Administrador de Minka
    participant UI as Dashboard React
    participant Contract as Minka Market (Soroban)
    participant USDC as USDC SAC (Testnet)
    participant Investor as Inversionista aprobado

    Admin->>UI: Configura LumiSolar Perú, precio y unidades objetivo
    UI->>Contract: deploy + __constructor(admin, usdc, unit_price, target_units)
    Contract-->>UI: Oferta creada / evento OfferingCreated

    Admin->>Contract: set_investor_status(wallet, true)
    Contract-->>UI: Evento InvestorStatusChanged

    Investor->>UI: Conecta wallet y selecciona unidades
    UI->>Contract: invest(units), firmado por Investor
    Contract->>USDC: Transferir USDC del inversor al Revenue Vault
    USDC-->>Contract: Transferencia confirmada
    Contract->>Contract: Registra unidades y checkpoint de distribución
    Contract-->>UI: Evento Investment
    UI-->>Investor: Muestra unidades adquiridas y progreso de la oferta
```

### Reglas on-chain aplicadas

1. Solo el administrador puede aprobar wallets y registrar ingresos.
2. Solo una wallet aprobada puede invertir.
3. No se permiten unidades ni montos menores o iguales a cero.
4. No se permite sobrepasar las unidades objetivo de la oferta.
5. Cada inversión registra un checkpoint: un inversionista nuevo no recibe ingresos generados antes de invertir.

## 4. Flujo de ingresos en tiempo real y distribución

```mermaid
sequenceDiagram
    autonumber
    participant Startup as LumiSolar Perú
    participant Oracle as Oráculo de ingresos
    participant Contract as Minka Market (Soroban)
    participant RPC as Stellar RPC / getEvents
    participant UI as Dashboard React
    participant Investor as Inversionista

    Startup->>Oracle: Venta simulada: S/ 250 equivalentes
    Oracle->>Oracle: Genera event_id único, monto, timestamp y firma
    Oracle->>Contract: record_revenue(event_id, amount)
    Contract->>Contract: Verifica autorización y que event_id no exista
    Contract->>Contract: Actualiza ingreso acumulado por unidad
    Contract-->>RPC: Evento RevenueRecorded
    RPC-->>UI: Nuevo evento, ledger y transaction hash
    UI-->>Investor: Actualiza saldo reclamable en tiempo real

    Investor->>UI: Selecciona Claim USDC
    UI->>Contract: claim(), firmado por Investor
    Contract->>Contract: Calcula retorno pendiente y pone saldo en cero
    Contract-->>Investor: USDC Testnet enviado desde el vault
    Contract-->>RPC: Evento Claim
    RPC-->>UI: Feed y saldo actualizados
```

### Protección del evento de ingresos

```mermaid
flowchart TD
    Sale["Evento de venta\nimporte + referencia"] --> Normalize["Normalizar payload\nmonto en unidades atómicas"]
    Normalize --> Nonce["Asignar event_id único\nnonce / idempotency key"]
    Nonce --> Sign["Firmar con clave del oráculo\no autorizar desde admin demo"]
    Sign --> Submit["record_revenue(event_id, amount)"]
    Submit --> CheckAuth{"¿Administrador/oráculo\nautorizado?"}
    CheckAuth -->|"No"| RejectAuth["Revertir transacción"]
    CheckAuth -->|"Sí"| CheckNonce{"¿event_id\nya usado?"}
    CheckNonce -->|"Sí"| RejectReplay["Revertir: replay detectado"]
    CheckNonce -->|"No"| Distribute["Actualizar retorno\npro-rata por unidad"]
    Distribute --> Emit["Emitir RevenueRecorded\npara RPC y auditoría"]
```

## 5. Datos principales del contrato

```mermaid
classDiagram
    class Offering {
        +Address admin
        +Address usdc_sac
        +i128 unit_price
        +i128 target_units
        +i128 sold_units
        +i128 revenue_per_unit_scaled
        +bool paused
    }

    class InvestorPosition {
        +bool approved
        +i128 units
        +i128 revenue_checkpoint_scaled
        +i128 claimable_usdc
    }

    class RevenueEvent {
        +u64 event_id
        +i128 amount_usdc
        +u64 ledger_or_timestamp
        +bool processed
    }

    Offering "1" --> "many" InvestorPosition : positions
    Offering "1" --> "many" RevenueEvent : processed events
```

## 6. Escenario de demo y evidencia verificable

```mermaid
flowchart LR
    A["1. Inicializar oferta\nLUMI-RSN"] --> B["2. Aprobar dos wallets demo"]
    B --> C["3. Wallet A y B invierten USDC Testnet"]
    C --> D["4. Registrar venta demo\ncon event_id único"]
    D --> E["5. Dashboard consume getEvents\ny muestra distribución"]
    E --> F["6. Wallet A realiza Claim"]
    F --> G["7. Mostrar hash de inversión,\ningreso y claim en Testnet"]
```

| Paso | Qué se verifica | Criterio de evaluación que fortalece |
|---|---|---|
| Inicialización | Contract ID y parámetros de la oferta | Integración técnica Stellar |
| Inversión | USDC, autorización de wallet y unidades registradas | Funcionalidad demostrable |
| Ingreso | `event_id` único, distribución pro-rata y evento on-chain | Realtime Systems & High-Velocity Finance |
| Claim | Transferencia de USDC Testnet y actualización de saldo | Funcionalidad demostrable |
| Feed RPC | Ledger, hash y eventos mostrados desde `getEvents` | Evidencia verificable |
| Límite regulatorio | Disclaimer y ruta FPF regulada | Viabilidad y continuidad |

## 7. Evolución posterior al hackathon

```mermaid
flowchart LR
    MVP["MVP Testnet\nOferta + ingresos + claims"] --> Pilot["Piloto cerrado\ncon incubadora / red ángel"]
    Pilot --> Compliance["Proveedor KYC/AML\n+ administrador FPF autorizado"]
    Compliance --> Data["Oráculos conectados a\nPOS, facturación o pasarela real"]
    Data --> Scale["Múltiples startups,\nreporting y auditoría"]
    Scale --> Secondary["Evaluar mercado secundario\nsolo con diseño y aprobación regulatoria"]
```
