import { connectWallet } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { formatUnits, formatUsdc } from "./format"
import styles from "./Market.module.css"
import { OfferingCatalog } from "./OfferingCatalog"
import { OfferingOverview } from "./OfferingOverview"
import { type Offering } from "./types"
import { submit, useMarketAction, usePosition } from "./useMarket"

interface Props {
	offerings: Offering[]
	selected?: Offering
	onSelect: (id: number) => void
	address?: string
	isInvestor: boolean
	rolesLoading: boolean
	usdcBalance?: bigint
	supportsRevenueReports: boolean
	onGoToCompany: () => void
}

/** Public market: every offering, its numbers, and the way to invest. */
export function ExploreTab({
	offerings,
	selected,
	onSelect,
	address,
	isInvestor,
	rolesLoading,
	usdcBalance,
	supportsRevenueReports,
	onGoToCompany,
}: Props) {
	if (offerings.length === 0) {
		return (
			<section className={styles.panel}>
				<p className={styles.eyebrow}>SIN OFERTAS</p>
				<h2>Aún no hay ofertas publicadas</h2>
				<p className={styles.muted}>
					Cuando una empresa aprobada por Minka publique su oferta, aparecerá
					aquí.
				</p>
			</section>
		)
	}

	return (
		<>
			<OfferingCatalog
				offerings={offerings}
				selectedId={selected?.id}
				onSelect={onSelect}
				address={address}
			/>
			{selected && (
				<>
					<OfferingOverview
						offering={selected}
						supportsRevenueReports={supportsRevenueReports}
					/>
					{address && selected.issuer === address ? (
						<section className={styles.panel}>
							<p className={styles.eyebrow}>ES TU OFERTA</p>
							<h2>Gestiona {selected.symbol} desde tu consola</h2>
							<p className={styles.muted}>
								Edita el precio, retira el capital levantado y reparte
								utilidades en la pestaña Mi empresa.
							</p>
							<button
								type="button"
								className={styles.primary}
								onClick={onGoToCompany}
							>
								Ir a Mi empresa
							</button>
						</section>
					) : (
						<InvestBox
							key={selected.id}
							offering={selected}
							address={address}
							isInvestor={isInvestor}
							rolesLoading={rolesLoading}
							usdcBalance={usdcBalance}
						/>
					)}
				</>
			)}
		</>
	)
}

const QUICK_UNITS = [1, 5, 10, 25]

function InvestBox({
	offering,
	address,
	isInvestor,
	rolesLoading,
	usdcBalance,
}: {
	offering: Offering
	address?: string
	isInvestor: boolean
	rolesLoading: boolean
	usdcBalance?: bigint
}) {
	const [unitsInput, setUnitsInput] = useState("1")
	const position = usePosition(offering.id, address)
	const invest = useMarketAction(`Inversión en ${offering.symbol} registrada`)

	const units = /^\d+$/.test(unitsInput) ? BigInt(unitsInput) : 0n
	const cost = units * offering.unit_price
	const remaining = offering.target_units - offering.sold_units
	const affordable =
		usdcBalance !== undefined && offering.unit_price > 0n
			? usdcBalance / offering.unit_price
			: undefined
	const maxUnits =
		affordable !== undefined && affordable < remaining ? affordable : remaining

	// Pre-flight checks mirror the contract's rules so users see why a
	// transaction would fail before being asked to sign it.
	const blocker = !address
		? undefined
		: rolesLoading
			? "Verificando tu wallet…"
			: offering.paused
				? "La empresa pausó las inversiones en esta oferta."
				: remaining <= 0n
					? "La oferta ya se colocó por completo."
					: !isInvestor
						? "Tu wallet aún no está aprobada como inversionista. Copia tu dirección arriba y envíala a Minka."
						: units <= 0n
							? "Ingresa cuántas unidades quieres comprar."
							: units > remaining
								? `Solo quedan ${formatUnits(remaining)} unidades.`
								: usdcBalance !== undefined && usdcBalance < cost
									? `Te faltan ${formatUsdc(cost - usdcBalance)} USDC en tu wallet.`
									: undefined

	const held = position.data?.units ?? 0n

	return (
		<section className={styles.investBox}>
			<div>
				<p className={styles.eyebrow}>INVERTIR EN {offering.symbol}</p>
				<h2>Compra una parte de sus ventas futuras</h2>
				<p className={styles.muted}>
					Cada unidad cuesta {formatUsdc(offering.unit_price)} USDC y te da una
					parte proporcional de cada utilidad que la empresa reparta. Tus
					retornos aparecen en Mi portafolio, listos para cobrar.
				</p>
				{held > 0n && (
					<p className={styles.okNote}>
						Ya tienes {formatUnits(held)} unidades de {offering.symbol}.
					</p>
				)}
			</div>

			{!address ? (
				<div className={styles.investForm}>
					<p className={styles.muted}>
						Conecta tu wallet para invertir en esta oferta.
					</p>
					<button
						type="button"
						className={styles.primary}
						onClick={() => void connectWallet()}
					>
						Conectar wallet
					</button>
				</div>
			) : (
				<form
					className={styles.investForm}
					onSubmit={(event) => {
						event.preventDefault()
						if (blocker) return
						invest.mutate(async (client, investor) =>
							submit(
								await client.invest({
									investor,
									offering_id: offering.id,
									units,
								}),
							),
						)
					}}
				>
					<label>
						Unidades
						<input
							inputMode="numeric"
							value={unitsInput}
							onChange={(event) => setUnitsInput(event.target.value.trim())}
						/>
					</label>
					<div className={styles.quickPicks}>
						{QUICK_UNITS.map((n) => (
							<button
								key={n}
								type="button"
								onClick={() => setUnitsInput(String(n))}
								aria-pressed={unitsInput === String(n)}
							>
								{n}
							</button>
						))}
						{maxUnits > 0n && (
							<button
								type="button"
								onClick={() => setUnitsInput(maxUnits.toString())}
							>
								Máx
							</button>
						)}
					</div>
					<dl className={styles.summary}>
						<div>
							<dt>Pagas</dt>
							<dd>{formatUsdc(cost)} USDC</dd>
						</div>
						<div>
							<dt>Tu saldo</dt>
							<dd>
								{usdcBalance !== undefined
									? `${formatUsdc(usdcBalance)} USDC`
									: "—"}
							</dd>
						</div>
						<div>
							<dt>Disponibles</dt>
							<dd>{formatUnits(remaining)} unidades</dd>
						</div>
					</dl>
					<button
						type="submit"
						className={styles.primary}
						disabled={Boolean(blocker) || invest.isPending}
					>
						{invest.isPending
							? "Firma en tu wallet…"
							: `Invertir ${formatUsdc(cost)} USDC`}
					</button>
					{blocker && !invest.isPending && (
						<small className={styles.hint}>{blocker}</small>
					)}
				</form>
			)}
		</section>
	)
}
