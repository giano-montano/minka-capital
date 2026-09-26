# Instructivo para grabar el video demo

Reproduce la demo en **cualquier máquina** desde un clon limpio del repo y la deja lista para grabar con OBS. Cada paso se puede repetir sin romper nada. Para "resetear" la demo basta con volver a correr el script: despliega un contrato nuevo con el estado inicial.

El guion hablado está en [`pitch.md`](pitch.md). Tiempo total de preparación: ~20 minutos la primera vez y ~5 minutos las siguientes.

## 0. Qué vas a grabar

El pitch es **expositivo**: una sola toma bajando por la landing `/` mientras lees [`pitch.md`](pitch.md). No hace falta conectar wallets ni firmar nada en vivo; la sección "En vivo desde Stellar RPC" muestra el contrato real.

| Tiempo | Sección de la landing | Acción |
| --- | --- | --- |
| 0:00 – 0:12 | Hero | Deja que el globo termine de girar hasta Perú. |
| 0:12 – 0:35 | El problema | Scroll hasta ver las tres tarjetas y la frase "Lo que falta es el puente". |
| 0:35 – 1:22 | Cómo funciona | Scroll paso a paso (01 → 05), centrando cada uno y dejando correr su animación. |
| 1:22 – 1:38 | En vivo desde Stellar RPC | Métricas y feed con enlaces a las transacciones. |
| 1:38 – 2:00 | La visión → Súmate a la minka | Scroll lento hasta el cierre. |

Toma extra opcional (para una versión larga o para las preguntas): el claim en vivo de Luis desde `/app` (pasos 6 y 8), o como **LumiSolar**, fondear y registrar un segundo ingreso y ver subir el reclamable de Ana.

## 1. Requisitos (una sola vez)

