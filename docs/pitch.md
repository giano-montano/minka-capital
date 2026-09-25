# Pitch final — Minka Capital (2:00)

Guion para leer en voz alta mientras corre el video. A ritmo de pitch (~150 palabras por minuto) son unas 275 palabras (~1:50 hablado); los segundos restantes son pausas y la espera del claim en vivo. Los bloques están cronometrados: si te pasas en uno, recorta del siguiente, nunca del cierre.

| Bloque | Tiempo | Objetivo | En pantalla |
| --- | --- | --- | --- |
| 1. Problema | 0:00 – 0:30 | Que el jurado sienta el dolor | Landing: el globo entrando a Perú |
| 2. Solución | 0:30 – 1:30 | Mostrar que funciona, hoy y en vivo | Dashboard `/app` + claim en vivo |
| 3. Visión | 1:30 – 2:00 | Que nos imaginen en grande | Landing: métricas en vivo + logo |

El instructivo para grabarlo está en [`video-demo.md`](video-demo.md).

---

## 1. Problema — 0:00 a 0:30 (~80 palabras)

> **[Globo girando hasta Perú]**
>
> Piensa en Rosa. Tiene una startup de paneles solares en Arequipa. Vende todos los meses, tiene clientes… y aun así, para crecer, solo le quedan dos caminos: un banco que le pide garantías que no tiene, o un fondo que le quita parte de su empresa.
>
> Y del otro lado, miles de peruanos que quieren invertir en su propio país… pero no tienen cómo, ni cómo confiar en lo que les reportan.
>
> **El capital existe. Lo que falta es el puente.**

**Remate visual:** en "el puente", corta al dashboard.

---

## 2. Solución — 0:30 a 1:30 (~130 palabras + ~8 s de silencio durante el claim)

> **[Dashboard `/app`: catálogo con LUMI-RSN]**
>
> Ese puente es **Minka Capital**. En quechua, *mink'a* es trabajo colectivo: la comunidad se junta para construir lo que nadie levanta solo.
>
> Así funciona. Minka aprueba a empresas e inversionistas. La startup publica una **nota de participación en sus ingresos**: tú no compras acciones, compras una parte de sus ventas futuras. Inviertes desde **10 dólares en USDC**.
>
> **[Feed de eventos]**
>
> Cada vez que la empresa vende, registra ese ingreso en la blockchain de **Stellar**, y el contrato reparte a cada inversionista su parte exacta, automáticamente. Nadie puede tocar tu retorno: ni la empresa, ni nosotros. Y todo queda auditable, transacción por transacción.
>
> **[Luis conecta su wallet → Claim → el evento aparece en el feed]**
>
> Miren: Luis tiene 8 dólares de retorno. Un clic… y en cinco segundos están en su wallet. Esto no es un mockup: **está corriendo en Stellar ahora mismo**.

**Tecnología en una frase, si preguntan:** contrato inteligente Soroban en Rust, pagos en USDC de Circle y un dashboard que escucha la blockchain en tiempo real.

---

## 3. Visión — 1:30 a 2:00 (~65 palabras)

> **[Landing: métricas en vivo; zoom al logo]**
>
> Ahora imagínenlo conectado al punto de venta de cada negocio: la bodega, la cafetería, la startup de Rosa. Cada venta real alimenta el retorno de su comunidad en segundos.
>
> Cualquier emprendedor del Perú financiándose sin hipotecar su casa, y cualquier peruano invirtiendo en lo que conoce, con diez dólares.
>
> Eso es Minka Capital: **el Perú entero invirtiendo en el Perú.**
>
> Súmate a la minka.

---

## Claves de entrega

- **Arranca fuerte:** nada de "hola, somos el equipo…". La primera palabra es "Piensa".
- **Pausa de un segundo** antes de "El capital existe. Lo que falta es el puente." y antes de la última frase.
- **El claim en vivo es el clímax:** di "un clic…", haz el clic y quédate callado hasta que aparezca el evento.
- **Mira a la cámara** en el bloque 3; ya no hace falta señalar la pantalla.
- Los montos del guion (10 USDC por unidad, 8 USDC de Luis) coinciden con el estado que deja `scripts/demo-minka-testnet.sh`. Si cambias los montos del script, cambia también el guion.

## Preguntas probables del jurado (respuestas de 15 segundos)

| Pregunta | Respuesta |
| --- | --- |
| ¿Por qué Stellar? | Liquidación en ~5 segundos por centavos, USDC nativo de Circle sin puentes, y contratos Soroban con eventos auditables. Es la red pensada para pagos. |
| ¿Quién garantiza que la empresa reporte sus ventas? | En el MVP la empresa registra sus ingresos con su wallet, y cada registro queda firmado y público. El siguiente paso es un oráculo conectado a su POS o a su facturación electrónica, sin intervención humana. |
| ¿Es legal? | Hoy es un prototipo en Testnet con activos ficticios. El camino es operar bajo el régimen de Financiamiento Participativo Financiero supervisado por la SMV, con un proveedor de KYC/AML. |
| ¿Qué impide que la plataforma se quede con la plata? | El contrato separa el dinero de cada oferta en tres compartimentos: capital, fondeo y retornos. El admin de Minka no puede retirar el capital de una empresa ni tocar los retornos de los inversionistas; está en el código y cubierto por 27 tests. |
| ¿Cómo ganan dinero? | (Propuesta, ajústenla como equipo.) Comisión por oferta publicada y un pequeño porcentaje de lo levantado, como una plataforma de financiamiento participativo tradicional, pero con costos operativos mucho menores. |
| ¿Qué pasa si la startup no vende? | El inversionista asume ese riesgo, igual que en cualquier inversión basada en ingresos. La diferencia es que lo ve en tiempo real, no en un reporte trimestral. |
