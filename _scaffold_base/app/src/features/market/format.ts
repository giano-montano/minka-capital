/** SAC assets (USDC included) use 7 decimal places. */
export const USDC_DECIMALS = 7
const ATOMIC = 10n ** BigInt(USDC_DECIMALS)

/** Formats an atomic amount as a human USDC figure, e.g. 6000000000n -> "600.00". */
export function formatUsdc(atomic: bigint, maxDecimals = 2): string {
	const negative = atomic < 0n
	const abs = negative ? -atomic : atomic
	const whole = abs / ATOMIC
	const fraction = (abs % ATOMIC)
		.toString()
		.padStart(USDC_DECIMALS, "0")
		.slice(0, maxDecimals)
	const wholeText = new Intl.NumberFormat("es-PE").format(whole)
	const text = maxDecimals > 0 ? `${wholeText}.${fraction}` : wholeText
	return negative ? `-${text}` : text
}

/** Parses a decimal USDC string into atomic units; returns undefined if invalid. */
export function parseUsdc(input: string): bigint | undefined {
	const value = input.trim().replace(",", ".")
	if (!/^\d+(\.\d{0,7})?$/.test(value)) return undefined
	const [whole = "0", fraction = ""] = value.split(".")
	return BigInt(whole) * ATOMIC + BigInt(fraction.padEnd(USDC_DECIMALS, "0"))
}

export function formatUnits(units: bigint): string {
	return new Intl.NumberFormat("es-PE").format(units)
}

export function percent(part: bigint, total: bigint): number {
	if (total <= 0n) return 0
	return Number((part * 10_000n) / total) / 100
}

export function shortId(value: string, size = 4): string {
	return value.length <= size * 2 + 1
		? value
		: `${value.slice(0, size)}…${value.slice(-size)}`
}
