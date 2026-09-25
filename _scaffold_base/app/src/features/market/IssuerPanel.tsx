import { StrKey } from "@stellar/stellar-sdk"
import { type FormEvent, useState } from "react"
import { formatUnits, formatUsdc, parseUsdc, usdcInputValue } from "./format"
import styles from "./Market.module.css"
import { type Offering } from "./types"
import { submit, useMarketAction } from "./useMarket"

const MAX_NAME = 64
const MAX_SYMBOL = 12
const parseUnits = (value: string) =>
	/^\d+$/.test(value.trim()) ? BigInt(value.trim()) : undefined

interface Props {
	address: string
	/** Offerings this wallet issued. */
	ownOfferings: Offering[]
	/** The offering selected in the catalogue, when it belongs to this wallet. */
	selected?: Offering
	onCreated: () => void
}

/**
 * Console for an approved company: publish offerings, then manage the one
 * selected in the catalogue. In production `record_revenue` would come from a
 * signed oracle fed by the company's POS or billing system.
 */
export function IssuerPanel({
	address,
	ownOfferings,
	selected,
	onCreated,
}: Props) {
	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>CONSOLA DE LA EMPRESA EMISORA</p>
			<h2>Tus ofertas en Minka</h2>
			<p className={styles.muted}>
				Publicaste {ownOfferings.length}{" "}
				{ownOfferings.length === 1 ? "oferta" : "ofertas"}.{" "}
				{selected
					? `Gestionando ${selected.symbol}.`
					: ownOfferings.length > 0
						? "Selecciona una de tus ofertas en el catálogo para gestionarla."
						: ""}
			</p>
			<CreateOfferingForm onCreated={onCreated} />
			{selected && selected.issuer === address && (
				<ManageOffering key={selected.id} offering={selected} />
			)}
		</section>
	)
}

function CreateOfferingForm({ onCreated }: { onCreated: () => void }) {
	const [name, setName] = useState("")
	const [symbol, setSymbol] = useState("")
	const [price, setPrice] = useState("")
	const [units, setUnits] = useState("")
	const create = useMarketAction("Oferta publicada on-chain")

	const priceAtomic = parseUsdc(price)
	const unitsValue = parseUnits(units)
	const cleanSymbol = symbol.trim().toUpperCase()
	const valid =
		name.trim().length > 0 &&
		name.trim().length <= MAX_NAME &&
		cleanSymbol.length > 0 &&
		cleanSymbol.length <= MAX_SYMBOL &&
		Boolean(priceAtomic) &&
		Boolean(unitsValue)

	const onSubmit = (event: FormEvent) => {
		event.preventDefault()
		if (!valid || !priceAtomic || !unitsValue) return
		create.mutate(
			async (client, issuer) =>
				submit(
					await client.create_offering({
						issuer,
						name: name.trim(),
						symbol: cleanSymbol,
						unit_price: priceAtomic,
						target_units: unitsValue,
					}),
				),
			{
				onSuccess: () => {
					setName("")
					setSymbol("")
					setPrice("")
					setUnits("")
					onCreated()
				},
			},
		)
	}

	return (
		<form className={styles.subpanel} onSubmit={onSubmit}>
			<h3>Publicar nueva oferta</h3>
			<div className={styles.formGrid}>
				<label>
					Nombre de la empresa
					<input
						placeholder="LumiSolar Perú"
						maxLength={MAX_NAME}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>
				<label>
					Símbolo
					<input
						placeholder="LUMI-RSN"
						maxLength={MAX_SYMBOL}
						value={symbol}
						onChange={(event) => setSymbol(event.target.value)}
					/>
				</label>
				<label>
					Precio por unidad (USDC)
					<input
						inputMode="decimal"
						placeholder="0.10"
						value={price}
						onChange={(event) => setPrice(event.target.value)}
					/>
				</label>
				<label>
					Unidades a emitir
					<input
						inputMode="numeric"
						placeholder="1000"
						value={units}
						onChange={(event) => setUnits(event.target.value)}
					/>
				</label>
			</div>
			<p className={styles.muted}>
				Meta de la ronda:{" "}
				<strong>
					{priceAtomic && unitsValue
						? `${formatUsdc(priceAtomic * unitsValue)} USDC`
						: "—"}
				</strong>
				. Podrás corregir precio y unidades hasta la primera venta.
			</p>
			<button
				type="submit"
				className={styles.primary}
				disabled={!valid || create.isPending}
			>
				{create.isPending ? "Firmando…" : "Publicar oferta"}
			</button>
		</form>
	)
}

