# CLAUDE.md — Minka Capital (Stellar hackathon)

> **ANTES DE HACER NADA:** lee los archivos de `handoffs/` que no tengan su
> sección "Estado" marcada, empezando por el más antiguo (`handoffs/2026-09-25-giano-a-leo.md`, luego
> `handoffs/2026-09-26-dashboard-por-roles.md`),
> y ejecuta su checklist. Contiene acciones pendientes indispensables
> (redeploy de Cloudflare con el contrato nuevo).

Guía de traspaso para cualquier sesión de Claude Code (o persona) que continúe el
proyecto. Léela entera antes de tocar código. Estado al 25 de septiembre de 2026 (actualizada tras el redespliegue con demo completa).

## Qué es

Plataforma **multi-oferta** de mercado primario en **Stellar Testnet**: startups
peruanas publican participaciones en sus ingresos futuros, inversionistas
aprobados las compran con USDC Testnet y reclaman su parte pro-rata cada vez que
la empresa registra una venta. Prototipo exclusivamente para Testnet; no es una
oferta de inversión (el disclaimer debe seguir visible en la UI).

## Enlaces en vivo

| Qué | Dónde |
| --- | --- |
| Sitio desplegado (Cloudflare Workers) | **https://minka-capital.a20212540.workers.dev**: landing en `/`, dashboard en `/app` (cuenta Cloudflare de Leo; redeploy con `npm run deploy` desde `_scaffold_base/app`) |
| Contrato `minka-market` (Testnet, oficial) | [`CDQ7YOMBZVPI3QPC7NTKHKQ57MKYFWSEJJBKC5KVGHQU3X6BZ5MQXWZ5`](https://stellar.expert/explorer/testnet/contract/CDQ7YOMBZVPI3QPC7NTKHKQ57MKYFWSEJJBKC5KVGHQU3X6BZ5MQXWZ5), desplegado en el ledger 4870111 con la demo completa ejecutada |
| Contrato anterior (Leo) | [`CD4QCMLVUWY74ZDGCQCHIYNJ6BJRXSOEJHURJKQH6YLBFDMZIK3K2WI7`](https://stellar.expert/explorer/testnet/contract/CD4QCMLVUWY74ZDGCQCHIYNJ6BJRXSOEJHURJKQH6YLBFDMZIK3K2WI7), ya no se usa; ahí queda la oferta `DSC` de Leo |
| SAC USDC Testnet (Circle) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (emisor `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) |
| Repo / rama de trabajo | `giano-montano/stellar-hackathon-wazaa`, rama **`dev-leo`** (no `main`) |

## Roles y wallets demo (solo direcciones públicas)

Contrato oficial `CDQ7…`:

| Rol | Dirección | Notas |
| --- | --- | --- |
| Admin de Minka (`minka-admin`) | `GDD2SF6X2LCDKUTCGFYGO2ZT2RLRK4S2DRBST35REN2WYZAUQOAF7YE2` | Aprueba emisores e inversionistas |
| Empresa demo LumiSolar (`lumisolar`) | `GBM4UZQ32XGNEJELA7ZRCXZGK7PFBXZHKPZO4MM5EUB2B2CLF63JX3OX` | Emisora de `LUMI-RSN` (id 0): 10 USDC × 1000 unidades, 10 vendidas |
| Empresa de Leo | `GD3LSZMCIBURLOZRQZ6BODBGGMIILKKU5LVXDLZYDM32J3RD366A3I53` | Emisora aprobada; puede volver a publicar `DSC` desde el dashboard |
| Inversionista Ana (`ana`) | `GB5B6PYYXT7QOSUTXGIMFB5X3DQXL63YZREMQKS4MXVY4MAEKTS5BHKH` | 6 unidades; ya reclamó 12 USDC |
| Inversionista Luis (`luis`) | `GAQYU3BEVUVI2ATUTRQHEJMVQNGVNCNKKB4WOFYSEBWXC6B32OFN3DHM` | 4 unidades; **8 USDC reclamables** (reservados para el claim en vivo del video) |

Las claves secretas de estas identidades viven **solo** en la configuración de
Stellar CLI de la VM Ubuntu de Giano (`~/.config/stellar/identity/`), creadas por
`scripts/demo-minka-testnet.sh`. Las del contrato anterior siguen en la PC de Leo.
Nunca las subas al repo ni las pegues en el chat. Para operar como admin desde
otra máquina, pide a Giano que apruebe tus wallets (o importa la clave en
Freighter con `stellar keys secret <identidad>`, ejecutado por el dueño).

## Estructura

```text
README.md, docs/                       Propuesta, arquitectura, evidencia
_scaffold_base/contracts/minka-market/ Contrato Soroban (lib.rs) + 27 tests (test.rs)
_scaffold_base/app/                    Dashboard React/Vite
  src/pages/Landing.tsx                Landing en `/` (el dashboard vive en `/app`)
  src/features/landing/                Globo WebGL de Perú (cobe), chakana y estilos de la landing
  src/features/market/                 Todo el código del dashboard de Minka (pestañas por rol:
                                       ExploreTab, PortfolioTab, IssuerPanel = Mi empresa,
                                       PlatformAdminPanel = Minka, ActivityTab en MarketDashboard)
    contract.ts        Cliente (contract.Client.from, sin bindings), lecturas, errores
    useMarket.ts       Hooks react-query + useMarketAction (firma y envío)
    useMarketEvents.ts Feed en vivo: getEvents del RPC con cursor
    MarketDashboard.tsx, WalletStatus.tsx, ExploreTab.tsx, PortfolioTab.tsx,
    OfferingCatalog.tsx, OfferingOverview.tsx, IssuerPanel.tsx,
    PlatformAdminPanel.tsx, RevenueReportList.tsx, EventFeed.tsx
  .env.production      IDs públicos usados en el build desplegado
  wrangler.jsonc       Config de Cloudflare Workers (assets + SPA fallback)
_scaffold_base/scripts/demo-minka-testnet.sh    Demo completa en Testnet (bash): identidades, USDC, deploy y pasos 1-6
_scaffold_base/scripts/deploy-minka-testnet.ps1  Despliegue del contrato (Windows)
docs/pitch.md, docs/video-demo.md               Guion del pitch (2 min) e instructivo de grabación
docs/archive/                                    Planes originales (histórico, checkboxes sin marcar)
handoffs/                                        Traspasos entre miembros del equipo (leer los pendientes primero)
```

## API del contrato (resumen)

- `__constructor(admin, usdc)`.
- Admin: `set_issuer_status`, `set_investor_status` (allowlist global).
- Emisor: `create_offering(issuer, name, symbol≤12, unit_price, target_units) -> u32`,
  `update_offering` (libre hasta la 1.ª venta; después precio fijo y solo crecer),
  `set_paused` (emisor o admin), `withdraw_raise` (solo el emisor).
- **Utilidades (código actual, aún sin desplegar):** Minka habilita con
  `set_revenue_reporting(admin, offering_id, enabled)`; la empresa sube
  `submit_revenue_report(issuer, offering_id, reference, amount) -> report_id`
  (el USDC queda en custodia como `available`); Minka hace
  `approve_revenue_report` (pasa a `allocated`, se reparte pro-rata y emite
  `revenue_recorded`) o `reject_revenue_report` (devuelve el USDC a la empresa).
  Lecturas: `is_revenue_reporting_enabled`, `get_revenue_reports`, `get_revenue_report`.
  El contrato oficial `CDQ7…` todavía usa el flujo anterior (`fund_distributions` +
  `record_revenue` sin aprobación); el dashboard detecta cuál tiene el contrato
  desplegado (`supportsRevenueReports`) y muestra el flujo que corresponda.
- Inversionista: `invest(investor, offering_id, units)`, `claim(investor, offering_id)`.
- Lecturas: `get_offerings`, `get_offering`, `get_position(offering_id, investor)`,
  `is_issuer`, `is_investor_approved`, `get_admin`, `get_usdc`.
- Errores `Error(Contract, #n)` 1–19; la UI los traduce en `contract.ts` (`CONTRACT_ERRORS`).
  Si agregas uno en `lib.rs`, agrégalo también ahí.
- Montos en unidades atómicas de 7 decimales (1 USDC = `10000000`).

Cambiar la firma o el almacenamiento del contrato obliga a **redesplegar**
(nuevo Contract ID) y actualizar `app/.env`, `app/.env.production`,
`environments.toml`, README y esta tabla.

## Cómo correr

```powershell
# Tests del contrato (en Windows, Smart App Control bloquea los build scripts de cargo: usar Docker)
cd _scaffold_base
docker run --rm -v "${PWD}:/work" -v minka-target:/target -e CARGO_TARGET_DIR=/target -w /work rust:1.93 cargo test -p minka-market

# Dashboard local contra Testnet
cd _scaffold_base; npm install
copy app\.env.example app\.env   # y completar con los IDs de arriba
cd app; npx vite                 # http://localhost:5173  (no uses `npm run dev`: lanza stellar scaffold watch)

# Verificación del frontend
npx tsc -b; npx eslint src; npx vite build

# Desplegar el dashboard (requiere `npx wrangler login` una vez)
npm run deploy
```

En Linux (VM de Giano: Rust, Node 22 y Stellar CLI instalados en el usuario):

```bash
cd _scaffold_base
cargo test -p minka-market
./scripts/demo-minka-testnet.sh                 # demo completa (despliega un contrato nuevo)
cp app/.env.production app/.env && cd app && npx vite --host   # dashboard local contra el contrato oficial
```

Stellar CLI vía Docker (las identidades se montan en `/config`):

```bash
docker run --rm -v "C:/Users/<usuario>/.config/stellar:/config" stellar/stellar-cli:latest <comando>
```

## Trampas conocidas

- **Windows Smart App Control** bloquea `cargo build` local (os error 4551). Usa Docker.
- **Firewall Fortinet** en la red de la universidad re-firma `assets.ngrok.com`
  (`ERR_CERT_AUTHORITY_INVALID`). Es la red, no la app. Por eso se despliega en Cloudflare.
- La CLI de Stellar usa snake_case en argumentos: `--unit_price`, no `--unit-price`.
- El kit de wallets lanza objetos `{ code, message }`, no `Error`: usa `describeError`.
- Freighter debe estar en **Testnet**. Una wallet nueva necesita XLM (botón Fund Account = Friendbot) y trustline de USDC para recibir/enviar USDC.
- El faucet de Circle (faucet.circle.com) da 20 USDC por dirección cada 2 horas. Desde CLI, más rápido:
  comprar USDC con XLM en el DEX de Testnet (`path-payment-strict-receive`, como hace el script de demo).
- **Stellar RPC conserva ~7 días de eventos.** El feed arranca en `max(PUBLIC_MINKA_START_LEDGER, oldestLedger)`
  y muestra un aviso cuando la historia ya fue podada (la de la demo vence alrededor del 2 de octubre de 2026).
- El build de Cloudflare usa `app/.env.production`: cambiar de contrato exige `npm run deploy` de nuevo.

## Pendiente (en orden de prioridad)

1. ~~Demo end-to-end en Testnet~~: hecha el 25/09 sobre `CDQ7…`, con los hashes en el README.
2. **Redesplegar Cloudflare** (Leo, `npm run deploy`): `.env.production` ya apunta a `CDQ7…`
   pero el sitio publicado sigue con el build viejo. Después, probar con Freighter
   en escritorio y celular. Un teammate sin acceso a la cuenta Cloudflare de Leo
   puede desplegar en la suya con `npx wrangler login` + `npm run deploy` (la URL cambiará).
3. **Flujo de utilidades con permiso + aprobación de Minka** (Leo, 25/09):
   contrato (36 tests en verde), dashboard y `demo-minka-testnet.sh` listos en
   `dev-leo`, **sin desplegar** a propósito para no romper la demo de `CDQ7…`
   (Luis tiene 8 USDC reservados para el claim del video). Para activarlo, con
   visto bueno de Giano: desplegar el contrato nuevo, volver a correr la demo,
   actualizar `.env.production`, README y la tabla de este archivo, y `npm run deploy`.
4. **Limpiar el scaffold**: borrar `contracts/guess-the-number`, `nft-enumerable`,
   `fungible-allowlist` y sus entradas en `environments.toml`; renombrar/ocultar
   el botón "Fund Account" (solo da XLM de Friendbot, no USDC).
5. **Tests de frontend** (Vitest + Testing Library): disclaimer visible, estado
   vacío del feed, reglas de bloqueo de precio en `IssuerPanel`.
6. **Video demo de 2 minutos**: `docs/pitch.md` (guion) y `docs/video-demo.md` (cómo prepararlo y grabarlo con OBS en cualquier máquina).
7. **Pull request `dev-leo` → `main`** cuando todo lo anterior esté verde.
8. Opcional: recuperar los 30 USDC que quedaron en el contrato viejo de una sola
   oferta (`CDEJ6W6K…DMFMM`): claims de Ana (6) y Luis (4) y `withdraw_raise` del admin (20).

## Convenciones

- Trabajar y commitear en `dev-leo`. Mensajes de commit en inglés, estilo `feat:` / `fix:` / `docs:` / `chore:`.
- UI y documentación en español; código y comentarios en inglés.
- Nada de claves secretas en el repo, `.env*` ni chats.
