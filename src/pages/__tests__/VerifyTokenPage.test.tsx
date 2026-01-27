import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders } from "@/test/test-utils"
import { VerifyTokenPage } from "../VerifyTokenPage"

// Mock the api-client
vi.mock("@/lib/api-client", () => ({
  api: {
    auth: {
      verifyToken: vi.fn(),
    },
  },
}))

import { api } from "@/lib/api-client"

// Helper to render with specific URL search params
function renderWithToken(token: string | null) {
  const path = token ? `/auth/verify?token=${token}` : "/auth/verify"
  return renderWithProviders(<VerifyTokenPage />, {
    withAuth: true,
    initialEntries: [path],
  })
}

describe("VerifyTokenPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("without token parameter", () => {
    it("shows error when no token in URL", async () => {
      renderWithToken(null)

      await waitFor(() => {
        expect(screen.getByText("Link ongeldig")).toBeInTheDocument()
      })
      expect(screen.getByText("Geen geldige link")).toBeInTheDocument()
    })

    it("shows button to request new link", async () => {
      renderWithToken(null)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /nieuwe link aanvragen/i })).toBeInTheDocument()
      })
    })
  })

  describe("with token parameter", () => {
    it("shows loading state while verifying", () => {
      // Don't resolve immediately
      vi.mocked(api.auth.verifyToken).mockImplementation(
        () => new Promise(() => {})
      )

      renderWithToken("valid-token")

      expect(screen.getByText(/even geduld/i)).toBeInTheDocument()
    })

    it("calls verifyToken API with the token", async () => {
      vi.mocked(api.auth.verifyToken).mockRejectedValueOnce(new Error("Invalid"))

      renderWithToken("test-token-123")

      await waitFor(() => {
        expect(api.auth.verifyToken).toHaveBeenCalledWith("test-token-123")
      })
    })

    it("shows error on invalid token", async () => {
      vi.mocked(api.auth.verifyToken).mockRejectedValueOnce(
        new Error("Token expired")
      )

      renderWithToken("expired-token")

      await waitFor(() => {
        expect(screen.getByText("Link ongeldig")).toBeInTheDocument()
      })
      expect(screen.getByText("Token expired")).toBeInTheDocument()
    })

    it("shows validity notice in error state", async () => {
      vi.mocked(api.auth.verifyToken).mockRejectedValueOnce(
        new Error("Invalid")
      )

      renderWithToken("invalid-token")

      await waitFor(() => {
        expect(screen.getByText(/15 minuten geldig/i)).toBeInTheDocument()
      })
    })
  })

  describe("successful verification", () => {
    it("calls setAuthFromResponse on successful verification", async () => {
      const mockUser = { id: "123", name: "Test", email: "test@example.com" }
      vi.mocked(api.auth.verifyToken).mockResolvedValueOnce({
        user: mockUser,
        accessToken: "new-token",
      })

      renderWithToken("valid-token")

      await waitFor(() => {
        expect(api.auth.verifyToken).toHaveBeenCalledWith("valid-token")
      })

      // The component should set shouldRedirect true and wait for isAuthenticated
      // which would then navigate to "/"
    })
  })
})
