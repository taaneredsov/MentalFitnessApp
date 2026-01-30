# Implementation Plan: Personal Goals

## Overview

Implement a Personal Goals feature allowing users to create, manage, and complete daily goals for bonus points and streak maintenance.

## Phase 1: API - Field Mappings & Types

Add Airtable configuration and TypeScript types.

### Tasks

- [ ] Add table IDs and field mappings to `api/_lib/field-mappings.js`
- [ ] Add `PersonalGoal` type to `src/types/program.ts`
- [ ] Add transform functions for personal goals

### Technical Details

**Airtable Table IDs (already created):**
- Personal Goals: `tblbjDv35B50ZKG9w`
- Personal Goal Usage: `tbl8eJeQtMnIF5EJo`

**Field mappings to add to `api/_lib/field-mappings.js`:**
```javascript
// Add to tables object
personalGoals: process.env.AIRTABLE_TABLE_PERSONAL_GOALS || "tblbjDv35B50ZKG9w",
personalGoalUsage: process.env.AIRTABLE_TABLE_PERSONAL_GOAL_USAGE || "tbl8eJeQtMnIF5EJo",

// New field mappings (get actual field IDs from Airtable)
export const PERSONAL_GOAL_FIELDS = {
  name: "fldXXX",           // Naam
  description: "fldXXX",    // Beschrijving
  user: "fldXXX",           // Gebruiker (link)
  status: "fldXXX",         // Status
  createdAt: "fldXXX"       // Aangemaakt op
}

export const PERSONAL_GOAL_USAGE_FIELDS = {
  user: "fldXXX",           // Gebruiker (link)
  personalGoal: "fldXXX",   // Persoonlijk Doel (link)
  date: "fldXXX"            // Datum
}
```

**TypeScript type for `src/types/program.ts`:**
```typescript
export interface PersonalGoal {
  id: string
  name: string
  description?: string
  status: "Actief" | "Gearchiveerd"
}
```

## Phase 2: API - Personal Goals Endpoints

Create CRUD endpoints for personal goals.

### Tasks

- [ ] Create `api/personal-goals/index.ts` (GET list, POST create)
- [ ] Create `api/personal-goals/[id].ts` (PATCH update, DELETE)
- [ ] Add validation (max 10 goals per user)

### Technical Details

**GET /api/personal-goals?userId=xxx**
```typescript
// Filter: user is linked AND status = "Actief"
filterByFormula: `AND({Gebruiker} = "${userId}", {Status} = "Actief")`
// Return: array of PersonalGoal objects
```

**POST /api/personal-goals**
```typescript
// Body: { userId, name, description? }
// Validate: user has < 10 active goals
// Create with status = "Actief"
// Return: created PersonalGoal
```

**PATCH /api/personal-goals/[id]**
```typescript
// Body: { name?, description?, status? }
// Validate: goal belongs to current user (from JWT)
// Return: updated PersonalGoal
```

**DELETE /api/personal-goals/[id]**
```typescript
// Validate: goal belongs to current user
// Option A: Hard delete
// Option B: Set status = "Gearchiveerd" (soft delete)
// Return: { success: true }
```

## Phase 3: API - Personal Goal Usage Endpoint

Track daily completions and award points.

### Tasks

- [ ] Create `api/personal-goal-usage/index.ts` (GET, POST, DELETE)
- [ ] Award 10 bonusPoints on completion
- [ ] Update streak on completion (like habits)

### Technical Details

**GET /api/personal-goal-usage?userId=xxx&date=YYYY-MM-DD**
```typescript
// Filter by user and date
// Return: array of goal IDs completed that day
```

**POST /api/personal-goal-usage**
```typescript
// Body: { userId, goalId, date }
// Steps:
// 1. Check for existing record (idempotent - no duplicates)
// 2. Create usage record
// 3. Award 10 points to bonusPoints
// 4. Update streak (same logic as habit-usage):
//    - Compare date to lastActiveDate
//    - Same day: no change
//    - Consecutive day: currentStreak++
//    - Gap: reset streak to 1
//    - Update lastActiveDate, longestStreak if needed
// Return: { success: true, pointsAwarded: 10 }
```

**DELETE /api/personal-goal-usage?userId=xxx&goalId=xxx&date=YYYY-MM-DD**
```typescript
// Find and delete the usage record
// Note: Does NOT subtract points (prevents gaming)
// Return: { success: true }
```

**Streak update logic (copy from `api/habit-usage/index.ts` lines 136-174):**
```javascript
const today = new Date(date)
const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null

let newStreak = user.currentStreak || 0
if (lastActive) {
  const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24))
  if (daysDiff === 0) {
    // Same day, no change
  } else if (daysDiff === 1) {
    newStreak++
  } else {
    newStreak = 1
  }
} else {
  newStreak = 1
}

// Update user fields
await base(tables.users).update(userId, {
  [USER_FIELDS.bonusPoints]: (user.bonusPoints || 0) + 10,
  [USER_FIELDS.currentStreak]: newStreak,
  [USER_FIELDS.longestStreak]: Math.max(newStreak, user.longestStreak || 0),
  [USER_FIELDS.lastActiveDate]: date
})
```

## Phase 4: Frontend - Query Infrastructure

Add React Query hooks and API client methods.

### Tasks

