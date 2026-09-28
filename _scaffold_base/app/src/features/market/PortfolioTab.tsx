import { type UseQueryResult } from "@tanstack/react-query"
import { formatUnits, formatUsdc } from "./format"
import styles from "./Market.module.css"
import { type Offering, type Position } from "./types"
import { submit, useMarketAction } from "./useMarket"

interface Props {
	offerings: Offering[]
	positions: UseQueryResult<Position>[]
	isInvestor: boolean
	onExplore: (offeringId?: number) => void
}

/** Every position of the connected investor, with what is ready to collect. */
export function PortfolioTab({
	offerings,
	positions,
	isInvestor,
	onExplore,
}: Props) {
	const rows = offerings
		.map((offering, i) => ({ offering, position: positions[i]?.data }))
		.filter(
			(row) =>
				row.position &&
				(row.position.units > 0n || row.position.claimable > 0n),
		) as { offering: Offering; position: Position }[]
	const loading = positions.some((q) => q.isLoading)

	const invested = rows.reduce(
		(sum, r) => sum + r.position.units * r.offering.unit_price,
		0n,
	)
	const claimable = rows.reduce((sum, r) => sum + r.position.claimable, 0n)

	if (!loading && rows.length === 0) {
		return (
			<section className={styles.panel}>
				<p className={styles.eyebrow}>MI PORTAFOLIO</p>
				<h2>Todavía no tienes inversiones</h2>
				<p className={styles.muted}>
					{isInvestor
						? "Elige una oferta en Explorar y compra tus primeras unidades. Aquí verás tus retornos a medida que las empresas repartan utilidades."
						: "Primero Minka debe aprobar tu wallet como inversionista. Copia tu dirección en la barra superior y envíasela."}
				</p>
				<button
					type="button"
					className={styles.primary}
					onClick={() => onExplore()}
				>
					Explorar ofertas
				</button>
			</section>
		)
	}

	return (
		<>
			<section className={styles.metrics}>
				<article>
					<p>Invertido</p>
					<strong>{formatUsdc(invested)} USDC</strong>
					<span>
						en {rows.length} {rows.length === 1 ? "oferta" : "ofertas"}
					</span>
				</article>
				<article className={claimable > 0n ? styles.metricHot : undefined}>
					<p>Listo para cobrar</p>
					<strong>{formatUsdc(claimable)} USDC</strong>
					<span>
						{claimable > 0n
							? "Cóbralo cuando quieras, oferta por oferta"
							: "Aparece cuando una empresa reparte utilidades"}
					</span>
				</article>
			</section>

			<section className={styles.panel}>
				<p className={styles.eyebrow}>TUS POSICIONES</p>
				{loading && rows.length === 0 ? (
					<p className={styles.muted}>Leyendo tus posiciones…</p>
				) : (
					<ul className={styles.holdings}>
						{rows.map(({ offering, position }) => (
							<Holding
								key={offering.id}
								offering={offering}
								position={position}
								onOpen={() => onExplore(offering.id)}
							/>
						))}
					</ul>
				)}
			</section>
		</>
	)
}

function Holding({
	offering,
	position,
	onOpen,
}: {
	offering: Offering
	position: Position
	onOpen: () => void
}) {
	const claim = useMarketAction(
		`Cobraste tu retorno de ${offering.symbol} en USDC`,
	)
	const share =
		offering.sold_units > 0n
			? Number((position.units * 10_000n) / offering.sold_units) / 100
			: 0

	return (
		<li>
			<div>
				<button type="button" className={styles.linkButton} onClick={onOpen}>
					<span className={styles.cardSymbol}>{offering.symbol}</span>
					<strong>{offering.name}</strong>
				</button>
				<span className={styles.muted}>
					{formatUnits(position.units)} unidades ·{" "}
					{formatUsdc(position.units * offering.unit_price)} USDC invertidos ·{" "}
					{share.toFixed(share < 10 ? 1 : 0)}% de lo vendido
				</span>
			</div>
			<div className={styles.holdingClaim}>
				<span className={styles.muted}>Por cobrar</span>
				<strong>{formatUsdc(position.claimable)} USDC</strong>
			</div>
			<button
				type="button"
				className={styles.primary}
				disabled={position.claimable <= 0n || claim.isPending}
				onClick={() =>
					claim.mutate(async (client, investor) =>
						submit(await client.claim({ investor, offering_id: offering.id })),
					)
				}
			>
				{claim.isPending
					? "Firma en tu wallet…"
					: position.claimable > 0n
						? `Cobrar ${formatUsdc(position.claimable)} USDC`
						: "Nada por cobrar"}
			</button>
		</li>
	)
}
