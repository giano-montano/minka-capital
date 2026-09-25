import { StrKey } from "@stellar/stellar-sdk"
import { useState } from "react"
import { formatUsdc } from "./format"
import styles from "./Market.module.css"
import { RevenueReportList } from "./RevenueReportList"
import { type MinkaMarketClient, type Offering, ReportStatus } from "./types"
import { submit, useMarketAction, useRevenueReporting } from "./useMarket"

type Role = "issuer" | "investor"

const ROLE_COPY: Record<Role, { title: string; help: string }> = {
	issuer: {
		title: "Empresas emisoras",
		help: "Pueden publicar ofertas, fijar su precio, subir utilidades y retirar el capital levantado.",
	},
	investor: {
		title: "Inversionistas",
		help: "Allowlist global (KYC demo): pueden invertir en cualquier oferta publicada.",
	},
}

interface Props {
	offerings: Offering[]
	/** Contract uses the permissioned revenue-report flow. */
	supportsRevenueReports: boolean
}

/**
 * Minka's own console: decides who may issue and who may invest, and reviews
 * the revenue companies report.
 */
export function PlatformAdminPanel({
	offerings,
	supportsRevenueReports,
}: Props) {
	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>CONSOLA DE MINKA · ADMINISTRADOR</p>
			<h2>Aprobaciones de la plataforma</h2>
			<div className={styles.columns}>
				<RoleForm role="issuer" />
				<RoleForm role="investor" />
			</div>
			{supportsRevenueReports && <RevenueReview offerings={offerings} />}
		</section>
	)
}

function RoleForm({ role }: { role: Role }) {
	const [account, setAccount] = useState("")
	const action = useMarketAction(
		role === "issuer" ? "Empresa emisora actualizada" : "Allowlist actualizada",
	)
	const target = account.trim()
	const valid = StrKey.isValidEd25519PublicKey(target)

	const setStatus = (approved: boolean) =>
		action.mutate(
			async (client: MinkaMarketClient, admin) =>
				submit(
					role === "issuer"
						? await client.set_issuer_status({
								admin,
								issuer: target,
								approved,
							})
						: await client.set_investor_status({
								admin,
								investor: target,
								approved,
							}),
				),
			{ onSuccess: () => setAccount("") },
		)

	return (
		<div className={styles.form}>
			<label>
				{ROLE_COPY[role].title}
				<input
					placeholder="G…"
					value={account}
					onChange={(event) => setAccount(event.target.value)}
				/>
			</label>
			<small className={styles.muted}>{ROLE_COPY[role].help}</small>
			<div className={styles.row}>
				<button
					type="button"
					disabled={!valid || action.isPending}
					onClick={() => setStatus(true)}
				>
					Aprobar
				</button>
				<button
					type="button"
					disabled={!valid || action.isPending}
					onClick={() => setStatus(false)}
				>
					Revocar
				</button>
			</div>
		</div>
	)
}

/**
 * Minka's review desk for company revenue: allow each offering's issuer to
 * report revenue, then approve (distribute) or reject (refund) each report.
 */
function RevenueReview({ offerings }: { offerings: Offering[] }) {
	return (
		<div className={styles.subpanel}>
			<h3>Utilidades por oferta</h3>
			<p className={styles.muted}>
				Habilita a cada empresa para reportar utilidades. Cada reporte llega con
				su USDC en custodia; al aprobarlo se reparte pro-rata entre los
				inversionistas y queda reclamable. Al rechazarlo, el USDC vuelve a la
				empresa.
			</p>
			{offerings.length === 0 ? (
				<p className={styles.muted}>Aún no hay ofertas publicadas.</p>
			) : (
				offerings.map((offering) => (
					<OfferingRevenueReview key={offering.id} offering={offering} />
				))
			)}
		</div>
	)
}

function OfferingRevenueReview({ offering }: { offering: Offering }) {
	const reporting = useRevenueReporting(offering.id)
	const permission = useMarketAction(
		`Permiso de utilidades de ${offering.symbol} actualizado`,
	)
	const approve = useMarketAction("Utilidades aprobadas: ya son reclamables")
	const reject = useMarketAction(
		"Reporte rechazado: USDC devuelto a la empresa",
	)

	const enabled = reporting.data?.enabled ?? false
	const reports = reporting.data?.reports ?? []
	const pending = reports.filter((r) => r.status === ReportStatus.Pending)
	const offeringId = offering.id

	return (
		<div className={styles.reviewCard}>
			<div className={styles.panelHeader}>
				<div>
					<strong>
						{offering.name} · {offering.symbol}
					</strong>
					<span className={styles.muted}>
						{" "}
						· {pending.length} pendiente{pending.length === 1 ? "" : "s"} ·{" "}
						{formatUsdc(offering.available)} USDC en revisión
					</span>
				</div>
				<button
					type="button"
					disabled={!reporting.data || permission.isPending}
					onClick={() =>
						permission.mutate(async (client, admin) =>
							submit(
								await client.set_revenue_reporting({
									admin,
									offering_id: offeringId,
									enabled: !enabled,
								}),
							),
						)
					}
				>
					{enabled
						? "Revocar permiso de reporte"
						: "Habilitar reporte de utilidades"}
				</button>
			</div>
			<RevenueReportList
				reports={reports}
				emptyText="Esta empresa aún no ha subido utilidades."
				reviewing={approve.isPending || reject.isPending}
				onApprove={(report) =>
					approve.mutate(async (client, admin) =>
						submit(
							await client.approve_revenue_report({
								admin,
								offering_id: offeringId,
								report_id: report.id,
							}),
						),
					)
				}
				onReject={(report) =>
					reject.mutate(async (client, admin) =>
						submit(
							await client.reject_revenue_report({
								admin,
								offering_id: offeringId,
								report_id: report.id,
							}),
						),
					)
				}
			/>
		</div>
	)
}
