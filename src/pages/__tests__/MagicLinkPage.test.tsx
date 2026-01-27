import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders, userEvent } from "@/test/test-utils"
import { MagicLinkPage } from "../MagicLinkPage"

// Mock the api-client
vi.mock("@/lib/api-client", () => ({
  api: {
    auth: {
      requestMagicLink: vi.fn(),
    },
  },
}))

import { api } from "@/lib/api-client"

describe("MagicLinkPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe("initial state", () => {
    it("displays the login form with email input", () => {
      renderWithProviders(<MagicLinkPage />)

      expect(screen.getByText("Inloggen")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("je@email.com")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /stuur login link/i })).toBeInTheDocument()
    })

    it("shows link to password login", () => {
      renderWithProviders(<MagicLinkPage />)

      expect(screen.getByRole("button", { name: /inloggen met wachtwoord/i })).toBeInTheDocument()
    })

    it("submit button is disabled when email is empty", () => {
      renderWithProviders(<MagicLinkPage />)

      const submitButton = screen.getByRole("button", { name: /stuur login link/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe("form submission", () => {
    it("enables submit button when email is entered", async () => {
      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      const emailInput = screen.getByPlaceholderText("je@email.com")
      await user.type(emailInput, "test@example.com")

      const submitButton = screen.getByRole("button", { name: /stuur login link/i })
      expect(submitButton).not.toBeDisabled()
    })

    it("calls requestMagicLink API on form submission", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      expect(api.auth.requestMagicLink).toHaveBeenCalledWith("test@example.com")
    })

    it("stores email in sessionStorage on successful submission", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(sessionStorage.getItem("magicLinkEmail")).toBe("test@example.com")
      })
    })
  })

  describe("success state", () => {
    it("shows success message after email is sent", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(screen.getByText("Check je email")).toBeInTheDocument()
      })
    })

    it("displays the email address in success state", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(screen.getByText("test@example.com")).toBeInTheDocument()
      })
    })

    it("shows button to enter code", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /code invoeren/i })).toBeInTheDocument()
      })
    })

    it("allows using different email address", async () => {
      vi.mocked(api.auth.requestMagicLink).mockResolvedValueOnce(undefined)

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(screen.getByText("Check je email")).toBeInTheDocument()
      })

      await user.click(screen.getByRole("button", { name: /ander email adres gebruiken/i }))

      // Should be back to form state
      expect(screen.getByPlaceholderText("je@email.com")).toBeInTheDocument()
    })
  })

  describe("error handling", () => {
    it("shows error message on API failure", async () => {
      vi.mocked(api.auth.requestMagicLink).mockRejectedValueOnce(new Error("Network error"))

      renderWithProviders(<MagicLinkPage />)
      const user = userEvent.setup()

      await user.type(screen.getByPlaceholderText("je@email.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /stuur login link/i }))

      await waitFor(() => {
        expect(screen.getByText(/er ging iets mis/i)).toBeInTheDocument()
      })
    })
  })
})
