# Implementation Plan: Personal Goals

## Overview

Implement a Personal Goals feature allowing users to create, manage, and complete daily goals for bonus points and streak maintenance.

## Phase 1: API - Field Mappings & Types

Add Airtable configuration and TypeScript types.

### Tasks

- [x] Add table IDs and field mappings to `api/_lib/field-mappings.js`
- [x] Add `PersonalGoal` type to `src/types/program.ts`
- [x] Add transform functions for personal goals

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

- [x] Create `api/personal-goals/index.ts` (GET list, POST create)
- [x] Create `api/personal-goals/[id].ts` (PATCH update, DELETE)
- [x] Add validation (max 10 goals per user)

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

- [x] Create `api/personal-goal-usage/index.ts` (GET, POST, DELETE)
- [x] Award 10 bonusPoints on completion
- [x] Update streak on completion (via `awardRewardActivity`)

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

- [x] Add query keys to `src/lib/query-keys.ts`
- [x] Add API methods to `src/lib/api-client.ts`
- [x] Add React Query hooks to `src/hooks/queries.ts`

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

- [x] Create `src/components/PersonalGoalsSection.tsx` (HomePage display)
- [x] Create `src/components/PersonalGoalDialog.tsx` (create/edit modal)
- [x] Add PersonalGoalsSection to `src/pages/HomePage.tsx`
- [x] Add goal management section to `src/pages/AccountPage.tsx`

### Technical Details

**PersonalGoalsSection.tsx:**
- Icon: Target (from lucide-react)
- Title: "Persoonlijke Doelen"
- Each goal: card with Target icon + total count badge, goal name, today count, and checkmark button
- Checkmark button: grey by default (`bg-muted text-muted-foreground`) with a small blue `+` badge in top-right corner
- On completion: button flashes teal (`oklch(60% .12 185)`) for 2 seconds, `+` badge hides during flash
- Points animation: "+10" with star icon next to button on completion
- Expandable goal description on card tap
- Uses: usePersonalGoals, usePersonalGoalUsage, useCompletePersonalGoal

**PersonalGoalDialog.tsx** - Modal for create/edit:
- Uses Dialog from shadcn/ui
- Form fields: name (Input, required), description (Textarea, optional)
- Buttons: Cancel, Save

## Phase 6: Polish & Testing

Final improvements and verification.

### Tasks

- [x] Add empty state: "Geen persoonlijke doelen. Voeg je eerste toe!"
- [x] Add loading states
- [x] Implement optimistic updates for completions
- [x] Test full flow end-to-end

### Backend Resilience (added 2026-02-20)

The `awardRewardActivity()` call in the POST handler is wrapped in try/catch. If the reward engine fails (Airtable timeout, rate limit), the usage record creation and count still succeed — only a warning is logged. This applies to both `handlePostPostgres` and `handlePostAirtable`.

## Verification Checklist

1. [x] Create a personal goal in AccountPage
2. [x] See it appear on HomePage
3. [x] Complete it (checkmark) - see +10 points animation
4. [x] Verify totalPoints increased in header PointsDisplay
5. [x] Verify streak updated (if first activity of day)
6. [x] Refresh page - completion state persists
7. [x] Edit goal name/description
8. [x] Delete goal
9. [x] Test max 10 goals limit
