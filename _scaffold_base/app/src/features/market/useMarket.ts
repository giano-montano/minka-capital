import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"
import { minkaConfig } from "../../lib/minkaConfig"
import {
	describeError,
	fetchMarketSnapshot,
	fetchPosition,
	fetchTokenBalance,
	getMarketClient,
	submit,
} from "./contract"
import { type MinkaMarketClient } from "./types"

const REFRESH_MS = 15_000
export const marketKeys = {
	all: ["minka"] as const,
	snapshot: ["minka", "snapshot"] as const,
	position: (address?: string) => ["minka", "position", address] as const,
	balance: (token?: string, address?: string) =>
		["minka", "balance", token, address] as const,
}

export function useMarketSnapshot() {
	return useQuery({
		queryKey: marketKeys.snapshot,
		queryFn: fetchMarketSnapshot,
		enabled: minkaConfig.isContractConfigured,
		refetchInterval: REFRESH_MS,
	})
}

export function usePosition(address?: string) {
	return useQuery({
		queryKey: marketKeys.position(address),
		queryFn: () => fetchPosition(address as string),
		enabled: minkaConfig.isContractConfigured && Boolean(address),
		refetchInterval: REFRESH_MS,
	})
}

export function useTokenBalance(token?: string, address?: string) {
	return useQuery({
		queryKey: marketKeys.balance(token, address),
		queryFn: () => fetchTokenBalance(token as string, address as string),
		enabled: Boolean(token && address),
		refetchInterval: REFRESH_MS,
	})
}

/** Refreshes every contract read; called after a transaction or a live event. */
export function useRefreshMarket() {
	const queryClient = useQueryClient()
	return useCallback(
		() => queryClient.invalidateQueries({ queryKey: marketKeys.all }),
		[queryClient],
	)
}

type Action = (
	client: MinkaMarketClient,
	address: string,
) => Promise<{ hash?: string }>

/**
 * Wraps a signed contract call: builds a client for the connected wallet,
 * signs and submits, then notifies and refreshes all market reads.
 */
export function useMarketAction(successMessage: string) {
	const { address, updateBalances } = useWallet()
	const { addNotification } = useNotification()
	const refresh = useRefreshMarket()

	return useMutation({
		mutationFn: async (action: Action) => {
			if (!address) throw new Error("Conecta tu wallet primero.")
			const client = await getMarketClient(address)
			return action(client, address)
		},
		onSuccess: ({ hash }) => {
			addNotification(
				hash ? `${successMessage} · tx ${hash.slice(0, 8)}…` : successMessage,
				"success",
			)
			void refresh()
			void updateBalances()
		},
		onError: (error) => addNotification(describeError(error), "error"),
	})
}

export { submit }
