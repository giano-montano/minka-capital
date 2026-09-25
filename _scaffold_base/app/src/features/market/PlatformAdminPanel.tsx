import { StrKey } from "@stellar/stellar-sdk"
import { useState } from "react"
import styles from "./Market.module.css"
import { type MinkaMarketClient } from "./types"
import { submit, useMarketAction } from "./useMarket"

type Role = "issuer" | "investor"

const ROLE_COPY: Record<Role, { title: string; help: string }> = {
	issuer: {
		title: "Empresas emisoras",
		help: "Pueden publicar ofertas, fijar su precio, registrar ingresos y retirar el capital levantado.",
	},
	investor: {
		title: "Inversionistas",
		help: "Allowlist global (KYC demo): pueden invertir en cualquier oferta publicada.",
	},
}

/** Minka's own console: decides who may issue and who may invest. */
export function PlatformAdminPanel() {
	return (
		<section className={styles.panel}>
			<p className={styles.eyebrow}>CONSOLA DE MINKA · ADMINISTRADOR</p>
			<h2>Aprobaciones de la plataforma</h2>
			<div className={styles.columns}>
				<RoleForm role="issuer" />
				<RoleForm role="investor" />
			</div>
		</section>
	)
}

function RoleForm({ role }: { role: Role }) {
	const [account, setAccount] = useState("")
	const action = useMarketAction(
		role === "issuer" ? "Empresa emisora actualizada" : "Allowlist actualizada",
	)
	const target = account.trim()
	const valid = StrKey.isValidEd25519PublicKey(target)

	const setStatus = (approved: boolean) =>
		action.mutate(
			async (client: MinkaMarketClient, admin) =>
				submit(
					role === "issuer"
						? await client.set_issuer_status({
								admin,
								issuer: target,
								approved,
							})
						: await client.set_investor_status({
								admin,
								investor: target,
								approved,
							}),
				),
			{ onSuccess: () => setAccount("") },
		)

	return (
		<div className={styles.form}>
			<label>
				{ROLE_COPY[role].title}
				<input
					placeholder="G…"
					value={account}
					onChange={(event) => setAccount(event.target.value)}
				/>
			</label>
			<small className={styles.muted}>{ROLE_COPY[role].help}</small>
			<div className={styles.row}>
				<button
					type="button"
					disabled={!valid || action.isPending}
					onClick={() => setStatus(true)}
				>
					Aprobar
				</button>
				<button
					type="button"
					disabled={!valid || action.isPending}
					onClick={() => setStatus(false)}
				>
					Revocar
				</button>
			</div>
		</div>
	)
}
