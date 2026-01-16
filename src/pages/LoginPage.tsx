import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

const emailSchema = z.object({
  email: z.string().email("Voer een geldig e-mailadres in")
})

const passwordSchema = z.object({
  password: z.string().min(1, "Wachtwoord is verplicht")
})

type EmailFormData = z.infer<typeof emailSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

type LoginStep = "email" | "password"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<LoginStep>("email")
  const [email, setEmail] = useState("")
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema)
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema)
  })

  const onEmailSubmit = async (data: EmailFormData) => {
    try {
      setError(null)
      setIsCheckingEmail(true)

      // Try to login with just email to check account status
      const result = await login(data.email)

      // New user needs onboarding
      if (result.needsPasswordSetup) {
        navigate("/set-password", {
          replace: true,
          state: { userId: result.userId, email: result.email }
        })
        return
      }

      // This shouldn't happen - existing users need password
      // But just in case, show password step
      setEmail(data.email)
      setStep("password")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Er is iets misgegaan"

      // If error is about password being required, show password step
      if (errorMessage.toLowerCase().includes("password")) {
        setEmail(data.email)
        setStep("password")
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsCheckingEmail(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      setError(null)
      const result = await login(email, data.password)

      // Check if user needs to set up password (onboarding flow)
      if (result.needsPasswordSetup) {
        navigate("/set-password", {
          replace: true,
          state: { userId: result.userId, email: result.email }
        })
        return
      }

      const from = location.state?.from?.pathname || "/"
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggen mislukt")
    }
  }

  const handleBack = () => {
    setStep("email")
    setError(null)
    passwordForm.reset()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {step === "password" && (
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-4 top-4 p-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <CardTitle className="text-2xl">
            {step === "email" ? "Welkom" : "Wachtwoord"}
          </CardTitle>
          {step === "password" && (
            <CardDescription className="mt-2">
              {email}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jouw@email.com"
                  autoComplete="email"
                  autoFocus
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-red-500">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isCheckingEmail}
              >
                {isCheckingEmail ? "Controleren..." : "Doorgaan"}
              </Button>
            </form>
          ) : (
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-sm text-red-500">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting ? "Inloggen..." : "Inloggen"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