function ManageOffering({ offering }: { offering: Offering }) {
	const locked = offering.sold_units > 0n
	const [price, setPrice] = useState(usdcInputValue(offering.unit_price))
	const [units, setUnits] = useState(offering.target_units.toString())
	const [fundAmount, setFundAmount] = useState("")
	const [revenueAmount, setRevenueAmount] = useState("")
	const [withdrawTo, setWithdrawTo] = useState("")
	const [withdrawAmount, setWithdrawAmount] = useState("")

	const update = useMarketAction(`${offering.symbol} actualizada`)
	const pause = useMarketAction("Estado de la oferta actualizado")
	const fund = useMarketAction("Tesorería de distribuciones fondeada")
	const revenue = useMarketAction("Ingreso registrado y distribuido")
	const withdraw = useMarketAction("Capital liberado a la empresa")

	const priceAtomic = parseUsdc(price)
	const unitsValue = parseUnits(units)
	const fundAtomic = parseUsdc(fundAmount)
	const revenueAtomic = parseUsdc(revenueAmount)
	const withdrawAtomic = parseUsdc(withdrawAmount)
	const withdrawTarget = withdrawTo.trim()
	const validWithdrawTarget =
		StrKey.isValidEd25519PublicKey(withdrawTarget) ||
		StrKey.isValidContract(withdrawTarget)

	const updateBlocker =
		!priceAtomic || !unitsValue
			? "Precio y unidades deben ser mayores a cero."
			: locked && priceAtomic !== offering.unit_price
				? "La oferta ya tiene ventas: el precio es fijo."
				: locked && unitsValue < offering.target_units
					? `Con ventas solo puedes ampliar (mínimo ${formatUnits(offering.target_units)}).`
					: priceAtomic === offering.unit_price &&
						  unitsValue === offering.target_units
						? "Sin cambios."
						: undefined

	const id = offering.id
	return (
		<div className={styles.subpanel}>
			<div className={styles.panelHeader}>
				<h3>
					Gestionar {offering.symbol}
					<span className={locked ? styles.badgeWarn : styles.badgeOk}>
						{locked ? "precio fijo" : "editable"}
					</span>
				</h3>
				<button
					type="button"
					disabled={pause.isPending}
					onClick={() =>
						pause.mutate(async (client, caller) =>
							submit(
								await client.set_paused({
									caller,
									offering_id: id,
									paused: !offering.paused,
								}),
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
					<strong>{formatUsdc(offering.raised)} USDC</strong>
				</div>
				<div>
					<span>Distribuciones disponibles</span>
					<strong>{formatUsdc(offering.available)} USDC</strong>
				</div>
				<div>
					<span>Asignado a inversionistas</span>
					<strong>{formatUsdc(offering.allocated)} USDC</strong>
				</div>
			</div>

			<div className={styles.adminGrid}>
				<form
					className={styles.form}
					onSubmit={(event) => {
						event.preventDefault()
						if (updateBlocker || !priceAtomic || !unitsValue) return
						update.mutate(async (client, issuer) =>
							submit(
								await client.update_offering({
									issuer,
									offering_id: id,
									unit_price: priceAtomic,
									target_units: unitsValue,
								}),
							),
						)
					}}
				>
					<label>
						Precio por unidad (USDC)
						<input
							inputMode="decimal"
							disabled={locked}
							value={price}
							onChange={(event) => setPrice(event.target.value)}
						/>
					</label>
					<label>
						Unidades totales
						<input
							inputMode="numeric"
							value={units}
							onChange={(event) => setUnits(event.target.value)}
						/>
					</label>
					<button
						type="submit"
						disabled={Boolean(updateBlocker) || update.isPending}
					>
						{update.isPending ? "Firmando…" : "Guardar cambios"}
					</button>
					{updateBlocker && updateBlocker !== "Sin cambios." && (
						<small className={styles.hint}>{updateBlocker}</small>
					)}
				</form>

				<form
					className={styles.form}
					onSubmit={(event) => {
						event.preventDefault()
						if (!fundAtomic) return
						fund.mutate(
							async (client, issuer) =>
								submit(
									await client.fund_distributions({
										issuer,
										offering_id: id,
										amount: fundAtomic,
									}),
								),
							{ onSuccess: () => setFundAmount("") },
						)
					}}
				>
					<label>
						Fondear distribuciones (USDC)
						<input
							inputMode="decimal"
							placeholder="10"
							value={fundAmount}
							onChange={(event) => setFundAmount(event.target.value)}
						/>
					</label>
					<button type="submit" disabled={!fundAtomic || fund.isPending}>
						{fund.isPending ? "Firmando…" : "Depositar en tesorería"}
					</button>
				</form>

				<form
					className={styles.form}
					onSubmit={(event) => {
						event.preventDefault()
						if (!revenueAtomic) return
						// Millisecond timestamp doubles as a unique idempotency key.
						const eventId = BigInt(Date.now())
						revenue.mutate(
							async (client, issuer) =>
								submit(
									await client.record_revenue({
										issuer,
										offering_id: id,
										event_id: eventId,
										amount: revenueAtomic,
									}),
								),
							{ onSuccess: () => setRevenueAmount("") },
						)
					}}
				>
					<label>
						Registrar venta verificada (USDC)
						<input
							inputMode="decimal"
							placeholder="10"
							value={revenueAmount}
							onChange={(event) => setRevenueAmount(event.target.value)}
						/>
					</label>
					<button
						type="submit"
						disabled={
							!revenueAtomic ||
							revenueAtomic > offering.available ||
							offering.sold_units === 0n ||
							revenue.isPending
						}
					>
						{revenue.isPending ? "Firmando…" : "Registrar ingreso"}
					</button>
					{!revenue.isPending && offering.sold_units === 0n ? (
						<small className={styles.hint}>
							Necesitas al menos una inversión para distribuir ingresos.
						</small>
					) : (
						!revenue.isPending &&
						revenueAtomic !== undefined &&
						revenueAtomic > offering.available && (
							<small className={styles.hint}>
								Solo hay {formatUsdc(offering.available)} USDC fondeados sin
								asignar. Fondea la tesorería antes de registrar este ingreso.
							</small>
						)
					)}
				</form>

				<form
					className={styles.form}
					onSubmit={(event) => {
						event.preventDefault()
						if (!withdrawAtomic || !validWithdrawTarget) return
						withdraw.mutate(
							async (client, issuer) =>
								submit(
									await client.withdraw_raise({
										issuer,
										offering_id: id,
										to: withdrawTarget,
										amount: withdrawAtomic,
									}),
								),
							{ onSuccess: () => setWithdrawAmount("") },
						)
					}}
				>
					<label>
						Retirar capital levantado
						<input
							placeholder="Wallet destino (G…)"
							value={withdrawTo}
							onChange={(event) => setWithdrawTo(event.target.value)}
						/>
					</label>
					<input
						inputMode="decimal"
						placeholder="Monto USDC"
						aria-label="Monto a retirar en USDC"
						value={withdrawAmount}
						onChange={(event) => setWithdrawAmount(event.target.value)}
					/>
					<button
						type="submit"
						disabled={
							!withdrawAtomic ||
							withdrawAtomic > offering.raised ||
							!validWithdrawTarget ||
							withdraw.isPending
						}
					>
						{withdraw.isPending ? "Firmando…" : "Retirar capital"}
					</button>
				</form>
			</div>
		</div>
	)
}