- [ ] Add query keys to `src/lib/query-keys.ts`
- [ ] Add API methods to `src/lib/api-client.ts`
- [ ] Add React Query hooks to `src/hooks/queries.ts`

### Technical Details

**Query keys (`src/lib/query-keys.ts`):**
```typescript
personalGoals: (userId: string) => ["personalGoals", userId],
personalGoalUsage: (userId: string, date: string) => ["personalGoalUsage", userId, date],
```

**API client methods (`src/lib/api-client.ts`):**
```typescript
personalGoals: {
  list: (userId: string, token: string) =>
    fetchWithAuth(`/api/personal-goals?userId=${userId}`, token),
  create: (data: { userId: string; name: string; description?: string }, token: string) =>
    fetchWithAuth("/api/personal-goals", token, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }, token: string) =>
    fetchWithAuth(`/api/personal-goals/${id}`, token, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string, token: string) =>
    fetchWithAuth(`/api/personal-goals/${id}`, token, { method: "DELETE" }),
},
personalGoalUsage: {
  list: (userId: string, date: string, token: string) =>
    fetchWithAuth(`/api/personal-goal-usage?userId=${userId}&date=${date}`, token),
  record: (data: { userId: string; goalId: string; date: string }, token: string) =>
    fetchWithAuth("/api/personal-goal-usage", token, { method: "POST", body: JSON.stringify(data) }),
  delete: (userId: string, goalId: string, date: string, token: string) =>
    fetchWithAuth(`/api/personal-goal-usage?userId=${userId}&goalId=${goalId}&date=${date}`, token, { method: "DELETE" }),
}
```

**React Query hooks (`src/hooks/queries.ts`):**
```typescript
// Pattern: copy from useGoodHabits, useHabitUsage, useRecordHabitUsage, useDeleteHabitUsage
export function usePersonalGoals(userId?: string)
export function usePersonalGoalUsage(userId?: string, date?: string)
export function useRecordPersonalGoalUsage()
export function useDeletePersonalGoalUsage()
export function useCreatePersonalGoal()
export function useUpdatePersonalGoal()
export function useDeletePersonalGoal()
```

## Phase 5: Frontend - UI Components

Build the user interface.

### Tasks

- [ ] Create `src/components/PersonalGoalsSection.tsx` (HomePage display)
- [ ] Create `src/components/PersonalGoalDialog.tsx` (create/edit modal)
- [ ] Add PersonalGoalsSection to `src/pages/HomePage.tsx`
- [ ] Add goal management section to `src/pages/AccountPage.tsx`

### Technical Details

**PersonalGoalsSection.tsx** - Copy pattern from `GoodHabitsSection.tsx`:
- Icon: Target (from lucide-react) instead of Heart
- Title: "Persoonlijke Doelen"
- Same card design with emoji extraction, checkmark button
- Points animation: "+10" on completion
- Uses: usePersonalGoals, usePersonalGoalUsage, useRecordPersonalGoalUsage, useDeletePersonalGoalUsage

**PersonalGoalDialog.tsx** - Modal for create/edit:
```typescript
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: PersonalGoal // undefined = create, defined = edit
  onSave: (data: { name: string; description?: string }) => void
}
// Use Dialog from shadcn/ui
// Form fields: name (Input, required), description (Textarea, optional)
// Buttons: Cancel, Save
```

**HomePage.tsx addition:**
```tsx
import { PersonalGoalsSection } from "@/components/PersonalGoalsSection"
// Add below GoodHabitsSection
<PersonalGoalsSection />
```

**AccountPage.tsx addition:**
```tsx
// New card section for personal goals management
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-lg flex items-center gap-2">
        <Target className="h-5 w-5" />
        Mijn Persoonlijke Doelen
      </CardTitle>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Nieuw Doel
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {/* List of goals with edit/delete buttons */}
    {/* Empty state if no goals */}
  </CardContent>
</Card>
```

## Phase 6: Polish & Testing

Final improvements and verification.

### Tasks

- [ ] Add empty state: "Geen persoonlijke doelen. Voeg je eerste toe!"
- [ ] Add loading states
- [ ] Add error handling with toast notifications
- [ ] Implement optimistic updates for completions
- [ ] Test full flow end-to-end

### Technical Details

**Empty state:**
```tsx
{goals.length === 0 && !isLoading && (
  <p className="text-muted-foreground text-center py-4">
    Geen persoonlijke doelen. Voeg je eerste toe!
  </p>
)}
```

**Optimistic updates** (in useRecordPersonalGoalUsage):
```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.personalGoalUsage(...) })
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, (old) => [...old, variables.goalId])
  return { previous }
},
onError: (err, variables, context) => {
  queryClient.setQueryData(queryKey, context.previous)
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.personalGoalUsage(...) })
  queryClient.invalidateQueries({ queryKey: queryKeys.rewards() })
}
```

## Verification Checklist

1. [ ] Create a personal goal in AccountPage
2. [ ] See it appear on HomePage
3. [ ] Complete it (checkmark) - see +10 points animation
4. [ ] Verify totalPoints increased in header PointsDisplay
5. [ ] Verify streak updated (if first activity of day)
6. [ ] Uncheck goal - completion removed
7. [ ] Refresh page - completion state persists
8. [ ] Edit goal name/description
9. [ ] Delete goal
10. [ ] Test max 10 goals limit
