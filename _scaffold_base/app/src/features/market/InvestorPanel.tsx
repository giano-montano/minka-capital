import { connectWallet } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { useWallet } from "../../hooks/useWallet"
import { type MarketSnapshot } from "./contract"
import { formatUnits, formatUsdc } from "./format"
import styles from "./Market.module.css"
import {
	submit,
	useMarketAction,
	usePosition,
	useTokenBalance,
} from "./useMarket"

export function InvestorPanel({ snapshot }: { snapshot?: MarketSnapshot }) {
	const { address } = useWallet()
	const position = usePosition(address)
	const balance = useTokenBalance(snapshot?.usdc, address)
	const [unitsInput, setUnitsInput] = useState("10")

	const invest = useMarketAction("Inversión registrada on-chain")
	const claim = useMarketAction("Retorno reclamado en USDC")

	if (!address) {
		return (
			<article className={styles.panel}>
				<p className={styles.eyebrow}>POSICIÓN DEL INVERSIONISTA</p>
				<h2>Conecta tu wallet</h2>
				<p className={styles.muted}>
					Conecta una wallet de Stellar Testnet para ver tus unidades, tu saldo
					reclamable e invertir si estás aprobado.
				</p>
				<button
					type="button"
					className={styles.primary}
					onClick={() => void connectWallet()}
				>
					Conectar wallet
				</button>
			</article>
		)
	}

	const units = /^\d+$/.test(unitsInput) ? BigInt(unitsInput) : 0n
	const unitPrice = snapshot?.unitPrice ?? 0n
	const cost = units * unitPrice
	const remaining = snapshot
		? snapshot.offering.target_units - snapshot.offering.sold_units
		: 0n
	const approved = position.data?.approved ?? false
	const claimable = position.data?.claimable ?? 0n

	// Pre-flight checks mirror the contract's rules so users see why a
	// transaction would fail before being asked to sign it.
	const investBlocker = !snapshot
		? "Cargando la oferta…"
		: snapshot.offering.paused
			? "La oferta está pausada."
			: !approved
				? "Tu wallet aún no está en la allowlist de la oferta."
				: units <= 0n
					? "Ingresa un número entero de unidades."
					: units > remaining
						? `Solo quedan ${formatUnits(remaining)} unidades.`
						: balance.data !== undefined && balance.data < cost
							? "Saldo de USDC insuficiente."
							: undefined

	return (
		<article className={styles.panel}>
			<p className={styles.eyebrow}>POSICIÓN DEL INVERSIONISTA</p>
			<h2>
				{approved ? "Wallet aprobada" : "Wallet no aprobada"}
				<span className={approved ? styles.badgeOk : styles.badgeWarn}>
					{approved ? "allowlist" : "pendiente"}
				</span>
			</h2>

			<div className={styles.position}>
				<div>
					<span>Unidades LUMI-RSN</span>
					<strong>
						{position.data ? formatUnits(position.data.units) : "—"}
					</strong>
				</div>
				<div>
					<span>Saldo reclamable</span>
					<strong>
						{position.data ? `${formatUsdc(claimable)} USDC` : "—"}
					</strong>
				</div>
				<div>
					<span>USDC en tu wallet</span>
					<strong>
						{balance.data !== undefined ? formatUsdc(balance.data) : "—"}
					</strong>
				</div>
			</div>

			<button
				type="button"
				className={styles.primary}
				disabled={claimable <= 0n || claim.isPending}
				onClick={() =>
					claim.mutate(async (client, investor) =>
						submit(await client.claim({ investor })),
					)
				}
			>
				{claim.isPending ? "Firmando claim…" : "Claim USDC en Testnet"}
			</button>

			<form
				className={styles.form}
				onSubmit={(event) => {
					event.preventDefault()
					if (investBlocker) return
					invest.mutate(async (client, investor) =>
						submit(await client.invest({ investor, units })),
					)
				}}
			>
				<label>
					Unidades a adquirir
					<input
						inputMode="numeric"
						value={unitsInput}
						onChange={(event) => setUnitsInput(event.target.value.trim())}
					/>
				</label>
				<p className={styles.muted}>
					Costo: <strong>{formatUsdc(cost)} USDC</strong>
				</p>
				<button
					type="submit"
					disabled={Boolean(investBlocker) || invest.isPending}
				>
					{invest.isPending ? "Firmando inversión…" : "Invertir"}
				</button>
				{investBlocker && (
					<small className={styles.hint}>{investBlocker}</small>
				)}
			</form>
		</article>
	)
}
