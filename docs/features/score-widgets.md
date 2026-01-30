# Score Widgets (3-Widget Split Display)

Three separate score widgets displayed on the home page showing split scores for different activity types.

## Overview

The score widgets provide immediate visual feedback on user progress across three distinct areas of the mental fitness program. Each widget displays a specific score type with its own icon and color scheme.

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │    🧠    │  │    🎯    │  │    ❤️     │          │
│  │  Mental  │  │   Pers.  │  │  Gewoon-  │          │
│  │ Fitness  │  │  Doelen  │  │   tes     │          │
│  │   150    │  │    30    │  │    45     │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

### Widget Structure

Each widget displays:
- **Icon** (top) - Colored circular background
- **Label** (middle) - Activity type name, truncated if needed
- **Score** (bottom) - Large bold number

### Color Scheme

| Widget | Color | Icon | Tailwind Classes |
|--------|-------|------|------------------|
| Mental Fitness | Primary blue | Brain | `bg-primary`, `text-primary-foreground` |
| Personal Goals | Orange | Target | `bg-orange-500`, `text-orange-50` |
| Good Habits | Pink | Heart | `bg-pink-500`, `text-pink-50` |

## Implementation

### Component Location

- **File**: `src/components/ScoreWidgets.tsx`
- **Used in**: `src/pages/HomePage.tsx` (below greeting, before program info)

### Component Code

```typescript
export function ScoreWidgets() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <Card key={i} className="flex-1 min-w-0">
            <CardContent className="p-3 flex items-center justify-center h-[88px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!rewards) return null

  return (
    <div className="flex gap-2">
      <ScoreCard
        title="Mental Fitness"
        score={rewards.mentalFitnessScore}
        icon={<Brain className="h-5 w-5 text-primary-foreground" />}
        color="bg-primary"
      />
      <ScoreCard
        title="Pers. Doelen"
        score={rewards.personalGoalsScore}
        icon={<Target className="h-5 w-5 text-orange-50" />}
        color="bg-orange-500"
      />
      <ScoreCard
        title="Gewoontes"
        score={rewards.goodHabitsScore}
        icon={<Heart className="h-5 w-5 text-pink-50" />}
        color="bg-pink-500"
      />
    </div>
  )
}
```

### Usage in HomePage

```typescript
<ScoreWidgets />
```

Positioned after the greeting and before the program information section.

## Data Source

Scores are fetched from `/api/rewards` endpoint via `useUserRewards()` hook.

### Score Calculation (Airtable Formulas)

Each score is calculated by an Airtable formula field:

#### Mental Fitness Score
- **Field**: `mentalFitnessScore` (fldMTUjMC2vcY0HWA)
- **Formula**: `(# completed methods × 10) + bonusPoints`
- **Includes**: Program methods completed, milestone bonuses

#### Personal Goals Score
- **Field**: `personalGoalsScore` (fldVDpa3GOFSWTYly)
- **Formula**: `# personal goal completions × 10`
- **Includes**: All personal goal completion records

#### Good Habits Score
- **Field**: `goodHabitsScore` (fldpW5r0j9aHREqaK)
- **Formula**: `# habit completions × 5`
- **Includes**: All habit completion records from "Goede gewoontes" goal

### API Response

```json
{
  "success": true,
  "data": {
    "totalPoints": 225,
    "mentalFitnessScore": 150,
    "personalGoalsScore": 30,
    "goodHabitsScore": 45,
    "currentStreak": 5,
    "longestStreak": 12,
    "badges": ["eerste_sessie", "week_streak"],
    "level": 3
  }
}
```

## Responsive Behavior

### Mobile (Default)
- 3 widgets in a horizontal row
- `flex gap-2` for spacing
- `flex-1 min-w-0` for equal width and text truncation
- Compact padding (`p-3`)

### Loading State
- Shows 3 skeleton cards with spinners
- Same height as loaded state (88px)
- Prevents layout shift

### No Data State
- Returns `null` (no widgets shown)
- Gracefully handles missing rewards data

## Typography

- **Label**: `text-[10px] text-muted-foreground truncate`
- **Score**: `text-lg font-bold`
- **Icon size**: `h-5 w-5` (20px)
- **Icon container**: `w-10 h-10 rounded-xl` (40px circular background)

## Related Components

- **PointsDisplay**: Header component showing streak only (🔥12)
- **RewardsSummary**: Account page showing detailed rewards breakdown
- **PersonalGoalsSection**: Full personal goals interaction component
- **GoodHabitsSection**: Full habits tracking component

## Why Split Scores?

The decision to split scores into three widgets was made to:

1. **Clarity** - Users can see exactly where their points come from
2. **Motivation** - Encourages balanced participation across all features
3. **Transparency** - Makes the gamification system more understandable
4. **Focus** - Users can identify which areas need more attention

Previously, only a total points display was shown in the header, which didn't provide enough detail.

## Future Enhancements

Potential improvements:
- Tap to see breakdown/history for each score type
- Animated number changes when scores update
- Progress indicators showing daily/weekly goals
- Color-coded progress states (behind, on track, ahead)
