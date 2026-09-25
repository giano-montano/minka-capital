import { test, expect } from "@playwright/test"

// UI-smoke parity: framework-agnostic assertions that must hold for every
// target (each framework template in the monorepo, or the single `app/` after
// init). These guard the shared-util/component/style refactor against dropped
// features and broken imports — no chain or wallet interaction required.

test("home page mounts", async ({ page }) => {
	const response = await page.goto("/")
	expect(response?.ok()).toBeTruthy()
	await expect(page.locator("body")).toBeVisible()
})

test("wallet connect button is present", async ({ page }) => {
	await page.goto("/")
	await expect(page.getByRole("button", { name: /connect/i })).toBeVisible()
})

test("contract explorer link is present", async ({ page }) => {
	await page.goto("/")
	await expect(page.locator('a[href="/debug"]').first()).toBeVisible()
})

test("testnet-only disclaimer is visible", async ({ page }) => {
	await page.goto("/")
	await expect(
		page.getByText("Prototipo en Stellar Testnet").first(),
	).toBeVisible()
	await expect(
		page.getByText(/No es una oferta de inversi/).first(),
	).toBeVisible()
})

test("Minka offering dashboard is present", async ({ page }) => {
	await page.goto("/")
	await expect(
		page.getByRole("heading", { name: /Capital para startups/ }),
	).toBeVisible()
})
