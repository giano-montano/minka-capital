import {
	Account,
	Address,
	BASE_FEE,
	Contract,
	TransactionBuilder,
	contract,
	rpc,
	scValToNative,
} from "@stellar/stellar-sdk"
import {
	networkPassphrase,
	rpcUrl,
	signTransaction,
	stellarNetwork,
} from "@stellar-scaffold/app-lib"
import { minkaConfig } from "../../lib/minkaConfig"
import {
	type MinkaMarketClient,
	type Offering,
	type Position,
	type RevenueReport,
} from "./types"

const allowHttp = stellarNetwork === "LOCAL"
export const rpcServer = new rpc.Server(rpcUrl, { allowHttp })

// The contract interface (spec) is read once from the deployed Wasm and reused
// for every client, so no generated bindings are needed.
let specPromise: Promise<contract.Spec> | undefined

function loadSpec(): Promise<contract.Spec> {
	specPromise ??= contract.Client.from({
		contractId: minkaConfig.contractId,
		networkPassphrase,
		rpcUrl,
		allowHttp,
	})
		.then((client) => client.spec)
		.catch((error: unknown) => {
			specPromise = undefined
			throw error
		})
	return specPromise
}

/** Read-only client, or a signing client when `publicKey` is the connected wallet. */
export async function getMarketClient(
	publicKey?: string,
): Promise<MinkaMarketClient> {
	const spec = await loadSpec()
	return new contract.Client(spec, {
		contractId: minkaConfig.contractId,
		networkPassphrase,
		rpcUrl,
		allowHttp,
		publicKey,
		signTransaction: publicKey ? signTransaction : undefined,
	}) as unknown as MinkaMarketClient
}

export interface MarketSnapshot {
	admin: string
	usdc: string
	offerings: Offering[]
	/**
	 * Whether the deployed contract uses the permissioned revenue flow
	 * (Minka allows reporting, the issuer submits, Minka approves). Older
	 * deployments expose `fund_distributions` + `record_revenue` instead.
	 */
	supportsRevenueReports: boolean
}

async function hasFunction(name: string): Promise<boolean> {
	const spec = await loadSpec()
	return spec.funcs().some((fn) => fn.name().toString() === name)
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
	const client = await getMarketClient()
	const [admin, usdc, offerings, supportsRevenueReports] = await Promise.all([
		client.get_admin(),
		client.get_usdc(),
		client.get_offerings(),
		hasFunction("submit_revenue_report"),
	])
	return {
		admin: admin.result,
		usdc: usdc.result,
		offerings: offerings.result,
		supportsRevenueReports,
	}
}

export interface RevenueReporting {
	enabled: boolean
	reports: RevenueReport[]
}

export async function fetchRevenueReporting(
	offeringId: number,
): Promise<RevenueReporting> {
	const client = await getMarketClient()
	const [enabled, reports] = await Promise.all([
		client.is_revenue_reporting_enabled({ offering_id: offeringId }),
		client.get_revenue_reports({ offering_id: offeringId }),
	])
	return { enabled: enabled.result, reports: reports.result }
}

export async function fetchPosition(
	offeringId: number,
	investor: string,
): Promise<Position> {
	const client = await getMarketClient()
	return (await client.get_position({ offering_id: offeringId, investor }))
		.result
}

export interface Roles {
	isIssuer: boolean
	isInvestorApproved: boolean
}

export async function fetchRoles(account: string): Promise<Roles> {
	const client = await getMarketClient()
	const [isIssuer, isInvestorApproved] = await Promise.all([
		client.is_issuer({ account }),
		client.is_investor_approved({ account }),
	])
	return {
		isIssuer: isIssuer.result,
		isInvestorApproved: isInvestorApproved.result,
	}
}

// Any valid G-address works as the source of a read-only simulation.
const SIMULATION_SOURCE =
	"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

/**
 * Reads a SEP-41 balance by simulating `balance(id)`. SACs have no Wasm to
 * fetch a spec from, so this builds the call directly.
 */
