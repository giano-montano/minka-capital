import { useCallback } from "react"
import { useWallet } from "../../hooks/useWallet"
import { minkaConfig } from "../../lib/minkaConfig"
import { AdminPanel } from "./AdminPanel"
import { describeError } from "./contract"
import { EventFeed } from "./EventFeed"
import { shortId } from "./format"
import { InvestorPanel } from "./InvestorPanel"
import styles from "./Market.module.css"
import { OfferingOverview } from "./OfferingOverview"
import { useMarketSnapshot, useRefreshMarket } from "./useMarket"
import { useMarketEvents } from "./useMarketEvents"

export function MarketDashboard() {
	const { address } = useWallet()
	const snapshot = useMarketSnapshot()
	const refresh = useRefreshMarket()
	// Every new on-chain event re-reads contract state, so balances and
	// claimable returns update without a page reload.
	const onNewEvents = useCallback(() => void refresh(), [refresh])
	const feed = useMarketEvents(onNewEvents)
	const isAdmin = Boolean(address && snapshot.data?.admin === address)

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
						Minka Capital convierte ingresos verificables en retornos
						programables para inversionistas de startups peruanas.
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
						<code>scripts/deploy-minka-testnet.ps1</code> y define{" "}
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
					<OfferingOverview snapshot={snapshot.data} />
					<section className={styles.columns}>
						<InvestorPanel snapshot={snapshot.data} />
						<article className={styles.panel}>
							<p className={styles.eyebrow}>CÓMO FUNCIONA</p>
							<h2>Del ingreso al retorno</h2>
							<ol className={styles.steps}>
								<li>Wallets aprobadas compran unidades con USDC Testnet.</li>
								<li>
									LumiSolar reporta una venta; el operador la registra con un{" "}
									<code>event_id</code> único (anti-replay).
								</li>
								<li>
									El contrato reparte el monto pro-rata por unidad y emite{" "}
									<code>revenue_recorded</code>.
								</li>
								<li>
									Este dashboard lo recibe vía RPC y actualiza tu saldo
									reclamable al instante.
								</li>
							</ol>
						</article>
					</section>
					{isAdmin && snapshot.data && <AdminPanel snapshot={snapshot.data} />}
					<EventFeed
						events={feed.events}
						isLoading={feed.isLoading}
						error={feed.error}
						lastSyncedLedger={feed.lastSyncedLedger}
					/>
				</>
			)}
		</div>
	)
}
