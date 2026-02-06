# Implementation Plan: Methods Search

## Overview

Add a search input and goal filter chips to the Methods screen that filters methods by name, description, and linked goal names (Doelstelling). This is a client-side filter using already-loaded data.

## Phase 1: Text Search [DONE]

- [x] Add search state and filter logic to `MethodsPage.tsx`
- [x] Add search input UI with search icon and clear button
- [x] Create goal lookup map for efficient filtering
- [x] Update empty state to differentiate "no methods" vs "no search results"

## Phase 2: Doelstelling Filter + Description Search

### Tasks

- [ ] Add `selectedGoalId` state to `MethodsPage.tsx`
- [ ] Add description to text search matching
- [ ] Add goal filter chip row (horizontal scroll) below search input
- [ ] Combine goal filter with text search (AND logic)

### Technical Details

**File to modify:** `src/pages/MethodsPage.tsx`

**New state:**
```typescript
const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
```

**Available goals for filter chips (exclude "Goede gewoontes"):**
```typescript
const availableGoals = useMemo(() => {
  return goals.filter(g => g.name !== "Goede gewoontes")
}, [goals])
```

**Updated search + goal filter logic (replaces current `searchedMethods`):**
```typescript
const searchedMethods = useMemo(() => {
  let result = filteredMethods

  // Goal filter
  if (selectedGoalId) {
    result = result.filter(method =>
      method.linkedGoalIds?.includes(selectedGoalId)
    )
  }

  // Text search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    result = result.filter(method => {
      if (method.name.toLowerCase().includes(query)) return true
      if (method.description?.toLowerCase().includes(query)) return true
      if (method.linkedGoalIds?.some(goalId => {
        const goalName = goalNameMap.get(goalId)
        return goalName?.includes(query)
      })) return true
      return false
    })
  }

  return result
}, [filteredMethods, selectedGoalId, searchQuery, goalNameMap])
```

**Goal filter chips JSX (between search input and results):**
```tsx
{/* Goal Filter Chips */}
<div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
  <button
    onClick={() => setSelectedGoalId(null)}
    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      !selectedGoalId
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`}
  >
    Alle
  </button>
  {availableGoals.map(goal => (
    <button
      key={goal.id}
      onClick={() => setSelectedGoalId(
        selectedGoalId === goal.id ? null : goal.id
      )}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        selectedGoalId === goal.id
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {goal.name}
    </button>
  ))}
</div>
```

**Updated empty state message:**
```tsx
{searchQuery.trim() && selectedGoalId
  ? "Geen methodes gevonden voor deze combinatie."
  : searchQuery.trim()
    ? "Geen methodes gevonden voor deze zoekopdracht."
    : selectedGoalId
      ? "Geen methodes gevonden voor deze doelstelling."
      : "Geen methodes beschikbaar."}
```

### Verification

- `npm run build` passes
- Text search matches name, description, and goal names
- Goal chips filter correctly, "Alle" resets filter
- Combined: selecting a goal + typing search text shows intersection
- "Goede gewoontes" methods remain excluded
- Chips scroll horizontally on narrow screens
