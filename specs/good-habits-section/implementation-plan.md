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

**New file: `api/methods/habits.ts`**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { METHOD_FIELDS, GOAL_FIELDS } from "../_lib/field-mappings.js"

/**
 * GET /api/methods/habits
 * Returns methods linked to the "Goede gewoontes" goal
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // First, find the "Goede gewoontes" goal ID
    const goalRecords = await base(tables.goals)
      .select({
        filterByFormula: `{${GOAL_FIELDS.name}} = "Goede gewoontes"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (goalRecords.length === 0) {
      return sendSuccess(res, [])
    }

    const goodHabitsGoalId = goalRecords[0].id

    // Fetch all methods and filter by linked goal
    // (Airtable linked record filters are unreliable with formulas)
    const methodRecords = await base(tables.methods)
      .select({ returnFieldsByFieldId: true })
      .all()

    const habits = methodRecords
      .filter(record => {
        const linkedGoals = record.fields[METHOD_FIELDS.linkedGoals] as string[] | undefined
        return linkedGoals?.includes(goodHabitsGoalId)
      })
      .map(record => ({
        id: record.id,
        name: record.fields[METHOD_FIELDS.name] as string,
        description: record.fields[METHOD_FIELDS.description] as string | undefined
      }))

    return sendSuccess(res, habits)
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

**Add to `server.ts`:**
```typescript
const { default: habitsHandler } = await import("./api/methods/habits.js")
app.get("/api/methods/habits", wrapVercelHandler(habitsHandler))
```

**Goal name field ID** (from field-mappings.js):
- `GOAL_FIELDS.name` = `fldgLmhiCydWQgjUi` (Doelstelling Naam)

**Method linked goals field ID**:
- `METHOD_FIELDS.linkedGoals` = `fldymisqDYdypLbUc` (Doelstellingen gekoppeld)

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
