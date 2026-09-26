# Pitch final — Minka Capital (2:00)

Pitch expositivo: hablas mientras bajas por la landing (`/`) de arriba abajo, sin abrir el dashboard ni firmar nada en vivo. Cada bloque del guion corresponde a una sección de la página; solo tienes que hacer scroll al terminar cada párrafo. A ritmo de pitch (~150 palabras por minuto) son unas 265 palabras (~1:45 hablado); los segundos restantes son pausas y scroll.

| Bloque | Tiempo | Objetivo | En pantalla (scroll) |
| --- | --- | --- | --- |
| 1. Gancho | 0:00 – 0:12 | Presentar a Rosa | Hero: el globo girando hasta Perú |
| 2. Problema | 0:12 – 0:35 | Que el jurado sienta el dolor | "El problema": las tres puertas cerradas |
| 3. Solución | 0:35 – 1:22 | Mostrar cómo funciona, paso a paso | "Cómo funciona": los 5 pasos animados |
| 4. Prueba | 1:22 – 1:38 | "No es un mockup" | "En vivo desde Stellar RPC" |
| 5. Visión | 1:38 – 2:00 | Que nos imaginen en grande | "La visión" → "Súmate a la minka" |

En "Cómo funciona" la animación de la derecha cambia sola al bajar: haz scroll hasta que el paso siguiente quede **centrado** en la pantalla y deja que su animación corra (~2 s) mientras hablas. El instructivo para grabarlo está en [`video-demo.md`](video-demo.md).

---

## 1. Gancho — 0:00 a 0:12 (~30 palabras)

> **[Hero: el globo termina de girar hasta Perú]**
>
> Piensa en Rosa. Rosa tiene una startup de paneles solares en Arequipa. Vende todos los meses, sus clientes la recomiendan… y aun así, **nadie la quiere financiar.**

**Scroll** a "El problema".

---

## 2. Problema — 0:12 a 0:35 (~60 palabras)

> **[Las tres tarjetas con ✕]**
>
> El banco le pide garantías que no tiene. Un fondo le ofrece capital… a cambio de un pedazo de su empresa. Y sus propios clientes, sus vecinos, le invertirían encantados, pero no tienen cómo, ni cómo saber si Rosa les va a pagar.
>
> *(pausa)* **El capital existe. Lo que falta es el puente.**

Di la última frase cuando "El capital existe. Lo que falta es el puente." esté en pantalla. **Scroll** a "Cómo funciona".

---

## 3. Solución — 0:35 a 1:22 (~125 palabras, una frase por paso)

> **[Título: "Un puente on-chain entre Rosa y su comunidad"]**
>
> Ese puente es **Minka Capital**. En quechua, *mink'a* es trabajo colectivo: la comunidad se junta para levantar lo que nadie levanta solo.
>
> **[Paso 01: aprobaciones]** Minka aprueba a las empresas y a los inversionistas.
>
> **[Paso 02: la oferta LUMI-RSN]** Rosa no vende acciones ni se endeuda: publica una **participación en sus ventas futuras**, en unidades de **10 dólares**.
>
> **[Paso 03: la custodia sube a 100 USDC]** Ana y Luis invierten en USDC desde su wallet, y ese dinero queda en custodia de un contrato inteligente en **Stellar**.
>
> **[Paso 04: el reparto 60/40]** Cada vez que Rosa vende, el contrato le da a cada uno su parte exacta. Ni Rosa ni nosotros podemos desviarla.
>
> **[Paso 05: el cobro de Luis]** Y Luis cobra con un clic: **en cinco segundos**, su plata está en su wallet.

**Scroll** a "En vivo desde Stellar RPC".

---

## 4. Prueba — 1:22 a 1:38 (~35 palabras)

> **[Métricas y feed de transacciones reales]**
>
> Y esto no es un mockup. Lo que ven aquí es el contrato real, **corriendo en Stellar ahora mismo**: cada inversión, cada venta y cada cobro, con su transacción pública.

**Scroll** lento por "Por qué Stellar" hasta "La visión".

---

## 5. Visión — 1:38 a 2:00 (~45 palabras)

> **[La bodega · La cafetería · La startup]**
>
> Ahora imagínenlo conectado a la caja de la bodega de la esquina, de la cafetería de tu barrio, de la startup de Rosa: cada venta real, repartida a su comunidad en segundos.
>
> **[Súmate a la minka]**
>
> Eso es Minka Capital: *(pausa)* **el Perú entero invirtiendo en el Perú.** Súmate a la minka.

---

## Claves de entrega

- **Arranca fuerte:** nada de "hola, somos el equipo…". La primera palabra es "Piensa".
- **Rosa es el hilo:** aparece al inicio, en la solución y en el cierre. Dilo con cariño, como si la conocieras.
- **Pausa de un segundo** antes de "El capital existe…" y antes de "el Perú entero invirtiendo en el Perú".
- **Scroll suave y al final de cada frase**, nunca en medio: la pantalla acompaña, no compite. Con la rueda del mouse, 2-3 "clics" por paso; practica una vez para calibrar.
- **"No es un mockup"** es el giro del pitch: hasta ahí todo era ilustrativo; di la frase con los datos en vivo ya visibles.
- Los montos de los pasos (10 USDC por unidad, 60/40 USDC, reparto 12/8, cobro de 8 USDC) coinciden con el estado que deja `scripts/demo-minka-testnet.sh`. Si cambias el script, cambia también `HowItWorks.tsx` y este guion.

## Preguntas probables del jurado (respuestas de 15 segundos)

| Pregunta | Respuesta |
| --- | --- |
| ¿Por qué Stellar? | Liquidación en ~5 segundos por centavos, USDC nativo de Circle sin puentes, y contratos Soroban con eventos auditables. Es la red pensada para pagos. |
| ¿Quién garantiza que la empresa reporte sus ventas? | En el MVP la empresa registra sus ingresos con su wallet, y cada registro queda firmado y público. El siguiente paso es un oráculo conectado a su POS o a su facturación electrónica, sin intervención humana. |
| ¿Es legal? | Hoy es un prototipo en Testnet con activos ficticios. El camino es operar bajo el régimen de Financiamiento Participativo Financiero supervisado por la SMV, con un proveedor de KYC/AML. |
| ¿Qué impide que la plataforma se quede con la plata? | El contrato separa el dinero de cada oferta en tres compartimentos: capital, fondeo y retornos. El admin de Minka no puede retirar el capital de una empresa ni tocar los retornos de los inversionistas; está en el código y cubierto por 27 tests. |
| ¿Cómo ganan dinero? | (Propuesta, ajústenla como equipo.) Comisión por oferta publicada y un pequeño porcentaje de lo levantado, como una plataforma de financiamiento participativo tradicional, pero con costos operativos mucho menores. |
| ¿Qué pasa si la startup no vende? | El inversionista asume ese riesgo, igual que en cualquier inversión basada en ingresos. La diferencia es que lo ve en tiempo real, no en un reporte trimestral. |
