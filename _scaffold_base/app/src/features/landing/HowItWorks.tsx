import { useEffect, useRef, useState, type CSSProperties } from "react"
import styles from "./Landing.module.css"

// Scroll-driven walkthrough of the product, told through the demo story
// (Rosa's LumiSolar, investors Ana and Luis). Figures mirror the state left
// by scripts/demo-minka-testnet.sh; they are illustrative, the live section
// below shows the real contract.

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Eases a number from 0 to `target` once, after `delay` ms. */
function useCountUp(target: number, run: boolean, delay = 0, ms = 1100) {
	const [value, setValue] = useState(() =>
		run && prefersReducedMotion() ? target : 0,
	)
	useEffect(() => {
		if (!run || prefersReducedMotion()) return
		let raf = 0
		let start = 0
		const tick = (now: number) => {
			if (!start) start = now + delay
			const p = Math.min(1, Math.max(0, (now - start) / ms))
			setValue(target * (1 - (1 - p) ** 3))
			if (p < 1) raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [target, run, delay, ms])
	return value
}

const usd = (n: number) =>
	n.toLocaleString("es-PE", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties

interface Scene {
	role: string
	title: string
	body: string
	window: string
}

const scenes = (revenueReports: boolean): Scene[] => [
	{
		role: "Minka",
		title: "Minka aprueba a quién entra",
		body: "Empresas e inversionistas pasan un filtro (KYC demo) y quedan en una lista on-chain. Solo ellos pueden emitir e invertir.",
		window: "Minka · Aprobaciones",
	},
	{
		role: "Empresa",
		title: "Rosa publica una participación en sus ventas",
		body: "No vende acciones ni se endeuda: ofrece un porcentaje de sus ingresos futuros, en unidades de 10 USDC.",
		window: "LumiSolar · Nueva oferta",
	},
	{
		role: "Inversionistas",
		title: "Ana y Luis invierten desde 10 USDC",
		body: "Pagan con USDC desde su wallet. El dinero queda en custodia del contrato, separado del de cualquier otra oferta.",
		window: "Contrato minka-market",
	},
	{
		role: "Contrato",
		title: "Rosa vende. El contrato reparte.",
		body: revenueReports
			? "Rosa sube sus ingresos, Minka los aprueba y el contrato calcula la parte exacta de cada inversionista. Nadie puede desviarla."
			: "Rosa registra el ingreso y el contrato calcula la parte exacta de cada inversionista. Nadie puede desviarla.",
		window: "Reparto pro-rata",
	},
	{
		role: "Inversionista",
		title: "Luis cobra en 5 segundos",
		body: "Un clic desde su wallet y el USDC llega. Cada paso queda público y auditable en Stellar.",
		window: "Wallet de Luis",
	},
]

function ApproveMock({ playing }: { playing: boolean }) {
	const rows: [string, string][] = [
		["LumiSolar", "Empresa · Arequipa"],
		["Ana", "Inversionista · Lima"],
		["Luis", "Inversionista · Cusco"],
	]
	return (
		<ul className={styles.mockList}>
			{rows.map(([name, meta], i) => (
				<li key={name}>
					<span className={styles.avatar}>{name.charAt(0)}</span>
					<span>
						<strong>{name}</strong>
						<small>{meta}</small>
					</span>
					{playing && (
						<span className={styles.badgeOk} style={delay(350 + i * 450)}>
							Aprobado ✓
						</span>
					)}
				</li>
			))}
		</ul>
	)
}

function OfferMock({ playing }: { playing: boolean }) {
	return (
		<div className={styles.offerCard}>
			<div className={styles.offerHead}>
				<span className={styles.symbol}>LUMI-RSN</span>
				{playing && (
					<span className={styles.badgeOk} style={delay(900)}>
						Publicada ✓
					</span>
				)}
			</div>
			<h4>LumiSolar · paneles solares</h4>
			<dl className={styles.offerFacts}>
				<div className={styles.pop} style={delay(150)}>
					<dt>Precio por unidad</dt>
					<dd>10 USDC</dd>
				</div>
				<div className={styles.pop} style={delay(350)}>
					<dt>Unidades</dt>
					<dd>1,000</dd>
				</div>
				<div className={styles.pop} style={delay(550)}>
					<dt>Recibes</dt>
					<dd>% de cada venta</dd>
				</div>
			</dl>
		</div>
	)
}

function InvestMock({ playing }: { playing: boolean }) {
	const custody = useCountUp(100, playing, 900)
	return (
		<div className={styles.flow}>
			{[
				["Ana", 6, 0],
				["Luis", 4, 300],
			].map(([name, units, d]) => (
				<div key={name} className={styles.flowRow}>
					<span className={styles.avatar}>{String(name)[0]}</span>
					<span className={styles.flowLabel}>
						{name} compra {units} unidades
					</span>
					<span
						className={styles.coin}
						style={delay(Number(d) + 200)}
						aria-hidden="true"
					/>
					<strong>{Number(units) * 10} USDC</strong>
				</div>
			))}
			<div className={styles.vault}>
				<small>En custodia del contrato</small>
				<strong>{usd(custody)} USDC</strong>
			</div>
		</div>
	)
}

function SplitMock({
	playing,
	revenueReports,
}: {
	playing: boolean
	revenueReports: boolean
}) {
	const ana = useCountUp(12, playing, 1100)
	const luis = useCountUp(8, playing, 1100)
	return (
		<div className={styles.split}>
			<div className={styles.sale}>
				<small>
					{revenueReports ? "Venta aprobada por Minka" : "Venta registrada"}
				</small>
				<strong>+20.00 USDC</strong>
			</div>
			<div className={styles.splitBar}>
				<span className={styles.splitAna} style={delay(700)}>
					60 %
				</span>
				<span className={styles.splitLuis} style={delay(700)}>
					40 %
				</span>
			</div>
			<div className={styles.splitLegend}>
				<span>
					<i className={styles.keyAna} /> Ana · 6 unidades
					<strong>+{usd(ana)}</strong>
				</span>
				<span>
					<i className={styles.keyLuis} /> Luis · 4 unidades
					<strong>+{usd(luis)}</strong>
				</span>
			</div>
		</div>
	)
}

function ClaimMock({ playing }: { playing: boolean }) {
	const balance = useCountUp(8, playing, 1500, 900)
	return (
		<div className={styles.wallet}>
			<small>Por cobrar en LUMI-RSN</small>
			<strong className={styles.walletAmount}>8.00 USDC</strong>
			<span className={styles.claimBtn} style={delay(700)}>
				Cobrar 8 USDC
			</span>
			<div className={styles.walletBalance}>
				<small>Saldo de Luis</small>
				<strong>{usd(balance)} USDC</strong>
			</div>
			{playing && (
				<span className={styles.confirmed} style={delay(2300)}>
					✓ Confirmado en Stellar · ~5 s
				</span>
			)}
		</div>
	)
}

function SceneMock({
	scene,
	playing,
	revenueReports,
}: {
	scene: number
	playing: boolean
	revenueReports: boolean
}) {
	const s = scenes(revenueReports)[scene]
	return (
		<div className={`${styles.mock} ${playing ? styles.playing : ""}`}>
			<div className={styles.mockBar}>
				<i />
				<i />
				<i />
				<span>{s?.window}</span>
			</div>
			<div className={styles.mockBody}>
				{scene === 0 && <ApproveMock playing={playing} />}
				{scene === 1 && <OfferMock playing={playing} />}
				{scene === 2 && <InvestMock playing={playing} />}
				{scene === 3 && (
					<SplitMock playing={playing} revenueReports={revenueReports} />
				)}
				{scene === 4 && <ClaimMock playing={playing} />}
			</div>
		</div>
	)
}

export function HowItWorks({ revenueReports }: { revenueReports: boolean }) {
	const list = scenes(revenueReports)
	const [active, setActive] = useState(0)
	const stepRefs = useRef<(HTMLLIElement | null)[]>([])

	// The step crossing the middle band of the viewport drives the stage.
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActive(Number((entry.target as HTMLElement).dataset.step))
					}
				}
			},
			{ rootMargin: "-45% 0px -45% 0px" },
		)
		stepRefs.current.forEach((el) => el && observer.observe(el))
		return () => observer.disconnect()
	}, [])

	return (
		<div className={styles.story}>
			<ol className={styles.storySteps}>
				{list.map((scene, i) => (
					<li
						key={scene.title}
						data-step={i}
						ref={(el) => {
							stepRefs.current[i] = el
						}}
						className={i === active ? styles.stepActive : undefined}
					>
						<span className={styles.stepNum}>0{i + 1}</span>
						<span className={styles.stepRole}>{scene.role}</span>
						<h3>{scene.title}</h3>
						<p>{scene.body}</p>
						<div className={styles.inlineMock}>
							<SceneMock
								key={i === active ? "on" : "off"}
								scene={i}
								playing={i === active}
								revenueReports={revenueReports}
							/>
						</div>
					</li>
				))}
			</ol>
			<div className={styles.stage}>
				<div className={styles.stageSticky}>
					<SceneMock
						key={active}
						scene={active}
						playing
						revenueReports={revenueReports}
					/>
					<div className={styles.stageDots} aria-hidden="true">
						{list.map((scene, i) => (
							<i
								key={scene.title}
								className={i === active ? styles.dotOn : undefined}
							/>
						))}
					</div>
					<p className={styles.stageNote}>
						Ejemplo con los montos de la demo en Testnet
					</p>
				</div>
			</div>
		</div>
	)
}
