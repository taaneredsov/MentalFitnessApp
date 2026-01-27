import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderWithProviders, userEvent } from "@/test/test-utils"
import { VerifyCodePage } from "../VerifyCodePage"

// Mock the api-client
vi.mock("@/lib/api-client", () => ({
  api: {
    auth: {
      verifyCode: vi.fn(),
    },
  },
}))

import { api } from "@/lib/api-client"

describe("VerifyCodePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe("without email in session", () => {
    it("renders nothing when no email in sessionStorage", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      // Should not show any content (redirects to login)
      expect(screen.queryByText("Voer code in")).not.toBeInTheDocument()
    })
  })

  describe("with email in session", () => {
    beforeEach(() => {
      sessionStorage.setItem("magicLinkEmail", "test@example.com")
    })

    it("displays the code input form", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      expect(screen.getByText("Voer code in")).toBeInTheDocument()
      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })

    it("renders 6 input fields", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      const inputs = screen.getAllByRole("textbox")
      expect(inputs).toHaveLength(6)
    })

    it("shows validity notice", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      expect(screen.getByText("De code is 15 minuten geldig")).toBeInTheDocument()
    })

    it("has button to request new code", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      expect(screen.getByRole("button", { name: /nieuwe code aanvragen/i })).toBeInTheDocument()
    })

    it("has button to go back to login", () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })

      expect(screen.getByRole("button", { name: /terug naar inloggen/i })).toBeInTheDocument()
    })
  })

  describe("code entry", () => {
    beforeEach(() => {
      sessionStorage.setItem("magicLinkEmail", "test@example.com")
    })

    it("auto-advances to next input on digit entry", async () => {
      renderWithProviders(<VerifyCodePage />, { withAuth: true })
      const user = userEvent.setup()

      const inputs = screen.getAllByRole("textbox")
      await user.type(inputs[0], "1")

      // Second input should now be focused
      expect(inputs[1]).toHaveFocus()
    })

    it("calls verifyCode API when all 6 digits entered", async () => {
      vi.mocked(api.auth.verifyCode).mockRejectedValueOnce(new Error("Invalid"))

      renderWithProviders(<VerifyCodePage />, { withAuth: true })
      const user = userEvent.setup()

      const inputs = screen.getAllByRole("textbox")

      // Type each digit
      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")
      await user.type(inputs[2], "3")
      await user.type(inputs[3], "4")
      await user.type(inputs[4], "5")
      await user.type(inputs[5], "6")

      await waitFor(() => {
        expect(api.auth.verifyCode).toHaveBeenCalledWith("test@example.com", "123456")
      })
    })

    it("shows error on invalid code", async () => {
      vi.mocked(api.auth.verifyCode).mockRejectedValueOnce(new Error("Invalid"))

      renderWithProviders(<VerifyCodePage />, { withAuth: true })
      const user = userEvent.setup()

      const inputs = screen.getAllByRole("textbox")
      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")
      await user.type(inputs[2], "3")
      await user.type(inputs[3], "4")
      await user.type(inputs[4], "5")
      await user.type(inputs[5], "6")

      await waitFor(() => {
        expect(screen.getByText(/ongeldige of verlopen code/i)).toBeInTheDocument()
      })
    })

    it("clears inputs on error", async () => {
      vi.mocked(api.auth.verifyCode).mockRejectedValueOnce(new Error("Invalid"))

      renderWithProviders(<VerifyCodePage />, { withAuth: true })
      const user = userEvent.setup()

      const inputs = screen.getAllByRole("textbox")
      await user.type(inputs[0], "1")
      await user.type(inputs[1], "2")
      await user.type(inputs[2], "3")
      await user.type(inputs[3], "4")
      await user.type(inputs[4], "5")
      await user.type(inputs[5], "6")

      await waitFor(() => {
        expect(screen.getByText(/ongeldige of verlopen code/i)).toBeInTheDocument()
      })

      // Inputs should be cleared
      inputs.forEach((input) => {
        expect(input).toHaveValue("")
      })
    })
  })

  describe("paste handling", () => {
    beforeEach(() => {
      sessionStorage.setItem("magicLinkEmail", "test@example.com")
    })

    it("handles pasting full code", async () => {
      vi.mocked(api.auth.verifyCode).mockRejectedValueOnce(new Error("Invalid"))

      renderWithProviders(<VerifyCodePage />, { withAuth: true })
      const user = userEvent.setup()

      const inputs = screen.getAllByRole("textbox")

      // Paste the full code into first input
      await user.click(inputs[0])
      await user.paste("123456")

      await waitFor(() => {
        expect(api.auth.verifyCode).toHaveBeenCalledWith("test@example.com", "123456")
      })
    })
  })
})
