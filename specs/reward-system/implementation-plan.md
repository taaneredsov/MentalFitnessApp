# Implementation Plan: Reward System

## Overview

Implement a gamification system with points, levels, streaks, and badges to increase user engagement in the Mental Fitness PWA.

---

## Phase 1: Data Infrastructure

Set up Airtable schema and backend API for rewards.

### Tasks

- [x] Add reward fields to Gebruikers table in Airtable (manual)
- [x] Add field IDs to `api/_lib/field-mappings.js`
- [x] Create `api/rewards/index.ts` - GET user rewards
- [x] Create `api/rewards/award.ts` - POST to award points [complex]
  - [x] Calculate points based on activity type
  - [x] Update streak (increment or reset)
  - [x] Check for new badges
  - [x] Calculate level from new total
- [x] Add routes to `server.ts`

### Technical Details

**New Airtable Fields on Gebruikers:**
| Field Name (Dutch) | Type | Default |
|-------------------|------|---------|
| Totaal Punten | Number | 0 |
| Huidige Streak | Number | 0 |
| Langste Streak | Number | 0 |
| Laatste Actieve Dag | Date | (empty) |
| Badges | Long text | "[]" |
| Niveau | Number | 1 |

**Field mappings to add:**
```javascript
// In USER_FIELDS object
totalPoints: "fldXXX",      // Replace with actual field ID
currentStreak: "fldXXX",
longestStreak: "fldXXX",
lastActiveDate: "fldXXX",
badges: "fldXXX",
level: "fldXXX"
```

**GET /api/rewards endpoint:**
```typescript
// Request: GET /api/rewards (with Bearer token)
// Response:
{
  totalPoints: 340,
  currentStreak: 12,
  longestStreak: 15,
  lastActiveDate: "2026-01-20",
  badges: ["eerste_sessie", "week_streak"],
  level: 4
}
```

**POST /api/rewards/award endpoint:**
```typescript
// Request body:
{ activityType: "method" | "habit" | "program", activityId?: string }

// Response:
{
  pointsAwarded: 10,
  newTotal: 350,
  streakUpdated: true,
  currentStreak: 13,
  newBadges: ["vijf_methodes"],
  levelUp: false,
  level: 4
}
```

---

## Phase 2: Types and Utilities

Create TypeScript types and utility functions for rewards.

### Tasks

- [x] Create `src/types/rewards.ts` with interfaces and constants
- [x] Create `src/lib/rewards-utils.ts` with helper functions
- [x] Add `rewards` key to `src/lib/query-keys.ts`
- [x] Add rewards methods to `src/lib/api-client.ts`
- [x] Add `useUserRewards` and `useAwardPoints` hooks to `src/hooks/queries.ts`

### Technical Details

**src/types/rewards.ts:**
```typescript
export interface UserRewards {
  totalPoints: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: string[]
  level: number
}

export interface AwardResult {
  pointsAwarded: number
  newTotal: number
  streakUpdated: boolean
  currentStreak: number
  newBadges: string[]
  levelUp: boolean
  level: number
}

export const POINTS = {
  method: 10,
  methodBonus: 5,      // All session methods
  habit: 5,
  habitBonus: 5,       // All daily habits
  program: 100,
  streak7: 50,
  streak30: 200
} as const

export const LEVELS = [
  { points: 0, name: "Beginner" },
  { points: 50, name: "Ontdekker" },
  { points: 150, name: "Beoefenaar" },
  { points: 350, name: "Doorzetter" },
  { points: 600, name: "Expert" },
  { points: 1000, name: "Meester" },
  { points: 1500, name: "Kampioen" },
  { points: 2500, name: "Legende" },
  { points: 4000, name: "Goeroe" },
  { points: 6000, name: "Mentale Atleet" }
] as const

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
}

export const BADGES: Record<string, Badge> = {
  eerste_sessie: { id: "eerste_sessie", name: "Eerste Stap", description: "Eerste methode voltooid", icon: "🌱" },
  vijf_methodes: { id: "vijf_methodes", name: "Op Weg", description: "5 methodes voltooid", icon: "🚶" },
  twintig_methodes: { id: "twintig_methodes", name: "Doorzetter", description: "20 methodes voltooid", icon: "🏃" },
  eerste_programma: { id: "eerste_programma", name: "Programma Compleet", description: "Eerste programma afgerond", icon: "🎯" },
  week_streak: { id: "week_streak", name: "Week Warrior", description: "7 dagen op rij actief", icon: "🔥" },
  twee_weken_streak: { id: "twee_weken_streak", name: "Constante Kracht", description: "14 dagen op rij actief", icon: "💪" },
  maand_streak: { id: "maand_streak", name: "Maand Meester", description: "30 dagen op rij actief", icon: "👑" },
  goede_start: { id: "goede_start", name: "Goede Start", description: "Eerste gewoonte voltooid", icon: "✨" },
  dagelijkse_held: { id: "dagelijkse_held", name: "Dagelijkse Held", description: "Alle gewoontes op één dag", icon: "🦸" },
  week_gewoontes: { id: "week_gewoontes", name: "Gewoonte Goeroe", description: "7 dagen alle gewoontes", icon: "🧘" }
}
```

**src/lib/rewards-utils.ts:**
```typescript
export function calculateLevel(points: number): number
export function getLevelInfo(level: number): { name: string; minPoints: number; maxPoints: number }
export function getPointsToNextLevel(points: number): { current: number; needed: number; progress: number }
export function calculateStreak(lastActiveDate: string | null, today: string, currentStreak: number): { newStreak: number; updated: boolean }
```

