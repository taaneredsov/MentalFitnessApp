import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
    confirmPassword: z.string().min(1, "Bevestig je wachtwoord")
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"]
  })

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm() {
  const { accessToken } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema)
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    if (!accessToken) {
      setError("Niet ingelogd")
      return
    }

    try {
      setError(null)
      setSuccess(false)
      await api.users.changePassword(data.password, accessToken)
      setSuccess(true)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
          Wachtwoord succesvol gewijzigd
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="change-password">Nieuw wachtwoord</Label>
        <Input
          id="change-password"
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
        <Label htmlFor="change-confirmPassword">Bevestig wachtwoord</Label>
        <Input
          id="change-confirmPassword"
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Bezig..." : "Wachtwoord wijzigen"}
      </Button>
    </form>
  )
}
