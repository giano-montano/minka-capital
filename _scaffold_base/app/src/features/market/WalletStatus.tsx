import { connectWallet } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { formatUsdc, shortId } from "./format"
import styles from "./Market.module.css"
import { useAddTrustline, useHasTrustline } from "./useMarket"

interface Props {
	address?: string
	usdcBalance?: bigint
	/** SAC of the USDC the market settles in. */
	usdcToken?: string
	isAdmin: boolean
	isIssuer: boolean
	isInvestor: boolean
	rolesLoading: boolean
}

/**
 * Who is connected and what they can do here. Unapproved wallets get the one
 * thing they need: their address, ready to send to Minka.
 */
export function WalletStatus({
	address,
	usdcBalance,
	usdcToken,
	isAdmin,
	isIssuer,
	isInvestor,
	rolesLoading,
}: Props) {
	const [copied, setCopied] = useState(false)
	const trustline = useHasTrustline(usdcToken, address)
	const addTrustline = useAddTrustline(usdcToken)

	if (!address) {
		return (
			<section className={styles.walletBar}>
				<div>
					<strong>Conecta tu wallet para operar</strong>
					<span className={styles.muted}>
						Puedes explorar las ofertas sin conectarte. Para invertir, gestionar
						tu empresa o administrar Minka, conecta Freighter en Testnet.
					</span>
				</div>
				<button
					type="button"
					className={styles.primary}
					onClick={() => void connectWallet()}
				>
					Conectar wallet
				</button>
			</section>
		)
	}

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			setCopied(false)
		}
	}

	const roles = [
		isAdmin && "Admin de Minka",
		isIssuer && "Empresa emisora",
		isInvestor && "Inversionista aprobado",
	].filter(Boolean) as string[]
	const noRole = !rolesLoading && roles.length === 0

	return (
		<section className={styles.walletBar}>
			<div>
				<span className={styles.muted}>Conectado como</span>
				<button
					type="button"
					className={styles.addressChip}
					onClick={() => void copy()}
					title="Copiar dirección completa"
				>
					{shortId(address, 6)} {copied ? "✓ copiada" : "⧉"}
				</button>
				<span className={styles.roleChips}>
					{rolesLoading ? (
						<span className={styles.badgeMuted}>verificando roles…</span>
					) : (
						roles.map((role) => (
							<span key={role} className={styles.badgeOk}>
								{role}
							</span>
						))
					)}
				</span>
			</div>
			<div className={styles.walletBalance}>
				<span className={styles.muted}>USDC en tu wallet</span>
				<strong>
					{usdcBalance !== undefined ? formatUsdc(usdcBalance) : "—"}
				</strong>
			</div>
			{trustline.data === false && (
				<div className={styles.walletNotice}>
					<p>
						Tu wallet todavía no acepta USDC: sin esa trustline, los USDC que te
						envíen (incluido el faucet de Circle) se rechazan y no llegan.
						Habilítalo con una firma en Freighter y luego vuelve a pedir USDC en
						faucet.circle.com.
					</p>
					<button
						type="button"
						className={styles.primary}
						disabled={addTrustline.isPending}
						onClick={() => addTrustline.mutate()}
					>
						{addTrustline.isPending ? "Firmando…" : "Habilitar USDC"}
					</button>
				</div>
			)}
			{noRole && (
				<p className={styles.walletNotice}>
					Tu wallet aún no está aprobada. Copia tu dirección (botón de arriba) y
					envíala a Minka para que te habilite como inversionista o empresa
					emisora.
				</p>
			)}
		</section>
	)
}
