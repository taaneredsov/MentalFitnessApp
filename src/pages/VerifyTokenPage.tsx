import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"

export function VerifyTokenPage() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const navigate = useNavigate()
  const { setAuthFromResponse, isAuthenticated } = useAuth()

  // Navigate after auth state is confirmed
  useEffect(() => {
    if (shouldRedirect && isAuthenticated) {
      navigate("/")
    }
  }, [shouldRedirect, isAuthenticated, navigate])

  useEffect(() => {
    const token = searchParams.get("token")

    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error state from URL validation on mount
      setError("Geen geldige link")
      setVerifying(false)
      return
    }

    api.auth
      .verifyToken(token)
      .then((response) => {
        setAuthFromResponse(response.user, response.accessToken)
        setShouldRedirect(true)
      })
      .catch((err) => {
        setError(err.message || "Link is ongeldig of verlopen")
        setVerifying(false)
      })
  }, [searchParams, setAuthFromResponse])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Link ongeldig</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>

          <div className="space-y-3">
            <Button onClick={() => navigate("/login")} className="w-full">
              Nieuwe link aanvragen
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Links zijn 15 minuten geldig en kunnen maar 1x gebruikt worden
          </p>
        </div>
      </div>
    )
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Even geduld, je wordt ingelogd...</p>
        </div>
      </div>
    )
  }

  return null
}
