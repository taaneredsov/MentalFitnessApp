# Implementation Plan: Good Habits Section

## Overview

Add a "Goede Gewoontes" section to the HomePage displaying habit-based methods filtered by the "Goede gewoontes" goal. Each habit shows its name (with emoji) and description.

## Phase 1: API Endpoint

Create a dedicated API endpoint to fetch good habit methods.

### Tasks

- [x] Create `GET /api/methods/habits` endpoint
- [x] Filter methods by linked goal "Goede gewoontes"
- [x] Return only needed fields (id, name, description)
- [x] Add route to server.ts for local development

### Technical Details

The endpoint reads from Postgres (`reference_goede_gewoontes_pg` table, synced from Airtable). Returns the user's selected goede gewoontes, or all available habits as fallback.

## Phase 2: Frontend Integration

Add the Good Habits section to HomePage.

### Tasks

- [x] Add `useGoodHabits` query hook in `src/hooks/queries.ts`
- [x] Add API client method `methods.getHabits()`
- [x] Create `GoodHabitsSection` component
- [x] Integrate section into HomePage

### Technical Details

**Add to `src/lib/api-client.ts`:**
```typescript
methods: {
  // ... existing methods
  async getHabits(): Promise<{ id: string; name: string; description?: string }[]> {
    return request("/methods/habits")
  }
}
```

**Add to `src/hooks/queries.ts`:**
```typescript
export function useGoodHabits() {
  return useQuery({
    queryKey: ["goodHabits"],
    queryFn: () => apiClient.methods.getHabits(),
    staleTime: 1000 * 60 * 30, // 30 minutes - habits don't change often
  })
}
```

**New file: `src/components/GoodHabitsSection.tsx`**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useGoodHabits } from "@/hooks/queries"
import { Heart } from "lucide-react"

export function GoodHabitsSection() {
  const { data: habits = [], isLoading } = useGoodHabits()

  // Don't render if no habits
  if (!isLoading && habits.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Goede Gewoontes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : (
          habits.map(habit => (
            <div
              key={habit.id}
              className="p-3 bg-muted/50 rounded-lg"
            >
              <p className="text-sm font-medium">{habit.name}</p>
              {habit.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {habit.description}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
```

**Add to `src/pages/HomePage.tsx`:**
```typescript
import { GoodHabitsSection } from "@/components/GoodHabitsSection"

// In the return JSX, after "Activiteit van Vandaag" or program section:
<section className="grid gap-4 px-4">
  <GoodHabitsSection />
</section>
```

## File Changes Summary

| File | Action |
|------|--------|
| `api/methods/habits.ts` | Create new endpoint |
| `server.ts` | Add route for habits endpoint |
| `src/lib/api-client.ts` | Add `methods.getHabits()` |
| `src/hooks/queries.ts` | Add `useGoodHabits` hook |
| `src/components/GoodHabitsSection.tsx` | Create new component |
| `src/pages/HomePage.tsx` | Import and add GoodHabitsSection |
