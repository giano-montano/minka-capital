# Handoff 2026-09-25 — Giano → Leo (y su agente)

> **Agente de Leo: lee este archivo completo y ejecuta la sección "Checklist para Leo" en orden antes de cualquier otra tarea.** Después márcalo como hecho (sección "Estado") y commitea el cambio. No reviertas el cambio de contrato ni la landing sin preguntarle a Giano.

## TL;DR

1. **Cambió el contrato oficial** a `CDQ7YOMBZVPI3QPC7NTKHKQ57MKYFWSEJJBKC5KVGHQU3X6BZ5MQXWZ5`, que ya tiene la demo completa ejecutada en Testnet. El tuyo (`CD4QC…`) queda como versión anterior.
2. **El sitio de Cloudflare sigue con el build viejo** (contrato viejo, sin landing). Hay que redesplegar desde tu cuenta: es lo único que bloquea la entrega.
3. **Nueva landing** en `/` con un globo 3D interactivo de Perú y datos en vivo del contrato; el dashboard se movió a **`/app`**.
4. Tu wallet de empresa `GD3LSZ…` **ya está aprobada como emisora** en el contrato nuevo; puedes republicar `DSC` desde la consola de emisora.

## Checklist para Leo

```powershell
git checkout dev-leo
git pull
cd _scaffold_base
npm install                      # nueva dependencia: cobe (globo WebGL, ~5 KB, MIT)
cd app
npx tsc -b; npx eslint src; npx vite build   # debe pasar limpio
npx vite                          # revisar http://localhost:5173/ (landing) y /app (dashboard)
npm run deploy                    # redeploy a Cloudflare con .env.production nuevo
```

Luego, en **https://minka-capital.a20212540.workers.dev**:

- [ ] `/` muestra la landing con el globo girando hacia Perú; las stats dicen 1+ ofertas y 100+ USDC levantados.
- [ ] El ticker "En vivo desde Stellar RPC" muestra eventos de `LUMI-RSN`.
- [ ] `/app` carga el dashboard con `LUMI-RSN` (10/1000 unidades) y el feed completo.
- [ ] Recargar directamente `/app` funciona (fallback SPA de `wrangler.jsonc`).
- [ ] Con Freighter en Testnet y tu wallet de empresa, la consola de emisora aparece; republica `DSC` si la quieres en la demo.
- [ ] Probar en celular: el globo se arrastra con el dedo, los botones +/− hacen zoom y la página no se desborda horizontalmente.

Si algo falla, no cambies de contrato: avisa a Giano.

## Contrato y cuentas (Testnet)

| Qué | Valor |
| --- | --- |
| Contrato oficial `minka-market` | `CDQ7YOMBZVPI3QPC7NTKHKQ57MKYFWSEJJBKC5KVGHQU3X6BZ5MQXWZ5` (ledger de despliegue 4870111) |
| SAC USDC (Circle) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Admin de Minka (`minka-admin`) | `GDD2SF6X2LCDKUTCGFYGO2ZT2RLRK4S2DRBST35REN2WYZAUQOAF7YE2` |
| LumiSolar (`lumisolar`) | `GBM4UZQ32XGNEJELA7ZRCXZGK7PFBXZHKPZO4MM5EUB2B2CLF63JX3OX` — emisora de `LUMI-RSN` (id 0) |
| Ana (`ana`) | `GB5B6PYYXT7QOSUTXGIMFB5X3DQXL63YZREMQKS4MXVY4MAEKTS5BHKH` — 6 unidades, ya reclamó 12 USDC |
| Luis (`luis`) | `GAQYU3BEVUVI2ATUTRQHEJMVQNGVNCNKKB4WOFYSEBWXC6B32OFN3DHM` — 4 unidades, **8 USDC sin reclamar (reservados para el claim en vivo del video; no los reclames antes)** |
| Empresa de Leo | `GD3LSZMCIBURLOZRQZ6BODBGGMIILKKU5LVXDLZYDM32J3RD366A3I53` — aprobada como emisora (tx `da9979e0…`) |

