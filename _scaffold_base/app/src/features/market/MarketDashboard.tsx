import { useCallback, useEffect, useRef, useState } from "react"
import { useWallet } from "../../hooks/useWallet"
import { minkaConfig } from "../../lib/minkaConfig"
import { describeError } from "./contract"
import { EventFeed } from "./EventFeed"
import { shortId } from "./format"
import { InvestorPanel } from "./InvestorPanel"
import { IssuerPanel } from "./IssuerPanel"
import styles from "./Market.module.css"
import { OfferingCatalog } from "./OfferingCatalog"
import { OfferingOverview } from "./OfferingOverview"
import { PlatformAdminPanel } from "./PlatformAdminPanel"
import { type Offering } from "./types"
import { useMarketSnapshot, useRefreshMarket, useRoles } from "./useMarket"
import { useMarketEvents } from "./useMarketEvents"

const NO_OFFERINGS: Offering[] = []

export function MarketDashboard() {
	const { address } = useWallet()
	const snapshot = useMarketSnapshot()
	const roles = useRoles(address)
	const refresh = useRefreshMarket()
	// Every new on-chain event re-reads contract state, so balances and
	// claimable returns update without a page reload.
	const onNewEvents = useCallback(() => void refresh(), [refresh])
	const feed = useMarketEvents(onNewEvents)

	const offerings = snapshot.data?.offerings ?? NO_OFFERINGS
	const [selectedId, setSelectedId] = useState<number>()
	const selectNewest = useRef(false)

	useEffect(() => {
		if (offerings.length === 0) return
		const newest = offerings[offerings.length - 1]
		if (selectNewest.current && newest) {
			selectNewest.current = false
			setSelectedId(newest.id)
		} else if (
			selectedId === undefined ||
			!offerings.some((o) => o.id === selectedId)
		) {
			setSelectedId(offerings[0]?.id)
		}
	}, [offerings, selectedId])

	const selected = offerings.find((o) => o.id === selectedId)
	const isPlatformAdmin = Boolean(address && snapshot.data?.admin === address)
	const isIssuer = Boolean(address && roles.data?.isIssuer)
	const ownOfferings = offerings.filter((o) => o.issuer === address)

	return (
		<div className={styles.dashboard}>
			<section className={styles.hero}>
				<div>
					<p className={styles.eyebrow}>
						STELLAR TESTNET · REALTIME CAPITAL MARKETS
					</p>
					<h1>
						Capital para startups,
						<br />
						liquidado con cada venta.
					</h1>
					<p>
						Startups peruanas publican participaciones en sus ingresos futuros;
						los inversionistas reciben retornos programables cada vez que la
						empresa vende.
					</p>
				</div>
				<aside>
					<strong>Prototipo en Stellar Testnet</strong>
					<span>No es una oferta de inversión.</span>
					{minkaConfig.isContractConfigured ? (
						<a
							href={minkaConfig.contractUrl(minkaConfig.contractId)}
							target="_blank"
							rel="noreferrer"
						>
							Contrato {shortId(minkaConfig.contractId, 5)}
						</a>
					) : (
						<span>Contrato Testnet pendiente de configurar.</span>
					)}
				</aside>
			</section>

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
					{snapshot.error && (
						<p className={styles.errorBanner}>
							No se pudo leer el contrato: {describeError(snapshot.error)}
						</p>
					)}

					{offerings.length > 0 ? (
						<OfferingCatalog
							offerings={offerings}
							selectedId={selectedId}
							onSelect={setSelectedId}
						/>
					) : (
						snapshot.data && (
							<section className={styles.panel}>
								<p className={styles.eyebrow}>SIN OFERTAS</p>
								<h2>Aún no hay ofertas publicadas</h2>
								<p className={styles.muted}>
									Una empresa aprobada por Minka puede publicar la primera desde
									su consola.
								</p>
							</section>
						)
					)}

					{selected && snapshot.data && (
						<>
							<OfferingOverview
								offering={selected}
								supportsRevenueReports={snapshot.data.supportsRevenueReports}
							/>
							<section className={styles.columns}>
								<InvestorPanel offering={selected} usdc={snapshot.data.usdc} />
								<article className={styles.panel}>
									<p className={styles.eyebrow}>CÓMO FUNCIONA</p>
									<h2>Del ingreso al retorno</h2>
									<ol className={styles.steps}>
										<li>
											Minka aprueba a la empresa emisora y a los inversionistas.
										</li>
										<li>
											La empresa publica su oferta: precio por unidad y unidades
											a emitir.
										</li>
										<li>
											Inversionistas aprobados compran unidades con USDC
											Testnet.
										</li>
										<li>
											La empresa registra cada venta con un{" "}
											<code>event_id</code> único; el contrato la reparte
											pro-rata y este dashboard lo muestra al instante vía RPC.
										</li>
									</ol>
								</article>
							</section>
						</>
					)}

					{isIssuer && address && (
						<IssuerPanel
							address={address}
							ownOfferings={ownOfferings}
							selected={selected}
							supportsRevenueReports={
								snapshot.data?.supportsRevenueReports ?? false
							}
							onCreated={() => {
								selectNewest.current = true
							}}
						/>
					)}
					{isPlatformAdmin && (
						<PlatformAdminPanel
							offerings={offerings}
							supportsRevenueReports={
								snapshot.data?.supportsRevenueReports ?? false
							}
						/>
					)}

					<EventFeed
						events={feed.events}
						offerings={offerings}
						isLoading={feed.isLoading}
						error={feed.error}
						lastSyncedLedger={feed.lastSyncedLedger}
						historyTruncated={feed.historyTruncated}
					/>
				</>
			)}
		</div>
	)
}
