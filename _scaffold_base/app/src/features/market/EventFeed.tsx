import { minkaConfig } from "../../lib/minkaConfig"
import { formatUnits, formatUsdc, shortId } from "./format"
import styles from "./Market.module.css"
import { type MarketEvent } from "./types"

const LABELS: Record<string, string> = {
	offering_created: "Oferta creada",
	offering_pause_changed: "Estado de la oferta",
	investor_status_changed: "Allowlist",
	investment_recorded: "Inversión",
	raise_withdrawn: "Retiro de capital",
	distribution_funded: "Fondeo de distribuciones",
	revenue_recorded: "Ingreso verificado",
	claim_recorded: "Claim",
}

const big = (value: unknown) =>
	typeof value === "bigint" ? value : BigInt(String(value ?? 0))
const who = (value: unknown) => shortId(String(value ?? ""))

export function describeEvent(event: MarketEvent): string {
	const { data, topics } = event
	switch (event.kind) {
		case "offering_created":
			return `${formatUnits(big(data.target_units))} unidades a ${formatUsdc(big(data.unit_price))} USDC c/u`
		case "offering_pause_changed":
			return data.paused ? "Inversiones pausadas" : "Inversiones reanudadas"
		case "investor_status_changed":
			return `${who(topics[0])} ${data.approved ? "aprobada" : "retirada de la allowlist"}`
		case "investment_recorded":
			return `${who(topics[0])} adquiere ${formatUnits(big(data.units))} unidades por ${formatUsdc(big(data.amount))} USDC`
		case "raise_withdrawn":
			return `${formatUsdc(big(data.amount))} USDC liberados a ${who(topics[0])}`
		case "distribution_funded":
			return `${formatUsdc(big(data.amount))} USDC depositados para retornos`
		case "revenue_recorded":
			return `REV-${String(topics[0])}: ${formatUsdc(big(data.amount))} USDC distribuidos pro-rata`
		case "claim_recorded":
			return `${who(topics[0])} reclama ${formatUsdc(big(data.amount))} USDC`
		default:
			return JSON.stringify(data, (_, v: unknown) =>
				typeof v === "bigint" ? v.toString() : v,
			)
	}
}

interface Props {
	events: MarketEvent[]
	isLoading: boolean
	error?: string
	lastSyncedLedger?: number
}

export function EventFeed({
	events,
	isLoading,
	error,
	lastSyncedLedger,
}: Props) {
	return (
		<section className={styles.panel} aria-live="polite">
			<div className={styles.panelHeader}>
				<div>
					<p className={styles.eyebrow}>
						AUDITORÍA EN TIEMPO REAL · STELLAR RPC
					</p>
					<h2>Actividad de la oferta</h2>
				</div>
				<span className={error ? styles.statusError : styles.statusLive}>
					{error
						? "RPC sin conexión"
						: lastSyncedLedger
							? `En vivo · ledger ${lastSyncedLedger.toLocaleString("es-PE")}`
							: "Conectando…"}
				</span>
			</div>

			{isLoading ? (
				<p className={styles.muted}>Cargando eventos del contrato…</p>
			) : events.length === 0 ? (
				<p className={styles.muted}>Aún no hay eventos para este contrato.</p>
			) : (
				<ol className={styles.events}>
					{events.map((event) => (
						<li key={event.id}>
							<strong>{LABELS[event.kind] ?? event.kind}</strong>
							<span>{describeEvent(event)}</span>
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
