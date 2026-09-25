import { type contract } from "@stellar/stellar-sdk"

// Mirrors the `minka-market` contract types (i128 -> bigint, u64 -> bigint,
// u32 -> number).

export interface Offering {
	id: number
	issuer: string
	name: string
	symbol: string
	unit_price: bigint
	target_units: bigint
	sold_units: bigint
	revenue_per_unit_scaled: bigint
	paused: boolean
	/** Investment capital not yet withdrawn by the issuer. */
	raised: bigint
	/** Funded distributions not yet assigned to a revenue event. */
	available: bigint
	/** Distributions assigned to revenue events and owed to investors. */
	allocated: bigint
}

/** Mirrors the contract's `ReportStatus` (a u32-backed enum). */
export const ReportStatus = {
	Pending: 0,
	Approved: 1,
	Rejected: 2,
} as const
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus]

export interface RevenueReport {
	id: number
	offering_id: number
	/** Issuer's sale/period reference, unique per offering (anti-replay). */
	reference: bigint
	amount: bigint
	status: ReportStatus
	/** Ledger close time (Unix seconds) when the report was submitted. */
	submitted_at: bigint
}

export interface Position {
	units: bigint
	revenue_checkpoint_scaled: bigint
	claimable: bigint
}

type Call<Args, Result> = (
	args: Args,
) => Promise<contract.AssembledTransaction<Result>>
type Read<Result> = () => Promise<contract.AssembledTransaction<Result>>

export interface MinkaMarketClient {
	get_admin: Read<string>
	get_usdc: Read<string>
	get_offerings: Read<Offering[]>
	get_position: Call<{ offering_id: number; investor: string }, Position>
	is_issuer: Call<{ account: string }, boolean>
	is_investor_approved: Call<{ account: string }, boolean>

	set_issuer_status: Call<
		{ admin: string; issuer: string; approved: boolean },
		null
	>
	set_investor_status: Call<
		{ admin: string; investor: string; approved: boolean },
		null
	>

	create_offering: Call<
		{
			issuer: string
			name: string
			symbol: string
			unit_price: bigint
			target_units: bigint
		},
		number
	>
	update_offering: Call<
		{
			issuer: string
			offering_id: number
			unit_price: bigint
			target_units: bigint
		},
		null
	>
	set_paused: Call<
		{ caller: string; offering_id: number; paused: boolean },
		null
	>
	// Legacy revenue flow (contracts deployed before revenue reports).
	fund_distributions: Call<
		{ issuer: string; offering_id: number; amount: bigint },
		null
	>
	record_revenue: Call<
		{ issuer: string; offering_id: number; event_id: bigint; amount: bigint },
		null
	>

	// Permissioned revenue flow: Minka allows, issuer submits, Minka reviews.
	set_revenue_reporting: Call<
		{ admin: string; offering_id: number; enabled: boolean },
		null
	>
	submit_revenue_report: Call<
		{ issuer: string; offering_id: number; reference: bigint; amount: bigint },
		number
	>
	approve_revenue_report: Call<
		{ admin: string; offering_id: number; report_id: number },
		null
	>
	reject_revenue_report: Call<
		{ admin: string; offering_id: number; report_id: number },
		null
	>
	is_revenue_reporting_enabled: Call<{ offering_id: number }, boolean>
	get_revenue_reports: Call<{ offering_id: number }, RevenueReport[]>
	withdraw_raise: Call<
		{ issuer: string; offering_id: number; to: string; amount: bigint },
		null
	>

	invest: Call<{ investor: string; offering_id: number; units: bigint }, null>
	claim: Call<{ investor: string; offering_id: number }, bigint>
}

export interface MarketEvent {
	id: string
	kind: string
	/** Values from `#[topic]` fields, after the event name. */
	topics: unknown[]
	/** Remaining event fields, decoded from the event's data map. */
	data: Record<string, unknown>
	ledger: number
	closedAt: string
	txHash: string
}
