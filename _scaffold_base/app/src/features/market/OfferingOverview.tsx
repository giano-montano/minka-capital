import { formatUnits, formatUsdc, percent } from "./format"
import styles from "./Market.module.css"
import { type Offering } from "./types"

export function OfferingOverview({ offering }: { offering: Offering }) {
	const { sold_units: sold, target_units: target, unit_price: price } = offering
	const progress = percent(sold, target)

	const metrics: Array<[string, string, string]> = [
		["Precio por unidad", `${formatUsdc(price)} USDC`, offering.symbol],
		[
			"Capital comprometido",
			`${formatUsdc(sold * price)} USDC`,
			`de ${formatUsdc(target * price, 0)} USDC objetivo`,
		],
		[
			"Retornos por reclamar",
			`${formatUsdc(offering.allocated)} USDC`,
			"Asignados a inversionistas",
		],
		[
			"Tesorería de distribuciones",
			`${formatUsdc(offering.available)} USDC`,
			"Fondeada, sin asignar",
		],
	]

	return (
		<>
			<section className={styles.offer}>
				<div>
					<p className={styles.eyebrow}>
						{offering.paused ? "OFERTA PAUSADA" : "OFERTA ACTIVA"}
					</p>
					<h2>
						{offering.name} · {offering.symbol}
					</h2>
					<p>Participación simulada en ingresos futuros.</p>
				</div>
				<div className={styles.progress}>
					<p>
						{formatUnits(sold)} / {formatUnits(target)} unidades{" "}
						<strong>{progress.toFixed(progress < 10 ? 1 : 0)}%</strong>
					</p>
					<span
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progress}
					>
						<i style={{ width: `${Math.min(progress, 100)}%` }} />
					</span>
				</div>
			</section>

			<section className={styles.metrics}>
				{metrics.map(([label, value, detail]) => (
					<article key={label}>
						<p>{label}</p>
						<strong>{value}</strong>
						<span>{detail}</span>
					</article>
				))}
			</section>
		</>
	)
}
