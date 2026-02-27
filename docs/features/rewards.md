# Rewards & Gamification System

The rewards system motivates users through points, levels, badges, streaks, and milestones.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Rewards System                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Points    │  │   Levels    │  │   Badges    │            │
│  │  (Activity) │  │ (Thresholds)│  │(Achievements)│            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐          │
│  │              Streaks (Daily Activity)            │          │
│  └─────────────────────────────────────────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐          │
│  │         Milestones (Program Progress)           │          │
│  └─────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Points

### Point Values

| Activity | Points |
|-|-|
| Complete a method | Variable (1-10, from Airtable "Punten waarde" field) |
| Complete a habit | 5 |
| Complete a personal goal | 5 |
| Complete an overtuiging | 1 |
| 7-day streak | 25 |
| 21-day streak | 75 |
| Complete program | 100 |

### Points Calculation

Total points are calculated from Postgres counts:

```
totalPoints = sum(method points) + (personalGoalCount * 5) + (habitCount * 5) + bonusPoints
```

- **Method points:** Variable per method (1-10), summed from `method_usage_pg` joined with method's `pointsValue`
- **Habit/Personal Goal points:** Fixed per completion (5 each)
- **Overtuiging points:** 1 point per completion
- **Bonus points:** Streak bonuses stored in user's `bonusPoints` field

### Split Scores

The system calculates three separate scores displayed as widgets on the home page:

#### Mental Fitness Score
```
mentalFitnessScore = sum(method pointsValues) + bonusPoints
```
Includes program methods (variable points per method) and streak bonuses.

#### Personal Goals Score
```
personalGoalsScore = # personal goal completions × 5
```
Tracks user-defined custom goals.

#### Good Habits Score
```
goodHabitsScore = # habit completions × 5
```
Daily habits from "Goede gewoontes" goal.

## Levels

Users progress through 10 levels based on total points:

| Level | Title | Points Required |
|-|-|-|
| 1 | Beginner | 0 |
| 2 | Ontdekker | 50 |
| 3 | Beoefenaar | 125 |
| 4 | Doorzetter | 250 |
| 5 | Gevorderde | 400 |
| 6 | Expert | 600 |
| 7 | Kampioen | 850 |
| 8 | Meester | 1,150 |
| 9 | Legende | 1,500 |
| 10 | Mentale Atleet | 2,000 |

### Level Calculation

```typescript
function calculateLevel(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) {
      return LEVELS[i].level
    }
  }
  return 1
}
```

### Level Up

When a user crosses a level threshold:
1. `levelUp: true` in reward response
2. Frontend can show celebration animation
3. User's `Niveau` field updated in Airtable

## Badges

Badges are awarded for specific achievements.

### Badge Categories

Badges are organized in 3 tiers of difficulty.

#### Tier 1: Eerste Stappen

| Badge ID | Name | Description |
|-|-|-|
| eerste_sessie | Eerste Sessie | Voltooi je eerste methode |
| eerste_streak | Eerste Streak | 3 opeenvolgende sessies op tijd |
| eerste_week | Eerste Week | Alle sessies voltooid in week 1 |
| goede_start | Goede Start | Log je eerste gewoonte of persoonlijk doel |

#### Tier 2: Consistentie

| Badge ID | Name | Description |
|-|-|-|
| op_dreef | Op Dreef | 21 opeenvolgende sessies op tijd |
| tweede_programma | Tweede Programma | Start een 2e programma |
| drie_maanden | Drie Maanden | 3 maanden actief |
| veelzijdig | Veelzijdig | Methode + gewoonte + doel in een week |

#### Tier 3: Mentale Atleet

| Badge ID | Name | Description |
|-|-|-|
| programma_voltooid | Programma Voltooid | Rond een volledig programma af |
| zes_maanden | Zes Maanden | 6 maanden actief |
| jaar_actief | Jaar Actief | 12 maanden actief |
| mentale_atleet | Mentale Atleet | Bereik niveau 8 |

### Badge Storage

Badges are stored as a JSON array in the user's `Badges` field:

```json
["eerste_sessie", "vijf_methodes", "week_streak"]
```

### Badge Checking

```typescript
function checkNewBadges(existingBadges: string[], stats: Stats): string[] {
  const newBadges: string[] = []

  for (const [badgeId, badge] of Object.entries(BADGE_CHECKS)) {
    if (!existingBadges.includes(badgeId) && badge.check(stats)) {
      newBadges.push(badgeId)
    }
  }

  return newBadges
}
```

## Streaks

Streaks track consecutive days of activity.

### Streak Calculation

```typescript
function calculateStreak(lastActiveDate: string | null, today: string) {
  if (!lastActiveDate) {
    return { currentStreak: 1, isNewDay: true }
  }

  const diffDays = /* days between dates */

  if (diffDays === 0) {
    // Same day - no change
    return { currentStreak: -1, isNewDay: false }
  } else if (diffDays === 1) {
    // Consecutive - increment
    return { currentStreak: 1, isNewDay: true } // +1
  } else {
    // Gap - reset
    return { currentStreak: 1, isNewDay: true } // reset to 1
  }
}
```

### Streak Fields

| Field | Description |
|-------|-------------|
| Huidige Streak | Current consecutive days |
| Langste Streak | Best streak achieved |
| Laatste Actieve Dag | Last day with activity |

### Streak Bonuses

- **7-day streak:** 25 bonus points
- **21-day streak:** 75 bonus points

Bonuses are only awarded once when first reaching the milestone.

## Milestones

Program milestones mark significant progress.

### Milestone Thresholds

| Milestone | Progress | Points |
|-----------|----------|--------|
| 25% | Quarter complete | 25 |
| 50% | Halfway | 50 |
| 75% | Three quarters | 75 |
| 100% | Complete | 100 |

