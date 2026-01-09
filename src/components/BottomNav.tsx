import { NavLink } from "react-router-dom"
import { Home, Calendar, BookOpen, User } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/tab1", icon: Calendar, label: "Tab 1" },
  { path: "/tab2", icon: BookOpen, label: "Tab 2" },
  { path: "/tab3", icon: User, label: "Tab 3" }
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
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
