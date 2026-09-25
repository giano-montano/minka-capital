import { StrKey } from "@stellar/stellar-sdk"
import { type FormEvent, useState } from "react"
import { type MarketSnapshot } from "./contract"
import { formatUsdc, parseUsdc } from "./format"
import styles from "./Market.module.css"
import { submit, useMarketAction } from "./useMarket"

const isAccount = (value: string) =>
	StrKey.isValidEd25519PublicKey(value.trim())

/**
 * Operator console, shown only to the offering administrator. In production
 * `record_revenue` would come from a signed oracle, not a manual form.
 */
export function AdminPanel({ snapshot }: { snapshot: MarketSnapshot }) {
	const [investor, setInvestor] = useState("")
	const [fundAmount, setFundAmount] = useState("")
	const [revenueAmount, setRevenueAmount] = useState("")
	const [withdrawTo, setWithdrawTo] = useState("")
	const [withdrawAmount, setWithdrawAmount] = useState("")

	const allowlist = useMarketAction("Allowlist actualizada")
	const fund = useMarketAction("Tesorería de distribuciones fondeada")
	const revenue = useMarketAction("Ingreso registrado y distribuido")
	const withdraw = useMarketAction("Capital liberado a la startup")
	const pause = useMarketAction("Estado de la oferta actualizado")

	const { treasury, offering } = snapshot
	const fundAtomic = parseUsdc(fundAmount)
	const revenueAtomic = parseUsdc(revenueAmount)
	const withdrawAtomic = parseUsdc(withdrawAmount)

	const setStatus = (approved: boolean) =>
		allowlist.mutate(
			async (client, admin) =>
				submit(
					await client.set_investor_status({
						admin,
						investor: investor.trim(),
						approved,
					}),
				),
			{ onSuccess: () => setInvestor("") },
		)

	const onFund = (event: FormEvent) => {
		event.preventDefault()
		if (!fundAtomic) return
		fund.mutate(
			async (client, admin) =>
				submit(await client.fund_distributions({ admin, amount: fundAtomic })),
			{ onSuccess: () => setFundAmount("") },
		)
	}

	const onRevenue = (event: FormEvent) => {
		event.preventDefault()
		if (!revenueAtomic) return
		// Millisecond timestamp doubles as a unique idempotency key for the demo.
		const eventId = BigInt(Date.now())
		revenue.mutate(
			async (client, admin) =>
				submit(
					await client.record_revenue({
						admin,
						event_id: eventId,
						amount: revenueAtomic,
					}),
				),
			{ onSuccess: () => setRevenueAmount("") },
		)
	}

	const onWithdraw = (event: FormEvent) => {
		event.preventDefault()
		if (!withdrawAtomic || !isAccount(withdrawTo)) return
		withdraw.mutate(
			async (client, admin) =>
				submit(
					await client.withdraw_raise({
						admin,
						to: withdrawTo.trim(),
						amount: withdrawAtomic,
					}),
				),
			{ onSuccess: () => setWithdrawAmount("") },
		)
	}

	return (
		<section className={styles.panel}>
			<div className={styles.panelHeader}>
				<div>
					<p className={styles.eyebrow}>CONSOLA DEL ADMINISTRADOR</p>
					<h2>Operación de la oferta</h2>
				</div>
				<button
					type="button"
					disabled={pause.isPending}
					onClick={() =>
						pause.mutate(async (client, admin) =>
							submit(
								await client.set_paused({ admin, paused: !offering.paused }),
							),
						)
					}
				>
					{offering.paused ? "Reanudar inversiones" : "Pausar inversiones"}
				</button>
			</div>

			<div className={styles.treasury}>
				<div>
					<span>Capital levantado</span>
					<strong>{formatUsdc(treasury.raised)} USDC</strong>
				</div>
				<div>
					<span>Distribuciones disponibles</span>
					<strong>{formatUsdc(treasury.available)} USDC</strong>
				</div>
				<div>
					<span>Asignado a inversionistas</span>
					<strong>{formatUsdc(treasury.allocated)} USDC</strong>
				</div>
			</div>

			<div className={styles.adminGrid}>
				<div className={styles.form}>
					<label>
						1 · Aprobar wallet inversionista
						<input
							placeholder="G…"
							value={investor}
							onChange={(event) => setInvestor(event.target.value)}
						/>
					</label>
					<div className={styles.row}>
						<button
							type="button"
							disabled={!isAccount(investor) || allowlist.isPending}
							onClick={() => setStatus(true)}
						>
							Aprobar
						</button>
						<button
							type="button"
							disabled={!isAccount(investor) || allowlist.isPending}
							onClick={() => setStatus(false)}
						>
							Revocar
						</button>
					</div>
				</div>

				<form className={styles.form} onSubmit={onFund}>
					<label>
						2 · Fondear distribuciones (USDC)
						<input
							inputMode="decimal"
							placeholder="1000"
							value={fundAmount}
							onChange={(event) => setFundAmount(event.target.value)}
						/>
					</label>
					<button type="submit" disabled={!fundAtomic || fund.isPending}>
						{fund.isPending ? "Firmando…" : "Depositar en tesorería"}
					</button>
				</form>

				<form className={styles.form} onSubmit={onRevenue}>
					<label>
						3 · Registrar venta verificada (USDC)
						<input
							inputMode="decimal"
							placeholder="250"
							value={revenueAmount}
							onChange={(event) => setRevenueAmount(event.target.value)}
						/>
					</label>
					<button
						type="submit"
						disabled={
							!revenueAtomic ||
							revenueAtomic > treasury.available ||
							offering.sold_units === 0n ||
							revenue.isPending
						}
					>
						{revenue.isPending ? "Firmando…" : "Registrar ingreso"}
					</button>
					{!revenue.isPending &&
						revenueAtomic !== undefined &&
						revenueAtomic > treasury.available && (
							<small className={styles.hint}>
								Solo hay {formatUsdc(treasury.available)} USDC fondeados sin
								asignar. Fondea la tesorería (paso 2) antes de registrar este
								ingreso.
							</small>
						)}
				</form>

				<form className={styles.form} onSubmit={onWithdraw}>
					<label>
						4 · Liberar capital a la startup
						<input
							placeholder="Wallet de LumiSolar (G…)"
							value={withdrawTo}
							onChange={(event) => setWithdrawTo(event.target.value)}
						/>
					</label>
					<input
						inputMode="decimal"
						placeholder="Monto USDC"
						aria-label="Monto a liberar en USDC"
						value={withdrawAmount}
						onChange={(event) => setWithdrawAmount(event.target.value)}
					/>
					<button
						type="submit"
						disabled={
							!withdrawAtomic ||
							withdrawAtomic > treasury.raised ||
							!isAccount(withdrawTo) ||
							withdraw.isPending
						}
					>
						{withdraw.isPending ? "Firmando…" : "Liberar capital"}
					</button>
				</form>
			</div>
		</section>
	)
}