---

## Phase 3: UI Components

Create React components for displaying rewards.

### Tasks

- [x] Create `src/components/rewards/PointsDisplay.tsx` - header widget
- [x] Create `src/components/rewards/StreakCounter.tsx` - flame icon with count
- [x] Create `src/components/rewards/LevelProgress.tsx` - circular progress ring
- [x] Create `src/components/rewards/BadgeGrid.tsx` - achievement showcase
- [x] Create `src/components/rewards/RewardToast.tsx` - points earned notification

### Technical Details

**PointsDisplay.tsx:**
- Compact pill: `🔥12  ⭐340`
- Clicking opens Account page rewards section
- Uses `useUserRewards()` hook

**StreakCounter.tsx:**
- Fire emoji with streak count
- Animates on streak increase
- Shows "🔥 0" when no streak

**LevelProgress.tsx:**
- SVG circular progress ring
- Level number in center
- Level title below
- "X pts to Level Y" text

**BadgeGrid.tsx:**
- 3-column grid
- Earned badges: full color + glow
- Locked badges: greyed out, tap to see requirements
- Uses shadcn Dialog for badge details

**RewardToast.tsx:**
- Animated "+10 pts" floating text
- Optional badge unlock display
- Auto-dismiss after 3 seconds

---

## Phase 4: Integration

Integrate rewards into existing flows.

### Tasks

- [x] Add `<PointsDisplay />` to `src/components/AppHeader.tsx`
- [x] Add rewards section to `src/pages/AccountPage.tsx` [complex]
  - [x] LevelProgress card
  - [x] BadgeGrid card
  - [x] Streak stats
- [x] Integrate points awarding into `src/pages/MethodDetailPage.tsx`
- [x] Add points feedback to `src/components/GoodHabitsSection.tsx`
- [x] Update `src/components/FeedbackModal.tsx` to show points earned

### Technical Details

**AppHeader integration:**
```tsx
<header className="...">
  <div className="flex items-center gap-2">
    <img src={appIcon} ... />
    <h1>Mental Fitness</h1>
  </div>
  <div className="flex items-center gap-2">
    <PointsDisplay />
    <Button variant="ghost" onClick={logout}>
      <LogOut />
    </Button>
  </div>
</header>
```

**MethodDetailPage flow:**
1. User completes method (existing flow)
2. After `recordMethodUsage` succeeds
3. Call `awardPoints({ activityType: 'method', activityId: methodId })`
4. Show RewardToast with result
5. Invalidate rewards query

**GoodHabitsSection integration:**
1. On habit toggle → call habit-usage API (Phase 5)
2. If creating (not unchecking) → also call award API
3. Show "+5 pts" animation next to habit

---

## Phase 5: Good Habits Persistence

Move habit tracking from localStorage to Airtable.

### Tasks

- [x] Create Gewoontegebruik table in Airtable (manual)
- [x] Add field IDs to `api/_lib/field-mappings.js`
- [x] Create `api/habit-usage/index.ts` - GET habits for date
- [x] Create `api/habit-usage/index.ts` - POST habit completion
- [x] Add routes to `server.ts`
- [x] Update `GoodHabitsSection.tsx` to use API
- [x] Remove localStorage logic from GoodHabitsSection

### Technical Details

**New Airtable Table: Gewoontegebruik**
| Field Name | Type | Description |
|------------|------|-------------|
| Gebruiker | Link to Gebruikers | User reference |
| Methode | Link to Methodes | Habit method reference |
| Datum | Date | Completion date (YYYY-MM-DD) |
| Aangemaakt op | Created time | Auto timestamp |

**GET /api/habit-usage?userId=xxx&date=2026-01-20**
```typescript
// Response
{
  completedHabitIds: ["recXXX", "recYYY"]
}
```

**POST /api/habit-usage**
```typescript
// Request
{ userId: "recXXX", methodId: "recYYY", date: "2026-01-20" }

// Response
{ success: true, id: "recZZZ" }

// Idempotent - returns existing record if duplicate
```

**Updated GoodHabitsSection flow:**
1. On mount: fetch habit-usage for today's date
2. Hydrate `completedHabits` Set from API response
3. On toggle ON: POST to habit-usage + POST to rewards/award
4. On toggle OFF: DELETE from habit-usage (no points deduction)
5. Remove all localStorage code

---

## Files Summary

### New Files
- `api/rewards/index.ts`
- `api/rewards/award.ts`
- `api/habit-usage/index.ts`
- `src/types/rewards.ts`
- `src/lib/rewards-utils.ts`
- `src/components/rewards/PointsDisplay.tsx`
- `src/components/rewards/StreakCounter.tsx`
- `src/components/rewards/LevelProgress.tsx`
- `src/components/rewards/BadgeGrid.tsx`
- `src/components/rewards/RewardToast.tsx`

### Modified Files
- `api/_lib/field-mappings.js` - Add reward and habit-usage fields
- `server.ts` - Add reward and habit-usage routes
- `src/lib/query-keys.ts` - Add rewards key
- `src/lib/api-client.ts` - Add rewards and habit-usage methods
- `src/hooks/queries.ts` - Add reward hooks
- `src/components/AppHeader.tsx` - Add PointsDisplay
- `src/pages/AccountPage.tsx` - Add rewards section
- `src/pages/MethodDetailPage.tsx` - Integrate point awarding
- `src/components/GoodHabitsSection.tsx` - API persistence + points
- `src/components/FeedbackModal.tsx` - Show points earned
