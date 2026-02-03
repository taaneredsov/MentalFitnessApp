# Implementation Plan: Methods Search

## Overview

Add a search input to the Methods screen that filters methods by name and linked goal names (Doelstelling). This is a client-side filter using already-loaded data.

## Phase 1: Add Search Functionality

Implement the search input and filtering logic in the MethodsPage component.

### Tasks

- [x] Add search state and filter logic to `MethodsPage.tsx`
- [x] Add search input UI with search icon and clear button
- [x] Create goal lookup map for efficient filtering
- [x] Update empty state to differentiate "no methods" vs "no search results"

### Technical Details

**File to modify:** `src/pages/MethodsPage.tsx`

**Imports to add:**
```typescript
import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
```

**State to add:**
```typescript
const [searchQuery, setSearchQuery] = useState("")
```

**Goal lookup map (for efficient filtering):**
```typescript
const goalNameMap = useMemo(() => {
  const map = new Map<string, string>()
  goals.forEach(goal => map.set(goal.id, goal.name.toLowerCase()))
  return map
}, [goals])
```

**Filter logic (after existing `filteredMethods`):**
```typescript
const searchedMethods = useMemo(() => {
  if (!searchQuery.trim()) return filteredMethods

  const query = searchQuery.toLowerCase().trim()

  return filteredMethods.filter(method => {
    // Match method name
    if (method.name.toLowerCase().includes(query)) return true

    // Match linked goal names
    if (method.linkedGoalIds?.some(goalId => {
      const goalName = goalNameMap.get(goalId)
      return goalName?.includes(query)
    })) return true

    return false
  })
}, [filteredMethods, searchQuery, goalNameMap])
```

**Search input JSX (between h2 and methods list):**
```tsx
{/* Search Input */}
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    type="text"
    placeholder="Zoek methodes..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9 pr-9"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery("")}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      aria-label="Zoekopdracht wissen"
    >
      <X className="h-4 w-4" />
    </button>
  )}
</div>
```

**Updated empty state:**
```tsx
{searchedMethods.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-muted-foreground">
      {searchQuery.trim()
        ? "Geen methodes gevonden voor deze zoekopdracht."
        : "Geen methodes beschikbaar."}
    </p>
  </div>
) : (
  // existing methods list using searchedMethods instead of filteredMethods
)}
```

**Update methods map to use `searchedMethods`:**
```tsx
{searchedMethods.map(method => (
  <MethodCard ... />
))}
```
