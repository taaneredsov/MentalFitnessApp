import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Corporate Mental Fitness</CardTitle>
          <CardDescription>
            Your journey to mental wellness starts here
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Project setup complete. Ready for next features:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- API layer with Airtable</li>
            <li>- Authentication system</li>
            <li>- App shell with navigation</li>
          </ul>
          <Button className="w-full">Get Started</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