export async function fetchTokenBalance(
	tokenId: string,
	holder: string,
): Promise<bigint> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: BASE_FEE,
		networkPassphrase,
	})
		.addOperation(
			new Contract(tokenId).call("balance", new Address(holder).toScVal()),
		)
		.setTimeout(30)
		.build()
	const simulation = await rpcServer.simulateTransaction(tx)
	if (rpc.Api.isSimulationError(simulation)) {
		// A holder without a trustline has no balance entry for classic assets.
		if (/trustline|not found|MissingValue/i.test(simulation.error)) return 0n
		throw new Error(simulation.error)
	}
	const retval = simulation.result?.retval
	return retval ? BigInt(scValToNative(retval) as bigint) : 0n
}

/** Signs with the connected wallet, submits, and waits for the ledger. */
export async function submit<T>(
	tx: contract.AssembledTransaction<T>,
): Promise<{ result: T; hash?: string }> {
	const sent = await tx.signAndSend()
	return {
		result: sent.result,
		hash: sent.sendTransactionResponse?.hash,
	}
}

const CONTRACT_ERRORS: Record<number, string> = {
	1: "Configuración de la oferta inválida.",
	2: "El monto o las unidades deben ser mayores a cero.",
	3: "La oferta está pausada: no acepta nuevas inversiones.",
	4: "Tu wallet no está aprobada como inversionista en Minka.",
	5: "No quedan suficientes unidades disponibles en la oferta.",
	6: "Solo el administrador de Minka puede realizar esta operación.",
	7: "El capital levantado disponible no alcanza para ese retiro.",
	8: "La tesorería de distribuciones no tiene fondos suficientes.",
	9: "Ese evento de ingresos ya fue registrado.",
	10: "Aún no hay inversionistas entre quienes distribuir.",
	11: "No tienes retornos pendientes por reclamar.",
	12: "El monto excede los límites aritméticos del contrato.",
	13: "Tu empresa aún no está aprobada como emisora en Minka.",
	14: "La oferta no existe.",
	15: "Solo la empresa emisora de esta oferta puede hacer esto.",
	16: "La oferta ya tiene ventas: el precio es fijo y solo se pueden ampliar las unidades.",
	17: "Minka aún no habilita a tu empresa para reportar utilidades en esta oferta.",
	18: "El reporte de utilidades no existe.",
	19: "Ese reporte de utilidades ya fue revisado.",
}

/**
 * Extracts a message from anything thrown. Wallet modules throw plain
 * `{ code, message }` objects rather than `Error`s, and signing failures can
 * nest the cause, so `String(error)` would print "[object Object]".
 */
function errorText(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === "string") return error
	if (error && typeof error === "object") {
		const { message, error: nested } = error as {
			message?: unknown
			error?: unknown
		}
		if (typeof message === "string" && message) return message
		if (nested) return errorText(nested)
		try {
			return JSON.stringify(error)
		} catch {
			return "Error desconocido"
		}
	}
	return "Error desconocido"
}

/** Turns wallet, simulation, and contract failures into a readable message. */
export function describeError(error: unknown): string {
	const text = errorText(error)
	if (/network|passphrase/i.test(text) && /mismatch|differ|wrong/i.test(text)) {
		return "Tu wallet está en otra red. Cámbiala a Testnet en Freighter."
	}
	const code = /Error\(Contract, #(\d+)\)/.exec(text)?.[1]
	const contractMessage = code ? CONTRACT_ERRORS[Number(code)] : undefined
	if (contractMessage) return contractMessage
	if (
		/balance is not sufficient|resulting balance|insufficient balance/i.test(
			text,
		)
	) {
		return "Saldo de USDC insuficiente en tu wallet."
	}
	if (/trustline/i.test(text)) {
		return "Tu wallet necesita una trustline al activo USDC de la oferta."
	}
	if (/reject|declin|cancel/i.test(text)) {
		return "Firma cancelada en la wallet."
	}
	return text.length > 180 ? `${text.slice(0, 180)}…` : text
}
