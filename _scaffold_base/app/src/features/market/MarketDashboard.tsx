import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { minkaConfig } from "../../lib/minkaConfig"
import { describeError } from "./contract"
import { EventFeed } from "./EventFeed"
import { ExploreTab } from "./ExploreTab"
import { formatUsdc, shortId } from "./format"
import { IssuerPanel } from "./IssuerPanel"
import styles from "./Market.module.css"
import { PlatformAdminPanel } from "./PlatformAdminPanel"
import { PortfolioTab } from "./PortfolioTab"
import { type MarketEvent, type Offering, ReportStatus } from "./types"
import {
	useAllRevenueReporting,
	useMarketSnapshot,
	usePositions,
	useRefreshMarket,
	useRoles,
	useTokenBalance,
} from "./useMarket"
import { useMarketEvents } from "./useMarketEvents"
import { WalletStatus } from "./WalletStatus"

const NO_OFFERINGS: Offering[] = []
const TABS = [
	"explorar",
	"portafolio",
	"empresa",
	"minka",
	"actividad",
] as const
type Tab = (typeof TABS)[number]

/**
 * Role-based workspace: everyone explores; investors get their portfolio,
 * companies their console and Minka its review desk. The active tab lives in
 * the URL (?tab=) so any view can be linked or bookmarked.
 */
