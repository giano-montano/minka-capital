import { type MarketSnapshot } from "./contract"
import { formatUnits, formatUsdc, percent } from "./format"
import styles from "./Market.module.css"

export function OfferingOverview({ snapshot }: { snapshot?: MarketSnapshot }) {
	const offering = snapshot?.offering
	const treasury = snapshot?.treasury
	const sold = offering?.sold_units ?? 0n
	const target = offering?.target_units ?? 0n
	const unitPrice = snapshot?.unitPrice ?? 0n
	const progress = percent(sold, target)
	const dash = "—"

	const metrics: Array<[string, string, string]> = [
		[
			"Precio por unidad",
			snapshot ? `${formatUsdc(unitPrice)} USDC` : dash,
			"LUMI-RSN",
		],
		[
			"Capital comprometido",
			snapshot ? `${formatUsdc(sold * unitPrice)} USDC` : dash,
			`de ${snapshot ? formatUsdc(target * unitPrice, 0) : dash} USDC objetivo`,
		],
		[
			"Retornos por reclamar",
			treasury ? `${formatUsdc(treasury.allocated)} USDC` : dash,
			"Asignados a inversionistas",
		],
		[
			"Tesorería de distribuciones",
			treasury ? `${formatUsdc(treasury.available)} USDC` : dash,
			"Fondeada, sin asignar",
		],
	]

	return (
		<>
			<section className={styles.offer}>
				<div>
					<p className={styles.eyebrow}>
						{offering?.paused ? "OFERTA PAUSADA" : "OFERTA ACTIVA"}
					</p>
					<h2>LumiSolar Perú · LUMI-RSN</h2>
					<p>Participación simulada en ingresos futuros.</p>
				</div>
				<div className={styles.progress}>
					<p>
						{snapshot
							? `${formatUnits(sold)} / ${formatUnits(target)} unidades`
							: "Leyendo contrato…"}{" "}
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
