import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const emailSchema = z.object({
  email: z.string().email("Voer een geldig e-mailadres in")
})

type EmailFormData = z.infer<typeof emailSchema>

export function FirstTimeUserPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema)
  })

  const onSubmit = async (data: EmailFormData) => {
    try {
      setError(null)

      // Call login API without password to check user status
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email })
      })

      const result = await response.json()

      if (!result.success) {
        // If error is "Password is required", user exists and has a password
        if (result.error === "Password is required") {
          setError("Dit account heeft al een wachtwoord. Ga naar de inlogpagina.")
          return
        }
        // Other errors (invalid email, account issues)
        setError(result.error || "Er is iets misgegaan")
        return
      }

      // Check if user needs to set up password
      if (result.data.needsPasswordSetup) {
        navigate("/set-password", {
          replace: true,
          state: { userId: result.data.userId, email: result.data.email }
        })
        return
      }

      // This shouldn't happen - if login succeeded, user has a password
      setError("Dit account heeft al een wachtwoord. Ga naar de inlogpagina.")
    } catch (err) {
      setError("Er is een fout opgetreden. Probeer het opnieuw.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Eerste Keer?</CardTitle>
          <CardDescription>
            Voer je e-mailadres in om je account te activeren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Controleren..." : "Doorgaan"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Heb je al een wachtwoord?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Inloggen
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
