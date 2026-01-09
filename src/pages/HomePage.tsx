import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Corporate Mental Fitness</CardTitle>
          <CardDescription>
            Welcome back, {user?.name || "User"}!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            You are logged in as {user?.email}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Next: App shell with bottom navigation
          </p>
          <Button onClick={logout} variant="outline" className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
