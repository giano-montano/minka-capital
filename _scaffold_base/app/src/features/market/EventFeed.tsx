import { minkaConfig } from "../../lib/minkaConfig"
import { formatUnits, formatUsdc, shortId } from "./format"
import styles from "./Market.module.css"
import { type MarketEvent, type Offering } from "./types"

const LABELS: Record<string, string> = {
	issuer_status_changed: "Empresa emisora",
	investor_status_changed: "Allowlist",
	offering_created: "Oferta publicada",
	offering_updated: "Oferta editada",
	offering_pause_changed: "Estado de la oferta",
	investment_recorded: "Inversión",
	raise_withdrawn: "Retiro de capital",
	distribution_funded: "Fondeo de distribuciones",
	revenue_recorded: "Ingreso verificado",
	claim_recorded: "Claim",
}

// Events whose first topic is an offering id.
const OFFERING_EVENTS = new Set([
	"offering_created",
	"offering_updated",
	"offering_pause_changed",
	"investment_recorded",
	"raise_withdrawn",
	"distribution_funded",
	"revenue_recorded",
	"claim_recorded",
])

const big = (value: unknown) =>
	typeof value === "bigint" ? value : BigInt(String(value ?? 0))
const who = (value: unknown) => shortId(String(value ?? ""))

export function eventOfferingId(event: MarketEvent): number | undefined {
	return OFFERING_EVENTS.has(event.kind) ? Number(event.topics[0]) : undefined
}

export function describeEvent(
	event: MarketEvent,
	symbolOf: (id: number) => string,
): string {
	const { data, topics } = event
	const offeringId = eventOfferingId(event)
	const symbol = offeringId === undefined ? "" : symbolOf(offeringId)
	switch (event.kind) {
		case "issuer_status_changed":
			return `${who(topics[0])} ${data.approved ? "aprobada como emisora" : "ya no puede emitir"}`
		case "investor_status_changed":
			return `${who(topics[0])} ${data.approved ? "aprobada para invertir" : "retirada de la allowlist"}`
		case "offering_created":
			return `${String(data.name)} publica ${String(data.symbol)}: ${formatUnits(big(data.target_units))} unidades a ${formatUsdc(big(data.unit_price))} USDC`
		case "offering_updated":
			return `${symbol}: ${formatUnits(big(data.target_units))} unidades a ${formatUsdc(big(data.unit_price))} USDC`
		case "offering_pause_changed":
			return `${symbol}: ${data.paused ? "inversiones pausadas" : "inversiones reanudadas"}`
		case "investment_recorded":
			return `${who(topics[1])} adquiere ${formatUnits(big(data.units))} ${symbol} por ${formatUsdc(big(data.amount))} USDC`
		case "raise_withdrawn":
			return `${symbol}: ${formatUsdc(big(data.amount))} USDC liberados a ${who(topics[1])}`
		case "distribution_funded":
			return `${symbol}: ${formatUsdc(big(data.amount))} USDC depositados para retornos`
		case "revenue_recorded":
			return `${symbol} REV-${String(topics[1])}: ${formatUsdc(big(data.amount))} USDC distribuidos pro-rata`
		case "claim_recorded":
			return `${who(topics[1])} reclama ${formatUsdc(big(data.amount))} USDC de ${symbol}`
		default:
			return JSON.stringify(data, (_, v: unknown) =>
				typeof v === "bigint" ? v.toString() : v,
			)
	}
}

interface Props {
	events: MarketEvent[]
	offerings: Offering[]
	isLoading: boolean
	error?: string
	lastSyncedLedger?: number
	historyTruncated?: boolean
}

export function EventFeed({
	events,
	offerings,
	isLoading,
	error,
	lastSyncedLedger,
	historyTruncated,
}: Props) {
	const symbols = new Map(offerings.map((o) => [o.id, o.symbol]))
	const symbolOf = (id: number) => symbols.get(id) ?? `Oferta #${id}`

	return (
		<section className={styles.panel} aria-live="polite">
			<div className={styles.panelHeader}>
				<div>
					<p className={styles.eyebrow}>
						AUDITORÍA EN TIEMPO REAL · STELLAR RPC
					</p>
					<h2>Actividad de la plataforma</h2>
				</div>
				<span className={error ? styles.statusError : styles.statusLive}>
					{error
						? "RPC sin conexión"
						: lastSyncedLedger
							? `En vivo · ledger ${lastSyncedLedger.toLocaleString("es-PE")}`
							: "Conectando…"}
				</span>
			</div>

			{historyTruncated && !isLoading && (
				<p className={styles.muted}>
					Stellar RPC solo conserva los eventos de los últimos días; la
					actividad anterior sigue verificable en{" "}
					<a
						href={minkaConfig.contractUrl(minkaConfig.contractId)}
						target="_blank"
						rel="noreferrer"
					>
						Stellar Expert
					</a>
					.
				</p>
			)}

			{isLoading ? (
				<p className={styles.muted}>Cargando eventos del contrato…</p>
			) : events.length === 0 ? (
				<p className={styles.muted}>Aún no hay eventos para este contrato.</p>
			) : (
				<ol className={styles.events}>
					{events.map((event) => (
						<li key={event.id}>
							<strong>{LABELS[event.kind] ?? event.kind}</strong>
							<span>{describeEvent(event, symbolOf)}</span>
							<a
								href={minkaConfig.txUrl(event.txHash)}
								target="_blank"
								rel="noreferrer"
								title={`Ledger ${event.ledger} · ${new Date(event.closedAt).toLocaleString("es-PE")}`}
							>
								{shortId(event.txHash, 6)}
							</a>
						</li>
					))}
				</ol>
			)}
		</section>
	)
}
