import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders, userEvent } from "@/test/test-utils"
import { LoginPage } from "../LoginPage"

// Mock fetch for auth context
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    // Mock initial auth check
    mockFetch.mockImplementation((url) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          json: () => Promise.resolve({ success: false })
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: false, error: "Unknown endpoint" })
      })
    })
  })

  describe("email step", () => {
    it("displays email form initially", async () => {
      renderWithProviders(<LoginPage />, { withAuth: true })

      await waitFor(() => {
        expect(screen.getByText("Welkom")).toBeInTheDocument()
      })
      expect(screen.getByLabelText("E-mailadres")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Doorgaan" })).toBeInTheDocument()
    })

    it("shows link to magic link login", async () => {
      renderWithProviders(<LoginPage />, { withAuth: true })

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /inloggen met email link/i })).toBeInTheDocument()
      })
    })
  })

  describe("form validation", () => {
    it("submits valid email and proceeds to password step", async () => {
      // Email step returns password required
      mockFetch.mockImplementation((url) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
        }
        if (url === "/api/auth/login") {
          return Promise.resolve({
            json: () => Promise.resolve({ success: false, error: "Password required" })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
      })

      renderWithProviders(<LoginPage />, { withAuth: true })
      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByLabelText("E-mailadres")).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText("E-mailadres"), "test@example.com")
      await user.click(screen.getByRole("button", { name: "Doorgaan" }))

      await waitFor(() => {
        expect(screen.getByLabelText("Wachtwoord")).toBeInTheDocument()
      })
    })
  })

  describe("password step", () => {
    async function navigateToPasswordStep() {
      mockFetch.mockImplementation((url) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
        }
        if (url === "/api/auth/login") {
          return Promise.resolve({
            json: () => Promise.resolve({ success: false, error: "Password required" })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
      })

      renderWithProviders(<LoginPage />, { withAuth: true })
      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByLabelText("E-mailadres")).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText("E-mailadres"), "test@example.com")
      await user.click(screen.getByRole("button", { name: "Doorgaan" }))

      await waitFor(() => {
        expect(screen.getByLabelText("Wachtwoord")).toBeInTheDocument()
      })

      return user
    }

    it("displays password form", async () => {
      await navigateToPasswordStep()

      expect(screen.getByLabelText("Wachtwoord")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument()
    })

    it("shows email address in description", async () => {
      await navigateToPasswordStep()

      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })

    it("shows error on invalid credentials", async () => {
      const user = await navigateToPasswordStep()

      // Override mock for password submission
      mockFetch.mockImplementation((url) => {
        if (url === "/api/auth/login") {
          return Promise.resolve({
            json: () => Promise.resolve({ success: false, error: "Ongeldige inloggegevens" })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
      })

      await user.type(screen.getByLabelText("Wachtwoord"), "wrongpassword")
      await user.click(screen.getByRole("button", { name: "Inloggen" }))

      await waitFor(() => {
        expect(screen.getByText("Ongeldige inloggegevens")).toBeInTheDocument()
      })
    })
  })

  describe("successful login", () => {
    it("calls login API with email and password", async () => {
      mockFetch.mockImplementation((url) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
        }
        if (url === "/api/auth/login") {
          // First call (email only) requires password
          return Promise.resolve({
            json: () => Promise.resolve({ success: false, error: "Password required" })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
      })

      renderWithProviders(<LoginPage />, { withAuth: true })
      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByLabelText("E-mailadres")).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText("E-mailadres"), "test@example.com")
      await user.click(screen.getByRole("button", { name: "Doorgaan" }))

      await waitFor(() => {
        expect(screen.getByLabelText("Wachtwoord")).toBeInTheDocument()
      })

      // Now mock successful login
      mockFetch.mockImplementation((url, options) => {
        if (url === "/api/auth/login") {
          const body = JSON.parse(options?.body || "{}")
          if (body.password) {
            return Promise.resolve({
              json: () => Promise.resolve({
                success: true,
                data: {
                  user: { id: "123", name: "Test User", email: "test@example.com" },
                  accessToken: "test-token"
                }
              })
            })
          }
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
      })

      await user.type(screen.getByLabelText("Wachtwoord"), "password123")
      await user.click(screen.getByRole("button", { name: "Inloggen" }))

      // Verify the login API was called with password
      await waitFor(() => {
        const loginCalls = mockFetch.mock.calls.filter(
          ([url]) => url === "/api/auth/login"
        )
        const passwordCall = loginCalls.find(([, options]) => {
          const body = JSON.parse(options?.body || "{}")
          return body.password === "password123"
        })
        expect(passwordCall).toBeTruthy()
      })
    })
  })
})
