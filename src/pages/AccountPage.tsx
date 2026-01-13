import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useCompanies } from "@/hooks/queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"
import { LogOut, User, Mail, Building2, KeyRound } from "lucide-react"

export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Use React Query for company names (cached)
  const { data: companyMap, isLoading: isLoadingCompanies } = useCompanies(user?.company)

  const companyNames = useMemo(() => {
    if (!companyMap || !user?.company) return []
    return user.company.map(id => companyMap[id]).filter(Boolean)
  }, [companyMap, user?.company])

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  if (!user) return null

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Account</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              {isLoadingCompanies ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : companyNames.length > 0 ? (
                <p className="font-medium">{companyNames.join(", ")}</p>
              ) : (
                <p className="text-muted-foreground">No company linked</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Wachtwoord wijzigen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Log out
      </Button>
    </div>
  )
}