| Herramienta | Para qué | Cómo |
| --- | --- | --- |
| Git | Clonar | Ya lo tienes |
| Node.js 22+ | Dashboard | [nodejs.org](https://nodejs.org) o `nvm install 22` |
| Rust (rustup) | Compilar el contrato | [rustup.rs](https://rustup.rs). La versión exacta (1.93 + `wasm32v1-none`) se instala sola desde `rust-toolchain.toml` |
| Compilador C | Enlazar Rust | Linux/WSL: `sudo apt install build-essential` · macOS: `xcode-select --install` |
| Stellar CLI | Cuentas, deploy e invocaciones | macOS: `brew install stellar-cli` · Linux/WSL: binario de [releases](https://github.com/stellar/stellar-cli/releases) en tu `PATH` · Cualquier SO: `cargo install --locked stellar-cli` (lento) |
| Navegador Chromium (Chrome, Brave, Edge) | Grabar | Las etiquetas de ciudades del globo no aparecen en Firefox |
| [Freighter](https://www.freighter.app) | Wallet | Extensión del navegador |
| OBS Studio | Grabar | [obsproject.com](https://obsproject.com) |

**Windows:** usa **WSL2 (Ubuntu)** para los pasos 2 y 3 y sigue las instrucciones de Linux. El navegador y OBS van en Windows: `localhost:5173` de WSL se abre directo desde Windows.

Espacio en disco: ~4 GB (toolchain de Rust + `node_modules` + build).

Comprueba todo con:

```bash
git --version && node --version && cargo --version && stellar --version && cc --version | head -1
```

## 2. Preparar el repo (idempotente)

```bash
git clone https://github.com/giano-montano/stellar-hackathon-wazaa.git   # si ya lo tienes: git pull
cd stellar-hackathon-wazaa
git checkout dev-leo          # o main, cuando se mergee
cd _scaffold_base
npm ci                        # reinstala exactamente el lockfile; se puede repetir
cargo test -p minka-market    # 27 pruebas en verde (la primera vez tarda 1-3 min)
```

## 3. Dejar la demo lista en Testnet

### Opción A — Contrato propio (recomendada, funciona en cualquier máquina)

```bash
./scripts/demo-minka-testnet.sh
```

Tarda unos 3-5 minutos y hace todo solo:

1. Crea (o reutiliza) cuatro identidades de Stellar CLI (`minka-admin`, `lumisolar`, `ana`, `luis`) fondeadas con Friendbot.
2. Compra **USDC de Circle en el DEX de Testnet** con XLM: no hace falta faucet.
3. Compila y despliega un contrato `minka-market` **nuevo**.
4. Ejecuta la demo: aprobaciones, `LUMI-RSN` (10 USDC × 1000 unidades), Ana compra 6 y Luis 4, 20 USDC de ingresos, Ana reclama 12.
5. Deja **8 USDC reclamables para Luis** (el claim en vivo del video) y 20 USDC en LumiSolar para la toma extra.
6. Escribe `app/.env.local` apuntando al contrato nuevo y guarda los hashes en `demo-testnet.log`.

**Para repetir desde cero** (por ejemplo, si Luis ya reclamó en una toma fallida), vuelve a correr el mismo comando: reutiliza las cuentas y despliega otro contrato limpio.

### Opción B — Contrato oficial del README (`CDQ7…`)

Solo sirve en la máquina que tiene las claves de las identidades oficiales, que hoy es la VM de Giano:

```bash
cp app/.env.production app/.env.local
```

Ojo: si Luis ya reclamó sus 8 USDC en el contrato oficial, no hay claim en vivo. Además, Stellar RPC conserva solo ~7 días de eventos, así que después del 2 de octubre de 2026 el feed del contrato oficial sale casi vacío. En cualquiera de los dos casos, usa la Opción A.

## 4. Levantar el dashboard

```bash
cd app
npx vite            # http://localhost:5173
```

- **Si el repo está en una VM o servidor remoto**, abre un túnel SSH desde tu máquina: `ssh -L 5173:localhost:5173 usuario@ip-de-la-vm`, y luego abre `http://localhost:5173`. Alternativa: `npx vite --host` y entra por `http://ip-de-la-vm:5173`, pero Freighter firma mejor en `localhost`.
- No uses `npm run dev`: además de Vite, lanza una red local de Stellar que no necesitas.

Verifica que `http://localhost:5173/app` muestre `LUMI-RSN` y el feed con eventos.

## 5. Preparar Freighter (antes de abrir OBS)

1. Crea un **perfil de navegador nuevo** solo para grabar: sin marcadores, sin extensiones extra y sin datos personales.
2. Instala Freighter en ese perfil, crea una wallet cualquiera y en **Settings → Network** elige **Testnet**.
3. Importa las cuentas demo. En la terminal (fuera de cámara):

   ```bash
   stellar keys secret luis        # cópiala y pégala en Freighter
   stellar keys secret lumisolar   # opcional, para la toma extra
   ```

   En Freighter: menú de cuentas → **Import a Stellar secret key** → pega → renombra la cuenta como "Luis" o "LumiSolar". Borra el portapapeles después.
4. Deja **Luis** como cuenta activa.

Son claves de Testnet sin valor real, pero **nunca las muestres en cámara ni las pegues en un chat**.

## 6. Checklist previo a grabar (30 segundos)

Desde `_scaffold_base`, con `ID` = el contrato de `app/.env.local`:

```bash
ID=$(grep PUBLIC_MINKA_MARKET_ID app/.env.local | cut -d= -f2)
stellar contract invoke --network testnet --source-account luis --id "$ID" --send=no -- \
  get_position --offering_id 0 --investor luis
# Esperado: "claimable":"80000000"  (8 USDC)
```

- [ ] Luis tiene 8 USDC reclamables (comando de arriba).
- [ ] La landing carga el globo y las métricas no dicen "…".
- [ ] `/app` muestra el feed "En vivo" con eventos.
- [ ] Freighter está en Testnet con Luis activo, **sin conectar todavía** al sitio (conectarlo es parte del video).
- [ ] Notificaciones del sistema desactivadas (modo "No molestar").

## 7. Configurar OBS

| Ajuste | Valor |
| --- | --- |
| Resolución (base y salida) | 1920×1080 |
| FPS | 30 |
| Formato de grabación | MKV (si OBS se cuelga no pierdes el video); al terminar usa **Archivo → Remux** a MP4 |
| Fuente de video | **Captura de ventana** del navegador (no de pantalla completa: evita que se vean notificaciones) |
| Audio | Micrófono con filtros **Supresión de ruido** (RNNoise) y **Compresor** |
| Navegador | Pantalla completa (F11), zoom 110-125 % para que se lea el texto, barra de marcadores oculta |

Escenas sugeridas: **"Navegador"** (captura de ventana) y **"Navegador + cámara"** (tu webcam en una esquina, para el problema y el cierre).

Graba primero una prueba de 10 segundos y revisa audio y nitidez.

## 8. Grabar

1. Abre `http://localhost:5173/` y deja que el globo termine su entrada.
2. Empieza a grabar y sigue la tabla del paso 0 leyendo [`pitch.md`](pitch.md).
3. Solo para la toma extra del claim: **Connect** → elige Freighter → aprueba la conexión → **Cobrar 8 USDC** (pestaña Mi portafolio) → firma en Freighter. Quédate en silencio hasta que aparezca el evento `Claim` en el feed (~5 s).
4. Si algo falla en vivo, detén la grabación, corre `./scripts/demo-minka-testnet.sh` de nuevo (paso 3), reinicia `npx vite` para que tome el `.env.local` nuevo y repite desde el paso 6.

## 9. Problemas comunes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `linker 'cc' not found` | Falta el compilador C | Paso 1: `build-essential` o `xcode-select --install` |
| El script falla en `buy … USDC` | Poca liquidez de USDC en el DEX de Testnet | Espera unos minutos y reintenta, o pide USDC en [faucet.circle.com](https://faucet.circle.com) para esa dirección (`stellar keys address luis`) y vuelve a correr el script |
| El script falla en `generate` o Friendbot | Friendbot caído o con límite | Reintenta en unos minutos; las identidades creadas se reutilizan |
| Dashboard dice "Contrato Testnet pendiente de configurar" | No hay `app/.env.local` | Corre el script (Opción A) o copia `.env.production` (Opción B) y reinicia Vite |
| Métricas o feed vacíos | Vite arrancó antes de que existiera `.env.local` | Reinicia `npx vite` |
| Freighter: "network mismatch" / "otra red" | Freighter no está en Testnet | Settings → Network → Testnet |
| El claim dice que no hay nada que reclamar | Luis ya reclamó en una toma anterior | Vuelve a correr el script (paso 3) |
| El globo no aparece | WebGL desactivado en el navegador | Activa la aceleración por hardware en la configuración del navegador |
| No se ven las etiquetas de ciudades | Firefox todavía no soporta CSS anchor positioning | Graba con Chrome, Brave o Edge |
