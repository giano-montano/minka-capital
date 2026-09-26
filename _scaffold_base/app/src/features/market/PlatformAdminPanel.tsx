import { StrKey } from "@stellar/stellar-sdk"
import { useState } from "react"
import { formatUnits, formatUsdc, shortId } from "./format"
import styles from "./Market.module.css"
import {
	type MarketEvent,
	type MinkaMarketClient,
	type Offering,
	type RevenueReport,
	ReportStatus,
} from "./types"
import { submit, useAllRevenueReporting, useMarketAction } from "./useMarket"

type Role = "investor" | "issuer"

const ROLE_LABEL: Record<Role, string> = {
	investor: "Inversionista",
	issuer: "Empresa emisora",
}

interface Props {
	offerings: Offering[]
	/** Contract uses the permissioned revenue-report flow. */
	supportsRevenueReports: boolean
	events: MarketEvent[]
}

/**
 * Minka's console, ordered by urgency: reports waiting for review, who may
 * take part, and a control row per offering.
 */
export function PlatformAdminPanel({
	offerings,
	supportsRevenueReports,
	events,
}: Props) {
	const reporting = useAllRevenueReporting(offerings, supportsRevenueReports)

	return (
		<>
			{supportsRevenueReports ? (
				<ReviewQueue offerings={offerings} reporting={reporting} />
			) : (
				<section className={styles.panel}>
					<p className={styles.eyebrow}>UTILIDADES</p>
					<h2>Este contrato reparte sin revisión</h2>
					<p className={styles.muted}>
						El contrato desplegado usa el flujo anterior: cada empresa reparte
						sus utilidades directamente. Despliega la versión con reportes
						aprobados por Minka para revisar cada reparto aquí.
					</p>
				</section>
			)}
			<Participants events={events} />
			<OfferingControls
				offerings={offerings}
				supportsRevenueReports={supportsRevenueReports}
				reportingEnabled={reporting.map((q) => q.data?.enabled)}
			/>
		</>
	)
}

