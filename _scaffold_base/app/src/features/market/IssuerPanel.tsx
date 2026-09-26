import { StrKey } from "@stellar/stellar-sdk"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { formatUnits, formatUsdc, parseUsdc, usdcInputValue } from "./format"
import styles from "./Market.module.css"
import { RevenueReportList } from "./RevenueReportList"
import { type Offering } from "./types"
import { submit, useMarketAction, useRevenueReporting } from "./useMarket"

const MAX_NAME = 64
const MAX_SYMBOL = 12
const parseUnits = (value: string) =>
	/^\d+$/.test(value.trim()) ? BigInt(value.trim()) : undefined

interface Props {
	address: string
	/** Offerings this wallet issued. */
	ownOfferings: Offering[]
	/** Contract uses the permissioned revenue-report flow. */
	supportsRevenueReports: boolean
}

/**
 * "Mi empresa": everything an approved company does, around its own
 * offerings. In production revenue reports would come from a signed oracle
 * fed by the company's POS or billing system.
 */
export function IssuerPanel({
	address,
	ownOfferings,
	supportsRevenueReports,
}: Props) {
	const [selectedId, setSelectedId] = useState<number>()
	const [creating, setCreating] = useState(false)
	const knownCount = useRef(ownOfferings.length)

	// Jump to a newly published offering; otherwise keep a valid selection.
	useEffect(() => {
		const newest = ownOfferings[ownOfferings.length - 1]
		if (ownOfferings.length > knownCount.current && newest) {
			setSelectedId(newest.id)
			setCreating(false)
		} else if (!ownOfferings.some((o) => o.id === selectedId)) {
			setSelectedId(ownOfferings[0]?.id)
		}
		knownCount.current = ownOfferings.length
	}, [ownOfferings, selectedId])

	const selected = ownOfferings.find((o) => o.id === selectedId)
	const raised = ownOfferings.reduce((sum, o) => sum + o.raised, 0n)
	const committed = ownOfferings.reduce(
		(sum, o) => sum + o.sold_units * o.unit_price,
		0n,
	)
	const showCreate = creating || ownOfferings.length === 0

	return (
		<>
			<section className={styles.metrics}>
				<article>
					<p>Ofertas publicadas</p>
					<strong>{ownOfferings.length}</strong>
					<span>
						{ownOfferings.filter((o) => !o.paused).length} recibiendo
						inversiones
					</span>
				</article>
				<article>
					<p>Capital levantado</p>
					<strong>{formatUsdc(committed)} USDC</strong>
					<span>Suma de todas tus rondas</span>
				</article>
				<article className={raised > 0n ? styles.metricHot : undefined}>
					<p>Disponible para retirar</p>
					<strong>{formatUsdc(raised)} USDC</strong>
					<span>Capital que aún está en el contrato</span>
				</article>
			</section>

			{ownOfferings.length > 0 && (
				<section className={styles.panel}>
					<div className={styles.panelHeader}>
						<div>
							<p className={styles.eyebrow}>TUS OFERTAS</p>
							<div className={styles.segmented} role="tablist">
								{ownOfferings.map((o) => (
									<button
										key={o.id}
										type="button"
										role="tab"
										aria-selected={o.id === selected?.id}
										onClick={() => setSelectedId(o.id)}
									>
										{o.symbol}
										{o.paused && " · pausada"}
									</button>
								))}
							</div>
						</div>
						{!creating && (
							<button type="button" onClick={() => setCreating(true)}>
								+ Nueva oferta
							</button>
						)}
					</div>
					{selected && (
						<ManageOffering
							key={selected.id}
							address={address}
							offering={selected}
							supportsRevenueReports={supportsRevenueReports}
						/>
					)}
				</section>
			)}

			{showCreate && (
				<section className={styles.panel}>
					<CreateOfferingForm
						first={ownOfferings.length === 0}
						onCancel={
							ownOfferings.length > 0 ? () => setCreating(false) : undefined
						}
					/>
				</section>
			)}
		</>
	)
}

