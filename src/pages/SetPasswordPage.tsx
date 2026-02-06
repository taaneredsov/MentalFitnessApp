import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const setPasswordSchema = z
  .object({
    code: z.string().length(6, "Voer de 6-cijferige code in"),
    password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
    confirmPassword: z.string().min(1, "Bevestig je wachtwoord")
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"]
  })

type SetPasswordFormData = z.infer<typeof setPasswordSchema>

interface LocationState {
  email: string
}

export function SetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuthFromResponse } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const state = location.state as LocationState | null

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema)
  })

  // Redirect to login if no state
  if (!state?.email) {
    navigate("/login", { replace: true })
    return null
  }

  const onSubmit = async (data: SetPasswordFormData) => {
    try {
      setError(null)
      const response = await api.auth.setPassword(
        state.email,
        data.code,
        data.password
      )

      // Set auth state with the returned user and token
      setAuthFromResponse(response.user, response.accessToken)

      // Navigate to home
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Kies je wachtwoord</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            We hebben een verificatiecode gestuurd naar{" "}
            <strong>{state.email}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Verificatiecode</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                className="text-center text-lg tracking-widest"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-sm text-red-500">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimaal 8 tekens"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Herhaal je wachtwoord"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Bezig..." : "Wachtwoord instellen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
