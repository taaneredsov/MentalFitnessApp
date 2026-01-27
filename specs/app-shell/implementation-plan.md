# Implementation Plan: App Shell

## Overview

Create the main app shell with bottom tab navigation, homepage, and placeholder tab pages. This forms the core navigation structure for the PWA.

## Phase 1: Bottom Tab Navigation

Create the bottom navigation component with tab routing.

### Tasks

- [x] Install lucide-react for icons
- [x] Create BottomNav component with 4 tabs
- [x] Add routing configuration for all tabs
- [x] Style for mobile with safe area insets
- [x] Add active state highlighting

### Technical Details

**Install icons:**
```bash
npm install lucide-react
```

**src/components/BottomNav.tsx:**
```typescript
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
```

**Add safe area CSS to src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .pt-safe {
    padding-top: env(safe-area-inset-top, 0px);
  }
}
```

**Update index.html viewport meta:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

## Phase 2: App Layout Component

Create main layout wrapper with header and content area.

### Tasks

- [x] Create AppLayout component with header
- [x] Add content area with proper padding for bottom nav
- [x] Create simple header with app title
- [x] Add logout button in header

### Technical Details

**src/components/AppLayout.tsx:**
```typescript
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
```

**src/components/AppHeader.tsx:**
```typescript
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
```

## Phase 3: Homepage

Create the homepage with user greeting and placeholder content.

### Tasks

- [x] Create HomePage component
- [x] Display user greeting with name
- [x] Add placeholder cards for quick actions
- [x] Style for mobile-first design

### Technical Details

**src/pages/HomePage.tsx:**
```typescript
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
```

## Phase 4: Tab Placeholder Pages

Create placeholder pages for Tab1, Tab2, Tab3.

### Tasks

- [x] Create Tab1Page component
- [x] Create Tab2Page component
- [x] Create Tab3Page component
- [x] Each page shows title and placeholder content

### Technical Details

**src/pages/Tab1Page.tsx:**
```typescript
export function Tab1Page() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">Tab 1</h2>
      <p className="text-muted-foreground">
        Content for Tab 1 coming soon.
      </p>
    </div>
  )
}
```

**src/pages/Tab2Page.tsx:**
```typescript
export function Tab2Page() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">Tab 2</h2>
      <p className="text-muted-foreground">
        Content for Tab 2 coming soon.
      </p>
    </div>
  )
}
```

**src/pages/Tab3Page.tsx:**
```typescript
export function Tab3Page() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">Tab 3</h2>
      <p className="text-muted-foreground">
        Content for Tab 3 coming soon.
      </p>
    </div>
  )
}
```

## Phase 5: Route Configuration

Set up complete routing with protected routes.

### Tasks

- [x] Update App.tsx with complete route configuration
- [x] Wrap authenticated routes with ProtectedRoute
- [x] Add page exports from index file

### Technical Details

**src/App.tsx:**
```typescript
import { Routes, Route } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { HomePage } from "@/pages/HomePage"
import { Tab1Page } from "@/pages/Tab1Page"
import { Tab2Page } from "@/pages/Tab2Page"
import { Tab3Page } from "@/pages/Tab3Page"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/tab1" element={<Tab1Page />} />
        <Route path="/tab2" element={<Tab2Page />} />
        <Route path="/tab3" element={<Tab3Page />} />
      </Route>
    </Routes>
  )
}

export default App
```

**src/pages/index.ts:**
```typescript
export { LoginPage } from "./LoginPage"
export { HomePage } from "./HomePage"
export { Tab1Page } from "./Tab1Page"
export { Tab2Page } from "./Tab2Page"
export { Tab3Page } from "./Tab3Page"
```
