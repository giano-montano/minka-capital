import { type contract } from "@stellar/stellar-sdk"

// Mirrors the `minka-market` contract types (i128 -> bigint, u64 -> bigint).

export interface Offering {
	target_units: bigint
	sold_units: bigint
	revenue_per_unit_scaled: bigint
	paused: boolean
}

export interface Position {
	approved: boolean
	units: bigint
	revenue_checkpoint_scaled: bigint
	claimable: bigint
}

export interface Treasury {
	raised: bigint
	available: bigint
	allocated: bigint
}

type Call<Args, Result> = (
	args: Args,
) => Promise<contract.AssembledTransaction<Result>>
type Read<Result> = () => Promise<contract.AssembledTransaction<Result>>

export interface MinkaMarketClient {
	get_offering: Read<Offering>
	get_treasury: Read<Treasury>
	get_unit_price: Read<bigint>
	get_admin: Read<string>
	get_usdc: Read<string>
	get_position: Call<{ investor: string }, Position>
	is_revenue_event_processed: Call<{ event_id: bigint }, boolean>
	invest: Call<{ investor: string; units: bigint }, null>
	claim: Call<{ investor: string }, bigint>
	set_investor_status: Call<
		{ admin: string; investor: string; approved: boolean },
		null
	>
	set_paused: Call<{ admin: string; paused: boolean }, null>
	fund_distributions: Call<{ admin: string; amount: bigint }, null>
	record_revenue: Call<
		{ admin: string; event_id: bigint; amount: bigint },
		null
	>
	withdraw_raise: Call<{ admin: string; to: string; amount: bigint }, null>
}

export type MarketEventKind =
	| "offering_created"
	| "offering_pause_changed"
	| "investor_status_changed"
	| "investment_recorded"
	| "raise_withdrawn"
	| "distribution_funded"
	| "revenue_recorded"
	| "claim_recorded"

export interface MarketEvent {
	id: string
	kind: MarketEventKind | string
	/** Values from `#[topic]` fields, after the event name. */
	topics: unknown[]
	/** Remaining event fields, decoded from the event's data map. */
	data: Record<string, unknown>
	ledger: number
	closedAt: string
	txHash: string
}