### Milestone Tracking

Each program tracks awarded milestones in `milestonesAwarded`:

```json
["25", "50"]  // 25% and 50% milestones awarded
```

### Milestone Detection

```typescript
// Check if milestone should be awarded
const progress = (completedMethods / totalMethods) * 100
const milestonesToCheck = [25, 50, 75, 100]

for (const milestone of milestonesToCheck) {
  if (progress >= milestone && !program.milestonesAwarded.includes(milestone)) {
    // Award milestone
    await awardMilestone(programId, milestone)
  }
}
```

## API Endpoints

### GET /api/rewards

Get current user's reward data.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPoints": 450,
    "bonusPoints": 75,
    "currentStreak": 12,
    "longestStreak": 14,
    "lastActiveDate": "2024-06-20",
    "badges": ["eerste_sessie", "vijf_methodes", "week_streak"],
    "level": 4
  }
}
```

### POST /api/rewards/award

Award points for an activity.

**Request Body:**
```json
{
  "activityType": "method",
  "activityId": "recXXX",
  "methodsCompleted": 15,
  "habitsCompleted": 5,
  "habitDaysCompleted": 3,
  "programsCompleted": 0,
  "programId": "recProgram",
  "milestone": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pointsAwarded": 50,
    "newTotal": 500,
    "newBadges": ["half_programma"],
    "levelUp": false,
    "newLevel": 4,
    "currentStreak": 13,
    "longestStreak": 14,
    "milestone": 50
  }
}
```

## Airtable Schema

### User Reward Fields

| Field ID | Dutch Name | Type | Description |
|----------|------------|------|-------------|
| fldRcrVTHrvSUe1Mh | Totaal Punten | Formula | Auto-calculated total points |
| fldnTqsjBrzV37WPG | Bonus Punten | Number | Milestone/streak bonus |
| fldDsfIZH929xN30H | Huidige Streak | Number | Current consecutive days |
| fldUI14lfcoJAI329 | Langste Streak | Number | Best streak |
| fldwl4wC7pT4hKZVN | Laatste Actieve Dag | Date | Last activity date |
| fldMbIUw4uzjNKYy9 | Badges | Long text | JSON array of badge IDs |
| fldBp9BHyhbiGxK8V | Niveau | Number | Current level |
| fldMTUjMC2vcY0HWA | Mental Fitness Score | Formula | Methods × 10 + bonusPoints |
| fldVDpa3GOFSWTYly | Persoonlijke Doelen Score | Formula | Personal goals × 10 |
| fldpW5r0j9aHREqaK | Goede Gewoontes Score | Formula | Habits × 5 |

### Program Milestone Field

| Field ID | Dutch Name | Type |
|----------|------------|------|
| fldQu0mHYeNj4mury | Behaalde Mijlpalen | Long text (JSON) |

## Frontend Components

### ScoreWidgets

Displays three split scores on home page:
- Mental Fitness Score (brain icon, blue)
- Personal Goals Score (target icon, orange)
- Good Habits Score (heart icon, pink)

See: `docs/features/score-widgets.md`

### PointsDisplay

Header component showing streak only (🔥):
- Compact pill design
- Only visible if streak > 0
- Removed total points display

See: `docs/features/header-points-display.md`

### RewardsSummary

Displays overview on account page:
- All three split scores
- Current level with progress bar
- Current streak with flame icon
- Badge count

### BadgeGrid

Displays all badges:
- Earned badges highlighted
- Unearned badges grayed out
- Badge name and description on hover/tap

### LevelProgress

Shows progress to next level:
- Current level title
- Points needed for next level
- Visual progress bar

### MilestoneProgress

Shows program milestone progress:
- Progress bar with milestone markers
- Achieved milestones checked
- Points earned from milestones

### StreakDisplay

Shows streak information:
- Current streak count
- Flame animation for active streaks
- Streak milestone indicators

## Notifications

The frontend can show notifications for:

1. **Level Up**
   ```typescript
   if (response.levelUp) {
     showNotification(`Level Up! Je bent nu ${getLevelTitle(response.newLevel)}`)
   }
   ```

2. **New Badges**
   ```typescript
   if (response.newBadges.length > 0) {
     response.newBadges.forEach(badgeId => {
       showBadgeNotification(BADGES[badgeId])
     })
   }
   ```

3. **Milestones**
   ```typescript
   if (response.milestone) {
     showMilestoneNotification(response.milestone)
   }
   ```

## Configuration

### Adding New Badges

1. Add badge definition to `src/types/rewards.ts`:
   ```typescript
   export const BADGES = {
     // ...existing badges
     new_badge: {
       id: "new_badge",
       name: "Badge Name",
       description: "How to earn",
       icon: "icon-name"
     }
   }
   ```

2. Add check logic to `api/rewards/award.ts`:
   ```typescript
   const BADGE_CHECKS = {
     // ...existing checks
     new_badge: { check: (stats) => stats.someMetric >= threshold }
   }
   ```

### Adjusting Point Values

Modify `POINTS` constant in both:
- `src/types/rewards.ts` (frontend display)
- `api/rewards/award.ts` (backend logic)

### Changing Levels

Modify `LEVELS` constant in both locations to adjust thresholds or titles.

## Best Practices

### For Engagement

1. Show progress immediately after actions
2. Use animations for rewards (confetti for level up)
3. Display "almost there" messages near thresholds
4. Send push notifications for streak reminders

### For Balance

1. Don't make points too easy (devalues achievement)
2. Ensure early levels are achievable quickly
3. Space milestone rewards to maintain motivation
4. Balance streak rewards to not punish missed days too harshly
