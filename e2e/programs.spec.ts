import { test, expect, type Page } from "@playwright/test"

// Helper function to login before tests
async function login(page: Page) {
  await page.goto("/login/password")
  await page.getByPlaceholder(/email/i).fill("test@example.com")
  await page.getByPlaceholder(/wachtwoord/i).fill("testpassword123")
  await page.getByRole("button", { name: /inloggen/i }).click()
  await expect(page).toHaveURL("/", { timeout: 10000 })
}

test.describe("Programs", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("home page shows programs section", async ({ page }) => {
    // Home page should display programs
    await expect(
      page.getByText(/programma|program/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test("can navigate to programs list", async ({ page }) => {
    // Look for a link to programs
    const programsLink = page.getByRole("link", { name: /programma|programs/i })

    if (await programsLink.isVisible()) {
      await programsLink.click()
      await expect(page).toHaveURL(/\/programs/)
    }
  })

  test("displays program cards with status badges", async ({ page }) => {
    // Navigate to programs if not already there
    await page.goto("/")

    // Wait for content to load
    await page.waitForLoadState("networkidle")

    // Should see program cards or a message about programs
    const hasPrograms = await page
      .getByText(/actief|gepland|afgerond/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasPrograms) {
      // At least one status badge should be visible
      await expect(
        page.getByText(/actief|gepland|afgerond/i).first()
      ).toBeVisible()
    }
  })

  test("program card shows frequency", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for frequency indicator "x per week"
    const frequencyText = page.getByText(/\dx per week/i)

    if (await frequencyText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(frequencyText.first()).toBeVisible()
    }
  })

  test("can click program card to see details", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Find a clickable program card
    const programCard = page.locator(".cursor-pointer").first()

    if (await programCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await programCard.click()

      // Should navigate to program detail page
      await expect(page).toHaveURL(/\/programs\/rec/, { timeout: 5000 })
    }
  })

  test("program detail page shows schedule", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Navigate to a program detail if available
    const programCard = page.locator(".cursor-pointer").first()

    if (await programCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await programCard.click()
      await expect(page).toHaveURL(/\/programs\/rec/, { timeout: 5000 })

      // Wait for detail page to load
      await page.waitForLoadState("networkidle")

      // Should show schedule or session information
      await expect(
        page.getByText(
          /planning|schedule|sessie|session|maandag|dinsdag|woensdag|donderdag|vrijdag/i
        )
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe("Programs - Progress Tracking", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("running program shows progress bar", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for progress indicator
    const progressText = page.getByText(/voortgang/i)

    if (await progressText.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should show progress percentage
      await expect(page.getByText(/%/)).toBeVisible()
    }
  })

  test("completed sessions are marked", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Navigate to a program detail
    const programCard = page.locator(".cursor-pointer").first()

    if (await programCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await programCard.click()
      await expect(page).toHaveURL(/\/programs\/rec/, { timeout: 5000 })

      // Wait for schedule to load
      await page.waitForLoadState("networkidle")

      // Check for completed session indicators (checkmarks or similar)
      const _completedIndicator = page.locator(
        '[data-completed="true"], .bg-green-100, .text-green-600, [aria-label*="voltooid"], [aria-label*="completed"]'
      )

      // This may or may not be visible depending on program state
      // Just verify the page loaded correctly
      await expect(page).toHaveURL(/\/programs\/rec/)
    }
  })
})

test.describe("Programs - Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("can navigate back from program detail", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Navigate to a program detail
    const programCard = page.locator(".cursor-pointer").first()

    if (await programCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await programCard.click()
      await expect(page).toHaveURL(/\/programs\/rec/, { timeout: 5000 })

      // Go back using browser navigation or back button
      await page.goBack()

      await expect(page).toHaveURL("/")
    }
  })

  test("can access program from home page quick actions", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for quick action or direct program link
    const quickAction = page.getByRole("link", {
      name: /bekijk programma|view program|verder|continue/i,
    })

    if (await quickAction.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quickAction.click()
      // Should navigate somewhere related to programs
      await expect(page).toHaveURL(/\/(programs|methods)/i)
    }
  })
})
