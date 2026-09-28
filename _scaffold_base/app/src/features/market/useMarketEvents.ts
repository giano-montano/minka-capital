import { type rpc, scValToNative } from "@stellar/stellar-sdk"
import { useEffect, useRef, useState } from "react"
import { minkaConfig } from "../../lib/minkaConfig"
import { rpcServer } from "./contract"
import { type MarketEvent } from "./types"

const POLL_MS = 4000
const PAGE_LIMIT = 100
// Without a configured deploy ledger, look back ~1 day (5s ledgers).
const DEFAULT_LOOKBACK_LEDGERS = 17_000
// The RPC's oldest ledger keeps moving; stay a little inside the window so the
// first getEvents call does not fall off its edge.
const RETENTION_MARGIN_LEDGERS = 20
const MAX_EVENTS = 200

function toMarketEvent(event: rpc.Api.EventResponse): MarketEvent {
	const [name, ...topics] = event.topic.map((value) => scValToNative(value))
	const decoded: unknown = scValToNative(event.value)
	const data =
		decoded && typeof decoded === "object" && !Array.isArray(decoded)
			? (decoded as Record<string, unknown>)
			: { value: decoded }
	return {
		id: event.id,
		kind: String(name),
		topics,
		data,
		ledger: event.ledger,
		closedAt: event.ledgerClosedAt,
		txHash: event.txHash,
	}
}

/**
 * Picks where the backfill starts: the deploy ledger when configured, else
 * ~1 day back, never before the oldest ledger the RPC still retains (~7 days
 * on Testnet). `truncated` tells the UI that older history was pruned by the
 * RPC and has to be checked on the explorer instead.
 */
async function initialStartLedger(): Promise<{
	startLedger: number
	truncated: boolean
}> {
	const { latestLedger, oldestLedger } = await rpcServer.getHealth()
	const retained = Math.min(
		latestLedger,
		oldestLedger + RETENTION_MARGIN_LEDGERS,
	)
	const wanted =
		minkaConfig.startLedger ??
		Math.max(1, latestLedger - DEFAULT_LOOKBACK_LEDGERS)
	return {
		startLedger: Math.max(retained, wanted),
		truncated: minkaConfig.startLedger !== undefined && wanted < retained,
	}
}

/**
 * Streams every `minka-market` contract event from Stellar RPC: backfills
 * recent history, then polls with the RPC cursor. Events are deduplicated by
 * their RPC id and returned newest first.
 */
export function useMarketEvents(onNewEvents?: (events: MarketEvent[]) => void) {
	const [events, setEvents] = useState<MarketEvent[]>([])
	const [error, setError] = useState<string>()
	const [isLoading, setIsLoading] = useState(minkaConfig.isContractConfigured)
	const [lastSyncedLedger, setLastSyncedLedger] = useState<number>()
	const [historyTruncated, setHistoryTruncated] = useState(false)
	const onNewEventsRef = useRef(onNewEvents)
	onNewEventsRef.current = onNewEvents

	useEffect(() => {
		if (!minkaConfig.isContractConfigured) return

		const filters: rpc.Api.EventFilter[] = [
			{ type: "contract", contractIds: [minkaConfig.contractId] },
		]
		const seen = new Set<string>()
		let cursor: string | undefined
		let stopped = false
		let timeoutId: ReturnType<typeof setTimeout> | undefined
		let backfilled = false

		const poll = async () => {
			try {
				const fresh: MarketEvent[] = []
				// Drain every available page before waiting for the next poll.
				for (;;) {
					let response: rpc.Api.GetEventsResponse
					if (cursor) {
						response = await rpcServer.getEvents({
							filters,
							cursor,
							limit: PAGE_LIMIT,
						})
					} else {
						const { startLedger, truncated } = await initialStartLedger()
						setHistoryTruncated(truncated)
						response = await rpcServer.getEvents({
							filters,
							startLedger,
							limit: PAGE_LIMIT,
						})
					}
					if (stopped) return
					cursor = response.cursor
					setLastSyncedLedger(response.latestLedger)
					for (const raw of response.events) {
						if (seen.has(raw.id)) continue
						seen.add(raw.id)
						fresh.push(toMarketEvent(raw))
					}
					if (response.events.length < PAGE_LIMIT) break
				}

				if (fresh.length > 0) {
					setEvents((prev) =>
						[...fresh.reverse(), ...prev].slice(0, MAX_EVENTS),
					)
					// History loaded on mount is not "new"; only live arrivals are.
					if (backfilled) onNewEventsRef.current?.(fresh)
				}
				backfilled = true
				setError(undefined)
			} catch (err) {
				if (!stopped) {
					setError(err instanceof Error ? err.message : String(err))
				}
			} finally {
				if (!stopped) {
					setIsLoading(false)
					timeoutId = setTimeout(() => void poll(), POLL_MS)
				}
			}
		}

		void poll()
		return () => {
			stopped = true
			if (timeoutId) clearTimeout(timeoutId)
		}
	}, [])

	return { events, error, isLoading, lastSyncedLedger, historyTruncated }
}
