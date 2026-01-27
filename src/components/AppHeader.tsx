import { LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { PointsDisplay } from "@/components/rewards"
import appIcon from "/pwa-512x512.svg"

export function AppHeader() {
  const { logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border pt-safe">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <img src={appIcon} alt="Mental Fitness" className="h-8 w-8" />
          <h1 className="text-lg font-semibold">Mental Fitness</h1>
        </div>
        <div className="flex items-center gap-2">
          <PointsDisplay />
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
