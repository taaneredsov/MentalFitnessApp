import { NavLink } from "react-router-dom"
import { Home, Calendar, BookOpen, Lightbulb, User } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/programs", icon: Calendar, label: "Programma" },
  { path: "/methods", icon: BookOpen, label: "Methodes" },
  { path: "/overtuigingen", icon: Lightbulb, label: "Mindset" },
  { path: "/account", icon: User, label: "Account" }
]

export function BottomNav() {
  return (
    <nav data-tour="navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1",
                "text-muted-foreground transition-colors",
                isActive && "text-primary"
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] mt-1 whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
