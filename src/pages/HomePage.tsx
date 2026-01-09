import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function HomePage() {
  const { user } = useAuth()

  const firstName = user?.name?.split(" ")[0] || "there"

  return (
    <div className="px-4 py-6 space-y-6">
      <section>
        <h2 className="text-2xl font-bold mb-1">
          Hello, {firstName}!
        </h2>
        <p className="text-muted-foreground">
          Welcome to your mental fitness journey.
        </p>
      </section>

      <section className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your daily activities will appear here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track your progress over time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Access helpful resources and guides.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
