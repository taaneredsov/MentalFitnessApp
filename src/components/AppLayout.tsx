import { Outlet } from "react-router-dom"
import { BottomNav } from "./BottomNav"
import { AppHeader } from "./AppHeader"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
