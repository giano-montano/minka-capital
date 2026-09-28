import { formatUsdc } from "./format"
import styles from "./Market.module.css"
import { type RevenueReport, ReportStatus } from "./types"

const STATUS: Record<ReportStatus, { label: string; className?: string }> = {
	[ReportStatus.Pending]: {
		label: "Pendiente de Minka",
		className: styles.badgeWarn,
	},
	[ReportStatus.Approved]: {
		label: "Aprobado · reclamable",
		className: styles.badgeOk,
	},
	[ReportStatus.Rejected]: { label: "Rechazado · devuelto" },
}

interface Props {
	reports: RevenueReport[]
	emptyText: string
	/** Shown on pending reports when the viewer can review them (Minka). */
	onApprove?: (report: RevenueReport) => void
	onReject?: (report: RevenueReport) => void
	reviewing?: boolean
}

/** Revenue reports of one offering, newest first. */
export function RevenueReportList({
	reports,
	emptyText,
	onApprove,
	onReject,
	reviewing,
}: Props) {
	if (reports.length === 0) {
		return <p className={styles.muted}>{emptyText}</p>
	}

	return (
		<ol className={styles.reports}>
			{[...reports].reverse().map((report) => {
				const status = STATUS[report.status]
				const submitted = new Date(Number(report.submitted_at) * 1000)
				const pending = report.status === ReportStatus.Pending
				return (
					<li key={report.id}>
						<div>
							<strong>{formatUsdc(report.amount)} USDC</strong>
							<span className={styles.muted}>
								Reporte #{report.id} · ref. {report.reference.toString()} ·{" "}
								{submitted.toLocaleString("es-PE")}
							</span>
						</div>
						<span className={status.className ?? styles.badgeMuted}>
							{status.label}
						</span>
						{pending && (onApprove || onReject) && (
							<div className={styles.row}>
								{onApprove && (
									<button
										type="button"
										disabled={reviewing}
										onClick={() => onApprove(report)}
									>
										Aprobar
									</button>
								)}
								{onReject && (
									<button
										type="button"
										disabled={reviewing}
										onClick={() => onReject(report)}
									>
										Rechazar
									</button>
								)}
							</div>
						)}
					</li>
				)
			})}
		</ol>
	)
}
