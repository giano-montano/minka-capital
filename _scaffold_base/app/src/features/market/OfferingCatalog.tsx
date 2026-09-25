import { formatUnits, formatUsdc, percent, shortId } from "./format"
import styles from "./Market.module.css"
import { type Offering } from "./types"

interface Props {
	offerings: Offering[]
	selectedId?: number
	onSelect: (id: number) => void
}

/** Every offering published on the platform; picking one drives the page. */
export function OfferingCatalog({ offerings, selectedId, onSelect }: Props) {
	return (
		<section>
			<p className={styles.eyebrow}>OFERTAS PUBLICADAS · {offerings.length}</p>
			<div className={styles.catalog}>
				{offerings.map((offering) => {
					const progress = percent(offering.sold_units, offering.target_units)
					const selected = offering.id === selectedId
					return (
						<button
							key={offering.id}
							type="button"
							className={selected ? styles.cardSelected : styles.card}
							aria-pressed={selected}
							onClick={() => onSelect(offering.id)}
						>
							<span className={styles.cardSymbol}>
								{offering.symbol}
								{offering.paused && (
									<span className={styles.badgeWarn}>pausada</span>
								)}
							</span>
							<strong>{offering.name}</strong>
							<span className={styles.muted}>
								{formatUsdc(offering.unit_price)} USDC por unidad ·{" "}
								{formatUnits(offering.target_units)} unidades
							</span>
							<span className={styles.miniProgress}>
								<i style={{ width: `${Math.min(progress, 100)}%` }} />
							</span>
							<span className={styles.muted}>
								{progress.toFixed(progress < 10 ? 1 : 0)}% colocado · emisor{" "}
								{shortId(offering.issuer)}
							</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
