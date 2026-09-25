import { stellarNetwork } from "@stellar-scaffold/app-lib"

const contractIdPattern = /^C[A-Z2-7]{55}$/

const configuredContractId = import.meta.env.PUBLIC_MINKA_MARKET_ID?.trim()
const configuredUsdcSacId = import.meta.env.PUBLIC_USDC_SAC_ID?.trim()
const configuredStartLedger = Number(
	import.meta.env.PUBLIC_MINKA_START_LEDGER?.trim(),
)

const explorerNetwork = stellarNetwork === "PUBLIC" ? "public" : "testnet"

export const minkaConfig = {
	contractId: configuredContractId ?? "",
	usdcSacId: configuredUsdcSacId ?? "",
	/** Ledger where the contract was deployed; lets the feed load full history. */
	startLedger:
		Number.isInteger(configuredStartLedger) && configuredStartLedger > 0
			? configuredStartLedger
			: undefined,
	isContractConfigured: Boolean(
		configuredContractId && contractIdPattern.test(configuredContractId),
	),
	isUsdcConfigured: Boolean(
		configuredUsdcSacId && contractIdPattern.test(configuredUsdcSacId),
	),
	txUrl: (hash: string) =>
		`https://stellar.expert/explorer/${explorerNetwork}/tx/${hash}`,
	contractUrl: (id: string) =>
		`https://stellar.expert/explorer/${explorerNetwork}/contract/${id}`,
}
