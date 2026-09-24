const contractIdPattern = /^C[A-Z2-7]{55}$/

const configuredContractId = import.meta.env.PUBLIC_MINKA_MARKET_ID?.trim()
const configuredUsdcSacId = import.meta.env.PUBLIC_USDC_SAC_ID?.trim()

export const minkaConfig = {
	contractId: configuredContractId,
	usdcSacId: configuredUsdcSacId,
	isContractConfigured: Boolean(
		configuredContractId && contractIdPattern.test(configuredContractId),
	),
	isUsdcConfigured: Boolean(
		configuredUsdcSacId && contractIdPattern.test(configuredUsdcSacId),
	),
}
