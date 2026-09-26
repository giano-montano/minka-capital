import { Link } from "react-router-dom"
import { Chakana } from "../features/landing/Chakana"
import styles from "../features/landing/Landing.module.css"
import { PeruGlobe } from "../features/landing/PeruGlobe"
import { describeEvent } from "../features/market/EventFeed"
import { formatUsdc } from "../features/market/format"
import { type Offering } from "../features/market/types"
import { useMarketSnapshot } from "../features/market/useMarket"
import { useMarketEvents } from "../features/market/useMarketEvents"
import { minkaConfig } from "../lib/minkaConfig"

const NO_OFFERINGS: Offering[] = []

const steps = (revenueReports: boolean) => [
	{
		role: "Minka",
		title: "Aprueba a los participantes",
		body: "La plataforma valida empresas emisoras e inversionistas (KYC demo) con una allowlist on-chain.",
	},
	{
		role: "Empresa",
		title: "Publica su oferta",
		body: "Cada startup define precio y unidades de su nota de participación en ingresos. Tras la primera venta, el precio queda fijo.",
	},
	{
		role: "Inversionista",
		title: "Invierte en USDC",
		body: "Compra unidades con USDC. El pago queda en custodia del contrato, separado de los fondos de cualquier otra oferta.",
	},
	{
		role: "Todos",
		title: "Cobran cada venta",
		body: revenueReports
			? "La empresa sube sus utilidades en USDC, Minka las aprueba y el contrato las reparte pro-rata. Cada inversionista las reclama cuando quiere."
			: "La empresa registra sus ingresos y el contrato reparte el retorno pro-rata. Cada inversionista lo reclama cuando quiere.",
	},
]

// Protocol facts about Stellar and this contract's design, not market data.
const whyStellar = (revenueReports: boolean) => [
	["~5 s", "para liquidar cada inversión y cada claim en Stellar"],
	["USDC", "de Circle vía Stellar Asset Contract, sin puentes ni wrappers"],
	["100 %", "de los movimientos emite eventos Soroban auditables"],
	[
		"3",
		revenueReports
			? "compartimentos de tesorería por oferta: capital, utilidades por aprobar y retornos"
			: "compartimentos de tesorería por oferta: capital, fondeo y retornos",
	],
]

