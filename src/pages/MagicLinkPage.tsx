import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Loader2, ArrowRight, KeyRound } from "lucide-react"
import { api } from "@/lib/api-client"
import { InstallPrompt } from "@/components/InstallPrompt"

export function MagicLinkPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await api.auth.requestMagicLink(email)
      setSent(true)
      // Store email for code verification page
      sessionStorage.setItem("magicLinkEmail", email)
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Check je email</h1>
            <p className="text-muted-foreground">
              We hebben een login link gestuurd naar
            </p>
            <p className="font-medium">{email}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Klik op de link in de email om in te loggen.</p>
            <p className="mt-2">
              Gebruik je de app op je telefoon? Voer dan de code in.
            </p>
          </div>

          <Button
            onClick={() => navigate("/auth/code")}
            className="w-full"
            size="lg"
          >
            Code invoeren
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setSent(false)
              setEmail("")
            }}
            className="text-muted-foreground"
          >
            Ander email adres gebruiken
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-4">
        <InstallPrompt variant="prominent" />
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Inloggen</h1>
            <p className="text-muted-foreground">
              Voer je email adres in om een login link te ontvangen
            </p>
          </div>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="je@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            className="h-12 text-base"
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full h-12"
            size="lg"
            disabled={loading || !email}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Mail className="h-5 w-5 mr-2" />
                Stuur login link
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Je ontvangt een email met een link en code om in te loggen.
          <br />
          Geen account? Neem contact op met je beheerder.
        </p>

        <div className="pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/login/password", { state: { email } })}
            className="w-full text-muted-foreground"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Inloggen met wachtwoord
          </Button>
        </div>
        </form>
      </div>
    </div>
  )
}
