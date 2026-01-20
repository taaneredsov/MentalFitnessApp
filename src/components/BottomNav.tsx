import { NavLink } from "react-router-dom"
import { Home, Calendar, BookOpen, User } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/programs", icon: Calendar, label: "Programma's" },
  { path: "/methods", icon: BookOpen, label: "Methodes" },
  { path: "/account", icon: User, label: "Account" }
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full",
                "text-muted-foreground transition-colors",
                isActive && "text-primary"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
