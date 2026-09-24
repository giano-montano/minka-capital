import React from "react"
import { minkaConfig } from "../lib/minkaConfig"
import styles from "./Home.module.css"

const metrics = [
	["Oferta", "10,000 LUMI-RSN", "Unidades simuladas"],
	["Capital comprometido", "6,400 USDC", "64% de la meta"],
	["Ingresos verificados", "1,000 USDC", "REV-0001"],
	["Retorno reclamable", "600 USDC", "Wallet demo de Ana"],
]

const events: Array<{ kind: string; description: string }> = [
	{ kind: "InvestmentRecorded", description: "Ana adquiere 60 unidades" },
	{ kind: "InvestmentRecorded", description: "Luis adquiere 40 unidades" },
	{ kind: "RevenueRecorded", description: "Venta REV-0001: 1,000 USDC" },
	{ kind: "ClaimRecorded", description: "Ana reclama 600 USDC" },
]

const Home: React.FC = () => (
	<div className={styles.Home}>
		<section className={styles.hero}>
			<div>
				<p className={styles.eyebrow}>STELLAR TESTNET · REALTIME CAPITAL MARKETS</p>
				<h1>Capital para startups,<br />liquidado con cada venta.</h1>
				<p>Minka Capital convierte ingresos verificables en retornos programables para inversionistas de startups peruanas.</p>
			</div>
			<aside><strong>Prototipo en Stellar Testnet</strong><span>{minkaConfig.isContractConfigured ? "Contrato configurado para lectura on-chain." : "Contrato Testnet pendiente de configurar."}</span><span>No es una oferta de inversion.</span></aside>
		</section>

		<section className={styles.offer}>
			<div><p className={styles.eyebrow}>OFERTA ACTIVA</p><h2>LumiSolar Peru · LUMI-RSN</h2><p>Participacion simulada en ingresos futuros.</p></div>
			<div className={styles.progress}><p>6,400 / 10,000 unidades <strong>64%</strong></p><span><i /></span></div>
		</section>

		<section className={styles.metrics}>{metrics.map(([label, value, detail]) => <article key={label}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>)}</section>

		<section className={styles.columns}>
			<article className={styles.panel}>
				<p className={styles.eyebrow}>POSICION DEL INVERSOR</p><h2>Ana · wallet aprobada</h2>
				<div className={styles.position}><div><span>Unidades LUMI-RSN</span><strong>60</strong></div><div><span>Saldo reclamable</span><strong>600 USDC</strong></div></div>
				<button type="button" disabled={!minkaConfig.isContractConfigured} title={minkaConfig.isContractConfigured ? "El claim se conectara al cliente generado de Minka." : "Configura PUBLIC_MINKA_MARKET_ID despues del despliegue Testnet."}>Claim USDC en Testnet</button>
			</article>
			<article className={styles.panel}>
				<p className={styles.eyebrow}>TESORERIA Y ORACULO</p><h2>Estado operativo</h2>
				<ul><li>Revenue Vault listo para USDC SAC</li><li>Oraculo demo: POS / SaaS</li><li>Anti-replay por event_id</li><li>Eventos indexables via RPC</li></ul>
			</article>
		</section>

		<section className={styles.panel}>
			<p className={styles.eyebrow}>AUDITORIA EN TIEMPO REAL · LIVE</p><h2>Actividad de la oferta</h2>
			<div className={styles.events}>{events.map((event) => <div key={event.kind + event.description}><strong>{event.kind}</strong><span>{event.description}</span><small>Testnet</small></div>)}</div>
		</section>
	</div>
)

export default Home