export function MarketDashboard() {
	const { address } = useWallet()
	const snapshot = useMarketSnapshot()
	const roles = useRoles(address)
	const refresh = useRefreshMarket()
	// Every new on-chain event re-reads contract state, so balances and
	// claimable returns update without a page reload.
	const onNewEvents = useCallback(() => void refresh(), [refresh])
	const feed = useMarketEvents(onNewEvents)
	const balance = useTokenBalance(snapshot.data?.usdc, address)

	const offerings = snapshot.data?.offerings ?? NO_OFFERINGS
	const supportsReports = snapshot.data?.supportsRevenueReports ?? false
	const isAdmin = Boolean(address && snapshot.data?.admin === address)
	const isIssuer = Boolean(address && roles.data?.isIssuer)
	const isInvestor = Boolean(address && roles.data?.isInvestorApproved)
	const rolesLoading =
		Boolean(address) && (roles.isLoading || snapshot.isLoading)
	const ownOfferings = offerings.filter((o) => o.issuer === address)

	const positions = usePositions(offerings, address)
	const claimable = positions.reduce(
		(sum, q) => sum + (q.data?.claimable ?? 0n),
		0n,
	)
	const reporting = useAllRevenueReporting(
		isAdmin ? offerings : NO_OFFERINGS,
		supportsReports,
	)
	const pendingReports = reporting.reduce(
		(sum, q) =>
			sum +
			(q.data?.reports.filter((r) => r.status === ReportStatus.Pending)
				.length ?? 0),
		0,
	)

	const visible: Record<Tab, boolean> = {
		explorar: true,
		portafolio: Boolean(address),
		empresa: isIssuer,
		minka: isAdmin,
		actividad: true,
	}

	const [params, setParams] = useSearchParams()
	const requested = params.get("tab") as Tab | null
	const tab: Tab = requested && visible[requested] ? requested : "explorar"
	const goTo = useCallback(
		(next: Tab, extra?: Record<string, string>) =>
			setParams({ tab: next, ...extra }, { replace: false }),
		[setParams],
	)

	// Land each role on its own workspace once, unless the URL already says.
	const landed = useRef(false)
	useEffect(() => {
		if (landed.current || rolesLoading || !address) return
		landed.current = true
		if (requested) return
		if (isAdmin) goTo("minka")
		else if (isIssuer) goTo("empresa")
		else if (claimable > 0n) goTo("portafolio")
	}, [address, rolesLoading, requested, isAdmin, isIssuer, claimable, goTo])

	const offeringParam = params.get("oferta")
	const selected =
		offerings.find((o) => String(o.id) === offeringParam) ??
		offerings.find((o) => !o.paused) ??
		offerings[0]

	const labels: Record<Tab, string> = {
		explorar: "Explorar",
		portafolio:
			claimable > 0n
				? `Mi portafolio · ${formatUsdc(claimable)} por cobrar`
				: "Mi portafolio",
		empresa: "Mi empresa",
		minka: pendingReports > 0 ? `Minka · ${pendingReports}` : "Minka",
		actividad: "Actividad",
	}

	return (
		<div className={styles.dashboard}>
			<header className={styles.dashHeader}>
				<div>
					<p className={styles.eyebrow}>STELLAR TESTNET · MERCADO PRIMARIO</p>
					<h1>Mercado Minka</h1>
				</div>
				<aside>
					<strong>Prototipo en Stellar Testnet</strong>
					<span>No es una oferta de inversión.</span>
					{minkaConfig.isContractConfigured && (
						<a
							href={minkaConfig.contractUrl(minkaConfig.contractId)}
							target="_blank"
							rel="noreferrer"
						>
							Contrato {shortId(minkaConfig.contractId, 5)} ↗
						</a>
					)}
				</aside>
			</header>

			{!minkaConfig.isContractConfigured ? (
				<section className={styles.panel}>
					<p className={styles.eyebrow}>CONFIGURACIÓN PENDIENTE</p>
					<h2>Conecta el dashboard a un contrato desplegado</h2>
					<p className={styles.muted}>
						Despliega <code>minka-market</code> con{" "}
						<code>scripts/demo-minka-testnet.sh</code> (Linux/macOS) o{" "}
						<code>scripts/deploy-minka-testnet.ps1</code> (Windows) y define{" "}
						<code>PUBLIC_MINKA_MARKET_ID</code> en <code>app/.env</code>.
					</p>
				</section>
			) : (
				<>
					<WalletStatus
						address={address}
						usdcBalance={balance.data}
						isAdmin={isAdmin}
						isIssuer={isIssuer}
						isInvestor={isInvestor}
						rolesLoading={rolesLoading}
					/>

					{snapshot.error && (
						<p className={styles.errorBanner}>
							No se pudo leer el contrato: {describeError(snapshot.error)}
						</p>
					)}

					<nav className={styles.tabs} role="tablist" aria-label="Secciones">
						{TABS.filter((t) => visible[t]).map((t) => (
							<button
								key={t}
								type="button"
								role="tab"
								aria-selected={tab === t}
								className={
									(t === "minka" && pendingReports > 0) ||
									(t === "portafolio" && claimable > 0n)
										? styles.tabHot
										: undefined
								}
								onClick={() => goTo(t)}
							>
								{labels[t]}
							</button>
						))}
					</nav>

					{snapshot.isLoading ? (
						<p className={styles.muted}>Leyendo el contrato en Stellar…</p>
					) : (
						<>
							{tab === "explorar" && (
								<ExploreTab
									offerings={offerings}
									selected={selected}
									onSelect={(id) => goTo("explorar", { oferta: String(id) })}
									address={address}
									isInvestor={isInvestor}
									rolesLoading={rolesLoading}
									usdcBalance={balance.data}
									supportsRevenueReports={supportsReports}
									onGoToCompany={() => goTo("empresa")}
								/>
							)}
							{tab === "portafolio" && (
								<PortfolioTab
									offerings={offerings}
									positions={positions}
									isInvestor={isInvestor}
									onExplore={(id) =>
										goTo(
											"explorar",
											id === undefined ? undefined : { oferta: String(id) },
										)
									}
								/>
							)}
							{tab === "empresa" && address && (
								<IssuerPanel
									address={address}
									ownOfferings={ownOfferings}
									supportsRevenueReports={supportsReports}
								/>
							)}
							{tab === "minka" && (
								<PlatformAdminPanel
									offerings={offerings}
									supportsRevenueReports={supportsReports}
									events={feed.events}
								/>
							)}
							{tab === "actividad" && (
								<ActivityTab
									address={address}
									events={feed.events}
									offerings={offerings}
									isLoading={feed.isLoading}
									error={feed.error}
									lastSyncedLedger={feed.lastSyncedLedger}
									historyTruncated={feed.historyTruncated}
								/>
							)}
						</>
					)}
				</>
			)}
		</div>
	)
}

function ActivityTab({
	address,
	events,
	...feedProps
}: {
	address?: string
	events: MarketEvent[]
	offerings: Offering[]
	isLoading: boolean
	error?: string
	lastSyncedLedger?: number
	historyTruncated: boolean
}) {
	const [mine, setMine] = useState(false)
	const shown =
		mine && address
			? events.filter((e) => e.topics.some((t) => String(t) === address))
			: events

	return (
		<>
			{address && (
				<div className={styles.segmented} role="radiogroup">
					<button
						type="button"
						role="radio"
						aria-checked={!mine}
						onClick={() => setMine(false)}
					>
						Toda la plataforma
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={mine}
						onClick={() => setMine(true)}
					>
						Solo mis movimientos
					</button>
				</div>
			)}
			<EventFeed events={shown} {...feedProps} />
		</>
	)
}
