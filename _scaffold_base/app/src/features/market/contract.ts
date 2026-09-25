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
	type Treasury,
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
	offering: Offering
	treasury: Treasury
	unitPrice: bigint
	admin: string
	usdc: string
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
	const client = await getMarketClient()
	const [offering, treasury, unitPrice, admin, usdc] = await Promise.all([
		client.get_offering(),
		client.get_treasury(),
		client.get_unit_price(),
		client.get_admin(),
		client.get_usdc(),
	])
	return {
		offering: offering.result,
		treasury: treasury.result,
		unitPrice: unitPrice.result,
		admin: admin.result,
		usdc: usdc.result,
	}
}

export async function fetchPosition(investor: string): Promise<Position> {
	const client = await getMarketClient()
	return (await client.get_position({ investor })).result
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
	4: "Tu wallet no está aprobada para invertir en esta oferta.",
	5: "No quedan suficientes unidades disponibles en la oferta.",
	6: "Solo el administrador puede realizar esta operación.",
	7: "El capital levantado disponible no alcanza para ese retiro.",
	8: "La tesorería de distribuciones no tiene fondos suficientes.",
	9: "Ese evento de ingresos ya fue registrado.",
	10: "Aún no hay inversionistas entre quienes distribuir.",
	11: "No tienes retornos pendientes por reclamar.",
	12: "El monto excede los límites aritméticos del contrato.",
}

/** Turns wallet, simulation, and contract failures into a readable message. */
export function describeError(error: unknown): string {
	const text = error instanceof Error ? error.message : String(error ?? "Error")
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
