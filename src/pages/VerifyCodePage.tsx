import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"

export function VerifyCodePage() {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()
  const { setAuthFromResponse, isAuthenticated } = useAuth()

  const email = sessionStorage.getItem("magicLinkEmail")

  // Navigate after auth state is confirmed
  useEffect(() => {
    if (shouldRedirect && isAuthenticated) {
      sessionStorage.removeItem("magicLinkEmail")
      navigate("/")
    }
  }, [shouldRedirect, isAuthenticated, navigate])

  useEffect(() => {
    if (!email) {
      navigate("/login")
      return
    }
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [email, navigate])

  const handleChange = (index: number, value: string) => {
    // Handle paste of full code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("")
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit
      })
      setCode(newCode)

      // Focus next empty or last input
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()

      // Auto-submit if complete
      if (newCode.every((d) => d)) {
        verifyCode(newCode.join(""))
      }
      return
    }

    // Handle single digit
    const digit = value.replace(/\D/g, "")
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when complete
    if (newCode.every((d) => d)) {
      verifyCode(newCode.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace on empty input
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const verifyCode = async (fullCode: string) => {
    if (!email) return

    setLoading(true)
    setError("")

    try {
      const response = await api.auth.verifyCode(email, fullCode)
      setAuthFromResponse(response.user, response.accessToken)
      setShouldRedirect(true)
    } catch {
      setError("Ongeldige of verlopen code")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    navigate("/login")
  }

  if (!email) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Voer code in</h1>
          <p className="text-muted-foreground text-sm">
            We hebben een 6-cijferige code gestuurd naar
          </p>
          <p className="font-medium">{email}</p>
        </div>

        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold p-0"
              disabled={loading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {loading && (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <div className="space-y-3 pt-4">
          <Button
            variant="ghost"
            onClick={handleResend}
            className="w-full"
            disabled={loading}
          >
            Nieuwe code aanvragen
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate("/login")}
            className="w-full text-muted-foreground"
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar inloggen
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          De code is 15 minuten geldig
        </p>
      </div>
    </div>
  )
}