function CreateOfferingForm({
	first,
	onCancel,
}: {
	first: boolean
	onCancel?: () => void
}) {
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
				},
			},
		)
	}

	return (
		<form className={styles.createForm} onSubmit={onSubmit}>
			<p className={styles.eyebrow}>
				{first ? "PUBLICA TU PRIMERA OFERTA" : "NUEVA OFERTA"}
			</p>
			<h2>¿Cuánto quieres levantar?</h2>
			<p className={styles.muted}>
				Define el precio de cada unidad y cuántas emites. Los inversionistas
				recibirán una parte proporcional de cada utilidad que repartas.
			</p>
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
			<div className={styles.row}>
				<button
					type="submit"
					className={styles.primary}
					disabled={!valid || create.isPending}
				>
					{create.isPending ? "Firma en tu wallet…" : "Publicar oferta"}
				</button>
				{onCancel && (
					<button type="button" onClick={onCancel}>
						Cancelar
					</button>
				)}
			</div>
		</form>
	)
}

function ManageOffering({
	address,
	offering,
	supportsRevenueReports,
}: {
	address: string
	offering: Offering
	supportsRevenueReports: boolean
}) {
	const locked = offering.sold_units > 0n
	const [price, setPrice] = useState(usdcInputValue(offering.unit_price))
	const [units, setUnits] = useState(offering.target_units.toString())
	const [withdrawAmount, setWithdrawAmount] = useState("")
	const [otherWallet, setOtherWallet] = useState(false)
	const [withdrawTo, setWithdrawTo] = useState("")

	const update = useMarketAction(`${offering.symbol} actualizada`)
	const pause = useMarketAction(
		offering.paused
			? `${offering.symbol} vuelve a recibir inversiones`
			: `${offering.symbol} pausada`,
	)
	const withdraw = useMarketAction("Capital transferido a tu wallet")

	const priceAtomic = parseUsdc(price)
	const unitsValue = parseUnits(units)
	const withdrawAtomic = parseUsdc(withdrawAmount)
	const withdrawTarget = otherWallet ? withdrawTo.trim() : address
	const validWithdrawTarget =
		StrKey.isValidEd25519PublicKey(withdrawTarget) ||
		StrKey.isValidContract(withdrawTarget)
	const progress =
		offering.target_units > 0n
			? Number((offering.sold_units * 1000n) / offering.target_units) / 10
			: 0

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
	const withdrawBlocker = !withdrawAtomic
		? undefined
		: withdrawAtomic > offering.raised
			? `Solo hay ${formatUsdc(offering.raised)} USDC disponibles.`
			: !validWithdrawTarget
				? "Ingresa una dirección de Stellar válida (G… o C…)."
				: undefined

	const id = offering.id
	return (
		<div className={styles.manage}>
			<div className={styles.manageHeader}>
				<div>
					<h2>
						{offering.name}
						<span
							className={offering.paused ? styles.badgeWarn : styles.badgeOk}
						>
							{offering.paused ? "pausada" : "recibiendo inversiones"}
						</span>
					</h2>
					<p className={styles.muted}>
						{formatUnits(offering.sold_units)} de{" "}
						{formatUnits(offering.target_units)} unidades vendidas (
						{progress.toFixed(progress < 10 ? 1 : 0)}%) a{" "}
						{formatUsdc(offering.unit_price)} USDC
					</p>
				</div>
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
					{pause.isPending
						? "Firma en tu wallet…"
						: offering.paused
							? "Reanudar inversiones"
							: "Pausar inversiones"}
				</button>
			</div>

			<div className={styles.manageGrid}>
				<section className={styles.box}>
					<h3>1 · Capital levantado</h3>
					<p className={styles.bigNumber}>
						{formatUsdc(offering.raised)} <small>USDC disponibles</small>
					</p>
					<form
						className={styles.form}
						onSubmit={(event) => {
							event.preventDefault()
							if (!withdrawAtomic || withdrawBlocker) return
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
							Monto a retirar (USDC)
							<span className={styles.inputWithAction}>
								<input
									inputMode="decimal"
									placeholder="0"
									value={withdrawAmount}
									onChange={(event) => setWithdrawAmount(event.target.value)}
								/>
								<button
									type="button"
									disabled={offering.raised <= 0n}
									onClick={() =>
										setWithdrawAmount(usdcInputValue(offering.raised))
									}
								>
									Todo
								</button>
							</span>
						</label>
						<label className={styles.checkbox}>
							<input
								type="checkbox"
								checked={otherWallet}
								onChange={(event) => setOtherWallet(event.target.checked)}
							/>
							Enviar a otra wallet
						</label>
						{otherWallet && (
							<input
								placeholder="Wallet destino (G…)"
								aria-label="Wallet destino"
								value={withdrawTo}
								onChange={(event) => setWithdrawTo(event.target.value)}
							/>
						)}
						<button
							type="submit"
							className={styles.primary}
							disabled={
								!withdrawAtomic ||
								Boolean(withdrawBlocker) ||
								withdraw.isPending
							}
						>
							{withdraw.isPending
								? "Firma en tu wallet…"
								: otherWallet
									? "Retirar a esa wallet"
									: "Retirar a mi wallet"}
						</button>
						{withdrawBlocker && (
							<small className={styles.hint}>{withdrawBlocker}</small>
						)}
					</form>
				</section>

				{supportsRevenueReports ? (
					<IssuerRevenueReports offering={offering} />
				) : (
					<LegacyRevenueForm offering={offering} />
				)}

				<section className={styles.box}>
					<h3>3 · Condiciones de la oferta</h3>
					<p className={styles.muted}>
						{locked
							? "Ya hay inversionistas: el precio quedó fijo para que todos paguen igual. Solo puedes ampliar las unidades."
							: "Sin ventas todavía: puedes corregir precio y unidades libremente."}
					</p>
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
							Precio por unidad (USDC){locked && " · fijo"}
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
							{update.isPending ? "Firma en tu wallet…" : "Guardar cambios"}
						</button>
						{updateBlocker && updateBlocker !== "Sin cambios." && (
							<small className={styles.hint}>{updateBlocker}</small>
						)}
					</form>
				</section>
			</div>
		</div>
	)
}

/**
 * Revenue for contracts without Minka's review step: one action deposits the
 * USDC and records it as a distributed revenue event (two signatures).
 */
function LegacyRevenueForm({ offering }: { offering: Offering }) {
	const [amount, setAmount] = useState("")
	const distribute = useMarketAction(
		"Utilidades repartidas: tus inversionistas ya pueden cobrarlas",
	)
	const amountAtomic = parseUsdc(amount)
	const blocker =
		offering.sold_units === 0n
			? "Necesitas al menos un inversionista para repartir utilidades."
			: undefined

	return (
		<section className={styles.box}>
			<h3>2 · Repartir utilidades</h3>
			<p className={styles.muted}>
				Deposita las utilidades del periodo y el contrato las reparte al
				instante entre tus {formatUnits(offering.sold_units)} unidades vendidas.
				Tu wallet te pedirá dos firmas: depósito y registro.
			</p>
			{offering.available > 0n && (
				<p className={styles.okNote}>
					Tienes {formatUsdc(offering.available)} USDC ya depositados sin
					repartir; se usarán primero.
				</p>
			)}
			<form
				className={styles.form}
				onSubmit={(event) => {
					event.preventDefault()
					if (blocker || !amountAtomic) return
					const toDeposit =
						amountAtomic > offering.available
							? amountAtomic - offering.available
							: 0n
					// Millisecond timestamp doubles as a unique idempotency key.
					const eventId = BigInt(Date.now())
					distribute.mutate(
						async (client, issuer) => {
							if (toDeposit > 0n) {
								await submit(
									await client.fund_distributions({
										issuer,
										offering_id: offering.id,
										amount: toDeposit,
									}),
								)
							}
							return submit(
								await client.record_revenue({
									issuer,
									offering_id: offering.id,
									event_id: eventId,
									amount: amountAtomic,
								}),
							)
						},
						{ onSuccess: () => setAmount("") },
					)
				}}
			>
				<label>
					Utilidades a repartir (USDC)
					<input
						inputMode="decimal"
						placeholder="20"
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
					/>
				</label>
				{amountAtomic && offering.sold_units > 0n && (
					<p className={styles.muted}>
						≈ {formatUsdc(amountAtomic / offering.sold_units)} USDC por unidad
					</p>
				)}
				<button
					type="submit"
					className={styles.primary}
					disabled={Boolean(blocker) || !amountAtomic || distribute.isPending}
				>
					{distribute.isPending ? "Firma en tu wallet…" : "Repartir utilidades"}
				</button>
				{blocker && <small className={styles.hint}>{blocker}</small>}
			</form>
		</section>
	)
}

/**
 * Issuer side of the permissioned revenue flow: once Minka allows reporting,
 * the company deposits the USDC for a sale or period; Minka then approves it
 * and investors can claim their pro-rata share.
 */
function IssuerRevenueReports({ offering }: { offering: Offering }) {
	const reporting = useRevenueReporting(offering.id)
	const [amount, setAmount] = useState("")
	const [reference, setReference] = useState("")
	const submitReport = useMarketAction(
		"Utilidades enviadas a revisión de Minka",
	)

	const amountAtomic = parseUsdc(amount)
	const cleanReference = reference.trim()
	const referenceValue = /^\d{1,19}$/.test(cleanReference)
		? BigInt(cleanReference)
		: undefined
	const enabled = reporting.data?.enabled ?? false
	const blocker = !reporting.data
		? "Verificando permisos…"
		: !enabled
			? "Minka aún no habilita esta oferta para reportar utilidades. Pídeselo a Minka."
			: offering.sold_units === 0n
				? "Aún no hay inversionistas: Minka no podrá aprobar el reparto."
				: cleanReference !== "" && referenceValue === undefined
					? "La referencia debe ser un número (p. ej. 202609)."
					: undefined

	return (
		<section className={styles.box}>
			<h3>
				2 · Repartir utilidades
				<span className={enabled ? styles.badgeOk : styles.badgeWarn}>
					{enabled ? "habilitado" : "sin permiso"}
				</span>
			</h3>
			<p className={styles.muted}>
				Sube las utilidades del periodo. Quedan en custodia hasta que Minka
				apruebe tu reporte; entonces se reparten entre tus inversionistas. Si
				Minka lo rechaza, el USDC vuelve a tu wallet.
			</p>
			<form
				className={styles.form}
				onSubmit={(event) => {
					event.preventDefault()
					if (blocker || !amountAtomic) return
					// Without a reference, a millisecond timestamp is unique enough.
					const ref = referenceValue ?? BigInt(Date.now())
					submitReport.mutate(
						async (client, issuer) =>
							submit(
								await client.submit_revenue_report({
									issuer,
									offering_id: offering.id,
									reference: ref,
									amount: amountAtomic,
								}),
							),
						{
							onSuccess: () => {
								setAmount("")
								setReference("")
							},
						},
					)
				}}
			>
				<label>
					Utilidades a repartir (USDC)
					<input
						inputMode="decimal"
						placeholder="10"
						disabled={!enabled}
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
					/>
				</label>
				{amountAtomic && offering.sold_units > 0n && (
					<p className={styles.muted}>
						≈ {formatUsdc(amountAtomic / offering.sold_units)} USDC por unidad
					</p>
				)}
				<label>
					Referencia (opcional)
					<input
						inputMode="numeric"
						placeholder="Periodo o nº de venta"
						disabled={!enabled}
						value={reference}
						onChange={(event) => setReference(event.target.value)}
					/>
				</label>
				<button
					type="submit"
					className={styles.primary}
					disabled={Boolean(blocker) || !amountAtomic || submitReport.isPending}
				>
					{submitReport.isPending ? "Firma en tu wallet…" : "Enviar a revisión"}
				</button>
			</form>
			{blocker && !submitReport.isPending && (
				<small className={styles.hint}>{blocker}</small>
			)}
			<RevenueReportList
				reports={reporting.data?.reports ?? []}
				emptyText="Aún no has subido utilidades para esta oferta."
			/>
		</section>
	)
}
