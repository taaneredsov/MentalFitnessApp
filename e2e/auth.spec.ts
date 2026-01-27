import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveURL(/\/login/)
  })

  test("shows login form elements", async ({ page }) => {
    await page.goto("/login/password")

    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/wachtwoord/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /inloggen/i })).toBeVisible()
  })

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login/password")

    await page.getByPlaceholder(/email/i).fill("invalid@example.com")
    await page.getByPlaceholder(/wachtwoord/i).fill("wrongpassword")
    await page.getByRole("button", { name: /inloggen/i }).click()

    // Should show an error message
    await expect(
      page.getByText(/ongeldige|invalid|niet gevonden|not found/i)
    ).toBeVisible({ timeout: 10000 })
  })

  test("successful login flow", async ({ page }) => {
    await page.goto("/login/password")

    await page.getByPlaceholder(/email/i).fill("test@example.com")
    await page.getByPlaceholder(/wachtwoord/i).fill("testpassword123")
    await page.getByRole("button", { name: /inloggen/i }).click()

    // After successful login, should redirect to home
    await expect(page).toHaveURL("/", { timeout: 10000 })
    // And show some greeting or user content
    await expect(
      page.getByText(/hallo|welkom|hello|welcome/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test("logout clears session", async ({ page }) => {
    // First login
    await page.goto("/login/password")
    await page.getByPlaceholder(/email/i).fill("test@example.com")
    await page.getByPlaceholder(/wachtwoord/i).fill("testpassword123")
    await page.getByRole("button", { name: /inloggen/i }).click()

    await expect(page).toHaveURL("/", { timeout: 10000 })

    // Navigate to account/settings to find logout
    await page.goto("/account")

    // Find and click logout button
    const logoutButton = page.getByRole("button", { name: /uitloggen|logout/i })
    await expect(logoutButton).toBeVisible({ timeout: 5000 })
    await logoutButton.click()

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test("protected routes redirect to login", async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()

    // Try to access protected route
    await page.goto("/programs")

    await expect(page).toHaveURL(/\/login/)
  })

  test("session persists after page reload", async ({ page }) => {
    // Login first
    await page.goto("/login/password")
    await page.getByPlaceholder(/email/i).fill("test@example.com")
    await page.getByPlaceholder(/wachtwoord/i).fill("testpassword123")
    await page.getByRole("button", { name: /inloggen/i }).click()

    await expect(page).toHaveURL("/", { timeout: 10000 })

    // Reload the page
    await page.reload()

    // Should still be logged in (not redirected to login)
    await expect(page).toHaveURL("/")
    await expect(
      page.getByText(/hallo|welkom|hello|welcome/i)
    ).toBeVisible({ timeout: 5000 })
  })
})