export default function Landing() {
	const snapshot = useMarketSnapshot()
	const feed = useMarketEvents()
	const offerings = snapshot.data?.offerings ?? NO_OFFERINGS

	const capital = offerings.reduce(
		(sum, o) => sum + o.sold_units * o.unit_price,
		0n,
	)
	const onChainTotals = offerings.every(
		(o) => o.total_distributed !== undefined && o.investor_count !== undefined,
	)
	const distributed = onChainTotals
		? offerings.reduce((sum, o) => sum + (o.total_distributed ?? 0n), 0n)
		: feed.events
				.filter((e) => e.kind === "revenue_recorded")
				.reduce((sum, e) => sum + BigInt(String(e.data.amount ?? 0)), 0n)
	const investors = onChainTotals
		? offerings.reduce((sum, o) => sum + (o.investor_count ?? 0), 0)
		: new Set(
				feed.events
					.filter((e) => e.kind === "investment_recorded")
					.map((e) => String(e.topics[1])),
			).size
	// Older contracts have no lifetime counters: once RPC prunes events these
	// two figures only cover the retained window, so say so.
	const partialHistory = !onChainTotals && feed.historyTruncated
	const revenueReports = snapshot.data?.supportsRevenueReports ?? false
	const symbols = new Map(offerings.map((o) => [o.id, o.symbol]))
	const symbolOf = (id: number) => symbols.get(id) ?? `Oferta #${id}`
	const live = minkaConfig.isContractConfigured && !feed.error

	const stats = [
		{ value: String(offerings.length), label: "ofertas publicadas" },
		{ value: `${formatUsdc(capital, 0)} USDC`, label: "capital levantado" },
		{
			value: `${formatUsdc(distributed, 0)} USDC`,
			label: partialHistory
				? "retornos distribuidos (últimos días)"
				: "retornos distribuidos",
		},
		{
			value: String(investors),
			label: partialHistory
				? "inversionistas (últimos días)"
				: "inversionistas",
		},
	]
	const statsLoading = snapshot.isLoading || (!onChainTotals && feed.isLoading)

	return (
		<div className={styles.landing}>
			<header className={styles.nav}>
				<Link to="/" className={styles.brand}>
					<Chakana />
					<span>Minka Capital</span>
				</Link>
				<nav className={styles.navLinks}>
					<a href="#como-funciona">Cómo funciona</a>
					<a href="#en-vivo">En vivo</a>
					<a
						href="https://github.com/giano-montano/stellar-hackathon-wazaa"
						target="_blank"
						rel="noreferrer"
					>
						GitHub
					</a>
				</nav>
				<Link to="/app" className={styles.navCta}>
					Abrir dashboard
				</Link>
			</header>

			<section className={styles.hero}>
				<div className={styles.heroCopy}>
					<p className={styles.eyebrow}>
						<span className={live ? styles.dotLive : styles.dot} />
						Stellar Testnet · Hecho en Perú
					</p>
					<h1>
						Capital en <em>minka</em> para las startups del Perú.
					</h1>
					<p className={styles.lede}>
						En quechua, <strong>mink&apos;a</strong> es el trabajo colectivo: la
						comunidad se junta para construir algo que nadie levanta solo. Minka
						Capital lleva esa idea on-chain: financias startups peruanas con
						USDC y cobras tu parte de cada venta, en tiempo real.
					</p>
					<div className={styles.ctas}>
						<Link to="/app" className={styles.primary}>
							Explorar ofertas
						</Link>
						{minkaConfig.isContractConfigured && (
							<a
								href={minkaConfig.contractUrl(minkaConfig.contractId)}
								target="_blank"
								rel="noreferrer"
								className={styles.secondary}
							>
								Ver contrato en Stellar Expert
							</a>
						)}
					</div>
					<dl className={styles.heroStats}>
						{stats.slice(0, 3).map((s) => (
							<div key={s.label}>
								<dt>{s.label}</dt>
								<dd>{statsLoading ? "…" : s.value}</dd>
							</div>
						))}
					</dl>
				</div>
				<div className={styles.heroVisual}>
					<PeruGlobe />
					<p className={styles.globeHint}>
						Arrastra para explorar · usa + / − para acercar
					</p>
				</div>
			</section>

			<div className={styles.tocapu} aria-hidden="true" />

			<section id="como-funciona" className={styles.section}>
				<p className={styles.eyebrow}>Cómo funciona</p>
				<h2>Tres roles, un contrato, cero intermediarios opacos.</h2>
				<ol className={styles.steps}>
					{steps(revenueReports).map((step, i) => (
						<li key={step.title}>
							<span className={styles.stepNum}>0{i + 1}</span>
							<span className={styles.stepRole}>{step.role}</span>
							<h3>{step.title}</h3>
							<p>{step.body}</p>
						</li>
					))}
				</ol>
			</section>

			<section id="en-vivo" className={styles.section}>
				<p className={styles.eyebrow}>
					<span className={live ? styles.dotLive : styles.dot} />
					En vivo desde Stellar RPC
				</p>
				<h2>El mercado, tal como está en la blockchain ahora mismo.</h2>
				<div className={styles.liveGrid}>
					<dl className={styles.statGrid}>
						{stats.map((s) => (
							<div key={s.label}>
								<dd>{statsLoading ? "…" : s.value}</dd>
								<dt>{s.label}</dt>
							</div>
						))}
					</dl>
					<ol className={styles.ticker}>
						{feed.isLoading && <li>Conectando con Stellar RPC…</li>}
						{!feed.isLoading && feed.events.length === 0 && (
							<li>Aún no hay eventos recientes para este contrato.</li>
						)}
						{feed.events.slice(0, 6).map((event) => (
							<li key={event.id}>
								<span>{describeEvent(event, symbolOf)}</span>
								<a
									href={minkaConfig.txUrl(event.txHash)}
									target="_blank"
									rel="noreferrer"
								>
									tx ↗
								</a>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className={styles.section}>
				<p className={styles.eyebrow}>Por qué Stellar</p>
				<h2>Finanzas de alta velocidad con reglas que no se pueden saltar.</h2>
				<ul className={styles.why}>
					{whyStellar(revenueReports).map(([value, text]) => (
						<li key={value}>
							<strong>{value}</strong>
							<span>{text}</span>
						</li>
					))}
				</ul>
			</section>

			<section className={styles.finalCta}>
				<Chakana size={56} />
				<h2>Súmate a la minka.</h2>
				<p>
					Conecta Freighter en Testnet y prueba el flujo completo en dos
					minutos.
				</p>
				<Link to="/app" className={styles.primary}>
					Abrir dashboard
				</Link>
			</section>

			<footer className={styles.footer}>
				<div className={styles.tocapu} aria-hidden="true" />
				<p>
					Prototipo exclusivo para Stellar Testnet con empresas, activos y
					montos ficticios. No constituye una oferta de valores ni una
					recomendación de inversión.
				</p>
			</footer>
		</div>
	)
}
