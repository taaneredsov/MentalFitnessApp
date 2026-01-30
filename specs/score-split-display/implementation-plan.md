# Implementation Plan: Score Split Display

## Overview

Implement three separate score categories (Mental Fitness, Personal Goals, Good Habits) displayed as widgets on the HomePage, with corresponding Airtable schema updates.

## Phase 1: Airtable Schema Updates [ACTION REQUIRED]

Add new fields to store the three score categories separately.

### Tasks

- [ ] Add `Mental Fitness Score` field to Gebruikers table
- [ ] Add `Personal Goals Score` field to Gebruikers table
- [ ] Add `Good Habits Score` field to Gebruikers table
- [ ] Update `Totaal Punten` formula to sum all three scores
- [ ] Update field mappings in code

### Technical Details

**Airtable Fields to Add (Gebruikers table):**

| Field Name (Dutch) | Field ID | Type | Default |
|-------------------|----------|------|---------|
| Mental Fitness Score | TBD | Number | 0 |
| Persoonlijke Doelen Score | TBD | Number | 0 |
| Goede Gewoontes Score | TBD | Number | 0 |

**Update `api/_lib/field-mappings.js`:**
```javascript
export const USER_FIELDS = {
  // ... existing fields
  mentalFitnessScore: "fldXXX",      // Mental Fitness Score
  personalGoalsScore: "fldXXX",      // Persoonlijke Doelen Score
  goodHabitsScore: "fldXXX",         // Goede Gewoontes Score
}
```

**Update `Totaal Punten` formula in Airtable:**
```
{Mental Fitness Score} + {Persoonlijke Doelen Score} + {Goede Gewoontes Score} + {Bonus Punten}
```

## Phase 2: API Updates

Update reward tracking to use the new separate score fields.

### Tasks

- [ ] Update `transformUserRewards` to include separate scores
- [ ] Update method completion to add to Mental Fitness Score
- [ ] Update personal goal completion to add to Personal Goals Score
- [ ] Update habit completion to add to Good Habits Score
- [ ] Add types for split scores

### Technical Details

**File: `api/_lib/field-mappings.js`**
```javascript
export function transformUserRewards(record) {
  const fields = record.fields
  return {
    // ... existing
    mentalFitnessScore: fields[USER_FIELDS.mentalFitnessScore] || 0,
    personalGoalsScore: fields[USER_FIELDS.personalGoalsScore] || 0,
    goodHabitsScore: fields[USER_FIELDS.goodHabitsScore] || 0,
    totalPoints: fields[USER_FIELDS.totalPoints] || 0,
    // ...
  }
}
```

**File: `api/method-usage/index.ts`** (or rewards endpoint)
- When method is completed, increment `mentalFitnessScore` instead of generic points

**File: `api/personal-goal-usage/index.ts`**
- When goal is completed, increment `personalGoalsScore` instead of `bonusPoints`

**File: `api/habit-usage/index.ts`**
- When habit is completed, increment `goodHabitsScore` instead of `bonusPoints`

## Phase 3: Frontend Types & API Client

Update TypeScript types and API client to handle split scores.

### Tasks

- [ ] Update `UserRewards` type with split scores
- [ ] Update `useUserRewards` hook response handling
- [ ] Ensure header still shows total score

### Technical Details

**File: `src/types/rewards.ts`**
```typescript
export interface UserRewards {
  totalPoints: number
  mentalFitnessScore: number
  personalGoalsScore: number
  goodHabitsScore: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: string[]
  level: number
}
```

## Phase 4: Score Widgets Component

Create the three score widget components for HomePage.

### Tasks

- [ ] Create `ScoreWidgets` component with 3 cards
- [ ] Style each widget with distinctive icon and color
- [ ] Add to HomePage below program section
- [ ] Ensure responsive layout (stack on mobile)

### Technical Details

**File: `src/components/ScoreWidgets.tsx`**
```tsx
import { Card, CardContent } from "@/components/ui/card"
import { Brain, Target, CheckCircle } from "lucide-react"
import { useUserRewards } from "@/hooks/queries"
import { formatPoints } from "@/lib/rewards-utils"

export function ScoreWidgets() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading) return <ScoreWidgetsSkeleton />

  const widgets = [
    {
      title: "Mental Fitness",
      score: rewards?.mentalFitnessScore || 0,
      icon: Brain,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      title: "Persoonlijke Doelen",
      score: rewards?.personalGoalsScore || 0,
      icon: Target,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Goede Gewoontes",
      score: rewards?.goodHabitsScore || 0,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    }
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {widgets.map(w => (
        <Card key={w.title} className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className={`w-10 h-10 mx-auto rounded-full ${w.bgColor} flex items-center justify-center mb-2`}>
              <w.icon className={`h-5 w-5 ${w.color}`} />
            </div>
            <p className="text-2xl font-bold">{formatPoints(w.score)}</p>
            <p className="text-xs text-muted-foreground mt-1">{w.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**File: `src/pages/HomePage.tsx`**
```tsx
import { ScoreWidgets } from "@/components/ScoreWidgets"

// Add after InstallPrompt, before program section:
<ScoreWidgets />
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `api/_lib/field-mappings.js` | Add USER_FIELDS for 3 scores, update transform |
| `api/method-usage/index.ts` | Update to use mentalFitnessScore |
| `api/personal-goal-usage/index.ts` | Update to use personalGoalsScore |
| `api/habit-usage/index.ts` | Update to use goodHabitsScore |
| `src/types/rewards.ts` | Add split score fields to UserRewards |
| `src/components/ScoreWidgets.tsx` | New component |
| `src/pages/HomePage.tsx` | Add ScoreWidgets component |

## Testing Checklist

- [ ] All three widgets display on HomePage
- [ ] Scores reflect actual completions
- [ ] Method completion updates Mental Fitness Score
- [ ] Personal goal completion updates Personal Goals Score
- [ ] Habit completion updates Good Habits Score
- [ ] Total in header = sum of three categories
- [ ] Responsive layout works on mobile
