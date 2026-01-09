import { LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

export function AppHeader() {
  const { logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border pt-safe">
      <div className="flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-semibold">Mental Fitness</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