function ReviewQueue({
	offerings,
	reporting,
}: {
	offerings: Offering[]
	reporting: ReturnType<typeof useAllRevenueReporting>
}) {
	const pending = offerings.flatMap((offering, i) =>
		(reporting[i]?.data?.reports ?? [])
			.filter((r) => r.status === ReportStatus.Pending)
			.map((report) => ({ offering, report })),
	)
	const loading = reporting.some((q) => q.isLoading)

	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>POR REVISAR · {pending.length}</p>
			<h2>Reportes de utilidades</h2>
			{loading && pending.length === 0 ? (
				<p className={styles.muted}>Buscando reportes pendientes…</p>
			) : pending.length === 0 ? (
				<p className={styles.okNote}>
					Todo al día: no hay reportes esperando tu revisión.
				</p>
			) : (
				<ul className={styles.queue}>
					{pending.map(({ offering, report }) => (
						<PendingReport
							key={`${offering.id}-${report.id}`}
							offering={offering}
							report={report}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function PendingReport({
	offering,
	report,
}: {
	offering: Offering
	report: RevenueReport
}) {
	const approve = useMarketAction(
		`Utilidades de ${offering.symbol} aprobadas: ya son cobrables`,
	)
	const reject = useMarketAction(
		`Reporte de ${offering.symbol} rechazado: USDC devuelto a la empresa`,
	)
	const busy = approve.isPending || reject.isPending
	const perUnit =
		offering.sold_units > 0n ? report.amount / offering.sold_units : 0n
	const submitted = new Date(Number(report.submitted_at) * 1000)

	return (
		<li>
			<div>
				<span className={styles.cardSymbol}>{offering.symbol}</span>
				<strong>{formatUsdc(report.amount)} USDC</strong>
				<span className={styles.muted}>
					Ref. {report.reference.toString()} · enviado{" "}
					{submitted.toLocaleString("es-PE")} · ≈ {formatUsdc(perUnit)} USDC por
					unidad entre {formatUnits(offering.sold_units)} unidades
				</span>
			</div>
			<div className={styles.row}>
				<button
					type="button"
					className={styles.primary}
					disabled={busy}
					onClick={() =>
						approve.mutate(async (client, admin) =>
							submit(
								await client.approve_revenue_report({
									admin,
									offering_id: offering.id,
									report_id: report.id,
								}),
							),
						)
					}
				>
					{approve.isPending ? "Firma…" : "Aprobar y repartir"}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={() =>
						reject.mutate(async (client, admin) =>
							submit(
								await client.reject_revenue_report({
									admin,
									offering_id: offering.id,
									report_id: report.id,
								}),
							),
						)
					}
				>
					{reject.isPending ? "Firma…" : "Rechazar"}
				</button>
			</div>
		</li>
	)
}

/** Latest known status per account and role, from recent contract events. */
function participantsFrom(events: MarketEvent[]) {
	const seen = new Map<
		string,
		{ account: string; role: Role; approved: boolean }
	>()
	// Events are newest first, so the first one per key is the current status.
	for (const event of events) {
		const role: Role | undefined =
			event.kind === "issuer_status_changed"
				? "issuer"
				: event.kind === "investor_status_changed"
					? "investor"
					: undefined
		if (!role) continue
		const account = String(event.topics[0])
		const key = `${role}:${account}`
		if (!seen.has(key)) {
			seen.set(key, { account, role, approved: Boolean(event.data.approved) })
		}
	}
	return [...seen.values()]
}

function Participants({ events }: { events: MarketEvent[] }) {
	const [account, setAccount] = useState("")
	const [role, setRole] = useState<Role>("investor")
	const add = useMarketAction(`${ROLE_LABEL[role]} aprobado`)
	const target = account.trim()
	const valid = StrKey.isValidEd25519PublicKey(target)
	const participants = participantsFrom(events)

	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>PARTICIPANTES</p>
			<h2>Quién puede operar en Minka</h2>
			<form
				className={styles.approveForm}
				onSubmit={(event) => {
					event.preventDefault()
					if (!valid) return
					add.mutate(
						async (client, admin) =>
							submit(await setStatus(client, admin, role, target, true)),
						{ onSuccess: () => setAccount("") },
					)
				}}
			>
				<div className={styles.segmented} role="radiogroup">
					{(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
						<button
							key={r}
							type="button"
							role="radio"
							aria-checked={role === r}
							onClick={() => setRole(r)}
						>
							{ROLE_LABEL[r]}
						</button>
					))}
				</div>
				<input
					placeholder="Dirección de la wallet (G…)"
					aria-label="Dirección de la wallet"
					value={account}
					onChange={(event) => setAccount(event.target.value)}
				/>
				<button
					type="submit"
					className={styles.primary}
					disabled={!valid || add.isPending}
				>
					{add.isPending ? "Firma en tu wallet…" : "Aprobar"}
				</button>
			</form>
			{target !== "" && !valid && (
				<small className={styles.hint}>
					Revisa la dirección: debe empezar con G y tener 56 caracteres.
				</small>
			)}

			{participants.length > 0 ? (
				<ul className={styles.participants}>
					{participants.map((p) => (
						<ParticipantRow key={`${p.role}:${p.account}`} {...p} />
					))}
				</ul>
			) : (
				<p className={styles.muted}>
					No hay aprobaciones en la actividad reciente del contrato.
				</p>
			)}
			<small className={styles.muted}>
				Lista armada con la actividad on-chain de los últimos días (retención de
				Stellar RPC).
			</small>
		</section>
	)
}

function ParticipantRow({
	account,
	role,
	approved,
}: {
	account: string
	role: Role
	approved: boolean
}) {
	const toggle = useMarketAction(
		approved
			? `${ROLE_LABEL[role]} revocado`
			: `${ROLE_LABEL[role]} aprobado de nuevo`,
	)
	return (
		<li>
			<code title={account}>{shortId(account, 6)}</code>
			<span>{ROLE_LABEL[role]}</span>
			<span className={approved ? styles.badgeOk : styles.badgeMuted}>
				{approved ? "aprobado" : "revocado"}
			</span>
			<button
				type="button"
				disabled={toggle.isPending}
				onClick={() =>
					toggle.mutate(async (client, admin) =>
						submit(await setStatus(client, admin, role, account, !approved)),
					)
				}
			>
				{toggle.isPending ? "Firma…" : approved ? "Revocar" : "Aprobar"}
			</button>
		</li>
	)
}

function setStatus(
	client: MinkaMarketClient,
	admin: string,
	role: Role,
	account: string,
	approved: boolean,
) {
	return role === "issuer"
		? client.set_issuer_status({ admin, issuer: account, approved })
		: client.set_investor_status({ admin, investor: account, approved })
}

function OfferingControls({
	offerings,
	supportsRevenueReports,
	reportingEnabled,
}: {
	offerings: Offering[]
	supportsRevenueReports: boolean
	reportingEnabled: (boolean | undefined)[]
}) {
	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>OFERTAS · {offerings.length}</p>
			<h2>Control por oferta</h2>
			{offerings.length === 0 ? (
				<p className={styles.muted}>Aún no hay ofertas publicadas.</p>
			) : (
				<ul className={styles.participants}>
					{offerings.map((offering, i) => (
						<OfferingControlRow
							key={offering.id}
							offering={offering}
							supportsRevenueReports={supportsRevenueReports}
							reportingEnabled={reportingEnabled[i]}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function OfferingControlRow({
	offering,
	supportsRevenueReports,
	reportingEnabled,
}: {
	offering: Offering
	supportsRevenueReports: boolean
	reportingEnabled?: boolean
}) {
	const pause = useMarketAction(
		offering.paused
			? `${offering.symbol} reanudada`
			: `${offering.symbol} pausada por Minka`,
	)
	const permission = useMarketAction(
		reportingEnabled
			? `${offering.symbol} ya no puede reportar utilidades`
			: `${offering.symbol} puede reportar utilidades`,
	)

	return (
		<li>
			<span>
				<strong>{offering.symbol}</strong>{" "}
				<span className={styles.muted}>
					{formatUnits(offering.sold_units)}/
					{formatUnits(offering.target_units)} · emisor{" "}
					{shortId(offering.issuer)}
				</span>
			</span>
			{supportsRevenueReports && (
				<button
					type="button"
					disabled={reportingEnabled === undefined || permission.isPending}
					onClick={() =>
						permission.mutate(async (client, admin) =>
							submit(
								await client.set_revenue_reporting({
									admin,
									offering_id: offering.id,
									enabled: !reportingEnabled,
								}),
							),
						)
					}
				>
					{permission.isPending
						? "Firma…"
						: reportingEnabled
							? "Quitar permiso de utilidades"
							: "Permitir reportar utilidades"}
				</button>
			)}
			<button
				type="button"
				disabled={pause.isPending}
				onClick={() =>
					pause.mutate(async (client, caller) =>
						submit(
							await client.set_paused({
								caller,
								offering_id: offering.id,
								paused: !offering.paused,
							}),
						),
					)
				}
			>
				{pause.isPending ? "Firma…" : offering.paused ? "Reanudar" : "Pausar"}
			</button>
		</li>
	)
}
