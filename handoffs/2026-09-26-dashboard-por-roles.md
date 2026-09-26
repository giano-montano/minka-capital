# Handoff 2026-09-26 — Dashboard por roles (Giano → Leo)

## Qué cambió

El dashboard `/app` pasó de una sola página larga a un **espacio de trabajo por roles**, con pestañas que solo aparecen si la wallet conectada tiene ese rol. La pestaña activa vive en la URL (`/app?tab=portafolio`, `/app?tab=explorar&oferta=0`).

| Pestaña | Quién la ve | Contenido |
| --- | --- | --- |
| Explorar | todos | Catálogo (marca "tu oferta" y "colocada"), métricas de la oferta y caja de inversión con atajos 1/5/10/25/Máx, costo, saldo y motivo exacto si no puede invertir. Si la oferta es tuya, te manda a Mi empresa. |
| Mi portafolio | wallet conectada | Todas las posiciones, total invertido y total por cobrar, botón **Cobrar X USDC** por oferta. |
| Mi empresa | emisoras | Resumen (ofertas, capital levantado, disponible para retirar), selector de sus propias ofertas y tres bloques: capital (retiro a la propia wallet, botón "Todo", opción de otra wallet), utilidades y condiciones (precio/unidades, pausa). "Nueva oferta" plegable. |
| Minka | admin | Bandeja **Por revisar** con los reportes pendientes de todas las ofertas (aprobar y repartir / rechazar), participantes aprobados y revocados según la actividad on-chain con revocar/reaprobar en un clic, y control por oferta (pausa y permiso de utilidades). |
| Actividad | todos | Feed con filtro "Solo mis movimientos". |

Encima de las pestañas, una **barra de wallet**: dirección con botón de copiar, roles, saldo USDC y, si la wallet no tiene rol, qué hacer (copiar la dirección y mandarla a Minka). Al conectarse, cada rol aterriza en su pestaña: admin → Minka, emisora → Mi empresa, inversionista con saldo por cobrar → Mi portafolio.

**Compatibilidad con los dos contratos:** con tu flujo nuevo (`supportsRevenueReports`), Mi empresa usa "Enviar a revisión" y Minka tiene la bandeja. Con el contrato oficial `CDQ7…` (flujo anterior), Mi empresa tiene un único **Repartir utilidades** que hace `fund_distributions` + `record_revenue` seguidos (dos firmas, y reusa lo ya depositado), y Minka muestra un aviso en lugar de la bandeja.

### Archivos

- Nuevos: `WalletStatus.tsx`, `ExploreTab.tsx`, `PortfolioTab.tsx` en `app/src/features/market/`.
- Reescritos: `MarketDashboard.tsx` (shell con pestañas + `ActivityTab`), `PlatformAdminPanel.tsx` (consola Minka), `IssuerPanel.tsx` (Mi empresa; reusa tus `CreateOfferingForm` e `IssuerRevenueReports`).
- `useMarket.ts`: `usePositions` y `useAllRevenueReporting` (`useQueries` sobre todas las ofertas).
- Eliminado: `InvestorPanel.tsx` (reemplazado por la caja de Explorar y Mi portafolio).
- `e2e/tests/smoke.spec.ts`: el título de `/app` ahora es "Mercado Minka".
- Docs del video: el botón de claim ahora se llama **Cobrar 8 USDC** y está en Mi portafolio.

## Verificado

- `tsc -b`, `eslint src` y `vite build` limpios; `cargo test -p minka-market`: 36/36.
- Tu `demo-minka-testnet.sh` con el flujo de reportes funciona de punta a punta: contrato de prueba `CBNTHXMY2QQM2E66PCAUIW7WQXX4G66KZRFXBORP46QMIMSZVPZ7ANRX` (ledger 4871619), solo en el `app/.env.local` de la VM de Giano. El oficial sigue siendo `CDQ7…`.
- **No** se probó con una wallet real en el navegador: la VM no tiene navegador y Giano pidió pushear directo.

## Para Leo

1. **Wallet en prod:** Giano reporta que la conexión de wallet está fallando en el sitio de Cloudflare. Queda en tus manos (no se tocó en este cambio).
2. Probar cada pestaña con Freighter en Testnet: Ana/Luis (Explorar + Mi portafolio), LumiSolar (Mi empresa) y el admin (Minka). Las claves de esas identidades están en la VM de Giano; si no puedes, aprueba tus propias wallets desde la pestaña Minka de un contrato donde seas admin (o corre `./scripts/demo-minka-testnet.sh` con tus identidades: `ADMIN=… ISSUER=… ANA=… LUIS=…`).
3. `npm run deploy` cuando la wallet funcione.
4. Si algo de la UX no te cuadra, el comportamiento por rol está concentrado en `MarketDashboard.tsx` (pestañas visibles y aterrizaje) y en cada `*Tab`/`*Panel`.

## Estado

- [ ] Revisado y probado con wallet por Leo (fecha): ____