- Las 10 transacciones de la demo están enlazadas en el README ("Transacciones de la demo").
- Las **claves secretas** de estas identidades viven solo en la Stellar CLI de la VM de Giano. Nunca van al repo ni al chat. Si necesitas operar como admin o como Luis para el video, pídele a Giano que te apruebe una wallet o que importe la clave en su Freighter.
- `app/.env.production` ya apunta a `CDQ7…` y al ledger 4870111. `app/.env` es local (gitignored): cópialo de `.env.production`.
- Stellar RPC conserva ~7 días de eventos: la historia de la demo sale del feed alrededor del **2 de octubre**; después el feed muestra un aviso con enlace a Stellar Expert (ya implementado). Si el video se graba después, vuelve a ejecutar algún paso para que haya eventos frescos.

## Qué cambió en esta tanda (commits en `dev-leo`)

| Commit | Qué |
| --- | --- |
| `feat: run full Minka demo on Testnet from Linux` | `scripts/demo-minka-testnet.sh`: identidades, USDC comprado en el DEX, deploy y pasos 1-6 con hashes |
| `fix: keep full event history within the RPC retention window` | El feed ya no se limita a 1 día; usa `getHealth().oldestLedger`. `.env.production` → `CDQ7…` |
| `chore: make demo script settings overridable` | Variables de entorno para asset, identidades y montos |
| `docs: align architecture, spec and handoff…` | Arquitectura reescrita (3 roles, tesorería segregada), spec, planes a `docs/archive/`, guion del video en README |
| `feat: Peruvian landing page…` | Landing en `/`, dashboard en `/app`, este handoff |

### Landing (`/`)

- Archivos: `app/src/pages/Landing.tsx`, `app/src/features/landing/{PeruGlobe.tsx,Chakana.tsx,Landing.module.css}`.
- **Hero:** globo WebGL con [`cobe`](https://github.com/shuding/cobe) centrado en Perú, con marcadores en Lima, Cusco, Arequipa, Trujillo, Iquitos, Piura y Puno y arcos desde Lima. Arranca como planeta completo y hace zoom hasta un primer plano de Perú (escala 3, mapa de 32 000 puntos: no subir de 32 767, el shader de cobe no dibuja el hemisferio sur por encima de ese límite); se explora arrastrando con mouse o dedo, tiene botones +/− de zoom (1.1 a 5) y vuelve solo a Perú al soltar. Las etiquetas de ciudades usan CSS anchor positioning (Chrome/Edge/Safari recientes); en Firefox simplemente no aparecen, sin romper nada.
- **Identidad:** chakana como logo, franjas de tocapu (patrón textil inca) como separadores, paleta cochinilla `#ee295c` / oro inca `#ffb733` / verde selva `#33d99a` sobre índigo `#0b0918`. Tipografías Space Grotesk + JetBrains Mono (Google Fonts en `index.html`).
- **Datos en vivo:** reutiliza `useMarketSnapshot` y `useMarketEvents`: ofertas, capital levantado, retornos distribuidos, inversionistas y un ticker de eventos con link a cada tx.
- Respeta `prefers-reduced-motion`.

### Rutas

| Ruta | Página |
| --- | --- |
| `/` | Landing (sin el header del scaffold) |
| `/app` | Dashboard Minka (antes en `/`) |
| `/debug`, `/debug/:contractName` | Contract explorer del scaffold |

Los smoke tests de Playwright (`e2e/tests/smoke.spec.ts`) se actualizaron a `/app` y hay uno nuevo para la landing.

## Pendiente después del checklist

1. **Video de 2 minutos**: seguir el "Guion de la demo en el dashboard" del README; abrir con la landing (globo + stats en vivo) y terminar con el claim en vivo de Luis.
2. **Limpiar el scaffold**: borrar `contracts/guess-the-number`, `nft-enumerable`, `fungible-allowlist` y sus entradas en `environments.toml`; ocultar o renombrar "Fund Account" (solo da XLM).
3. **Tests de frontend** (Vitest + Testing Library).
4. **PR `dev-leo` → `main`** cuando todo esté verde.

## Estado

- [ ] Checklist para Leo completado (fecha, quién): ____
