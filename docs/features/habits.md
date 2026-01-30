# Good Habits (Goede Gewoontes)

Good Habits is a daily tracking feature for mental fitness habits that users want to build into their routine, independent of scheduled programs.

## Overview

Habits are methods linked to the "Goede gewoontes" goal in Airtable. Users can check off habits each day to track their consistency and earn points.

## How It Works

### 1. Habit Discovery

Methods are considered habits if they're linked to the "Goede gewoontes" goal:

```typescript
// api/methods/habits.ts
const goalRecords = await base(tables.goals)
  .select({
    filterByFormula: `{Doelstelling Naam} = "Goede gewoontes"`,
    maxRecords: 1
  })
  .firstPage()

const goodHabitsGoalId = goalRecords[0].id

// Filter methods linked to this goal
const habits = methodRecords.filter(record => {
  const linkedGoals = record.fields[METHOD_FIELDS.linkedGoals]
  return linkedGoals?.includes(goodHabitsGoalId)
})
```

### 2. Daily Tracking

Users can mark habits as completed for the current day:

```
┌─────────────────────────────────────────┐
│  Goede Gewoontes                        │
│                                         │
│  ☑ Dankbaarheid      [5 pts]           │
│  ☐ Mindful moment                       │
│  ☑ Beweging          [5 pts]           │
│  ☐ Journaling                           │
│                                         │
│  Punten vandaag: 10                     │
└─────────────────────────────────────────┘
```

### 3. Data Storage

Habit completions are stored in the `Gewoontegebruik` (Habit Usage) table:

| Field | Type | Description |
|-------|------|-------------|
| Gebruikers | Link | User who completed |
| Methodes | Link | The habit (method) |
| Datum | Date | Completion date (YYYY-MM-DD) |

## API Endpoints

### GET /api/methods/habits

Returns all habits (methods linked to "Goede gewoontes").

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXXX",
      "name": "Dankbaarheid",
      "description": "Schrijf 3 dingen waar je dankbaar voor bent"
    },
    {
      "id": "recYYY",
      "name": "Mindful moment",
      "description": "5 minuten mindfulness oefening"
    }
  ]
}
```

### GET /api/habit-usage

Get completed habits for a specific date.

**Query Parameters:**
- `userId` - User record ID
- `date` - Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": ["recXXX", "recYYY"]
}
```

Returns an array of method IDs that were completed.

### POST /api/habit-usage

Mark a habit as completed.

**Request Body:**
```json
{
  "userId": "recUser",
  "methodId": "recMethod",
  "date": "2024-06-20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recUsageId",
    "pointsAwarded": 5
  }
}
```

**Idempotent:** If the habit is already completed for that date, returns success without creating a duplicate.

### DELETE /api/habit-usage

Uncheck a habit (remove completion).

**Query Parameters:**
- `userId` - User record ID
- `methodId` - Method record ID
- `date` - Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": null
}
```

## Points and Rewards

### Points Awarded

- **Per habit completion:** 5 points

The points are automatically counted by an Airtable formula in the User table:
```
(5 x habit usage count) + (10 x method usage count) + {Bonus Punten}
```

### Streak Tracking

Completing habits contributes to the user's daily streak:

1. When a habit is completed, `lastActiveDate` is updated
2. If completing on consecutive days, `currentStreak` increments
3. If there's a gap, `currentStreak` resets to 1
4. `longestStreak` tracks the best streak achieved

```typescript
// Streak calculation in habit-usage endpoint
const today = body.date
const lastActive = currentRewards.lastActiveDate
let newStreak = currentRewards.currentStreak

if (lastActive !== today) {
  const diffDays = /* days between lastActive and today */

  if (diffDays === 1) {
    // Consecutive day - increment
    newStreak = currentRewards.currentStreak + 1
  } else if (diffDays > 1) {
    // Gap - reset
    newStreak = 1
  }
}
```

### Badges

Habit-related badges:

| Badge ID | Name | Requirement |
|----------|------|-------------|
| goede_start | Goede Start | Complete first habit |
| dagelijkse_held | Dagelijkse Held | Complete all habits in one day |
| week_gewoontes | Gewoonte Guru | 7 days with all habits completed |

## Frontend Implementation

### Habits Component

```tsx
function GoodHabits() {
  const { data: habits } = useHabits()
  const { data: completedIds } = useHabitUsage(userId, today)

  const handleToggle = async (habitId: string) => {
    const isCompleted = completedIds?.includes(habitId)

    if (isCompleted) {
      await deleteHabitUsage(userId, habitId, today)
    } else {
      await createHabitUsage(userId, habitId, today)
    }

    // Invalidate queries to refresh UI
    queryClient.invalidateQueries(queryKeys.habitUsage(userId, today))
    queryClient.invalidateQueries(queryKeys.rewards)
  }

  return (
    <div>
      {habits?.map(habit => (
        <HabitItem
          key={habit.id}
          habit={habit}
          isCompleted={completedIds?.includes(habit.id)}
          onToggle={() => handleToggle(habit.id)}
        />
      ))}
    </div>
  )
}
```

### Visual Design

Habits are displayed with:
- Checkbox for completion status
- Habit name
- Expandable description
- Points indicator (when completed)

## Airtable Configuration

### Adding a New Habit

1. Go to the **Methodes** table
2. Create a new method record
3. Fill in name and description
4. In **Doelstellingen** field, link to "Goede gewoontes"
5. The method will now appear as a habit in the app

### "Goede gewoontes" Goal

This goal must exist in the **Doelstellingen** table:

| Field | Value |
|-------|-------|
| Doelstelling Naam | Goede gewoontes |
| Beschrijving | Daily habits for mental wellness |
| Status | Actief |

## Authorization

- Users can only view/modify their own habit completions
- Token user ID is verified against request user ID
- Invalid record ID formats are rejected

```typescript
// Verify ownership
if (body.userId !== tokenUserId) {
  return sendError(res, "Cannot create habit usage for another user", 403)
}

// Validate ID format
if (!isValidRecordId(body.userId) || !isValidRecordId(body.methodId)) {
  return sendError(res, "Invalid ID format", 400)
}
```

## Best Practices

### For Users

1. Set a daily reminder to check habits
2. Start with 2-3 habits, don't overload
3. Check habits at a consistent time
4. Use the streak feature for motivation

### For Administrators

1. Keep habit descriptions concise but clear
2. Limit total habits to prevent overwhelm (5-7 max recommended)
3. Group related habits in the description
4. Review habit completion rates to identify popular/unpopular habits

## Troubleshooting

### Habit Not Appearing

Check that the method is:
1. Linked to "Goede gewoontes" goal
2. Not filtered out by any view settings

### Points Not Updating

Points are calculated by Airtable formula. If points seem stuck:
1. Check the formula in `Totaal Punten` field
2. Verify `Gewoontegebruik` records are being created
3. Try the cache invalidation endpoint

### Checkmark Not Saving

Verify:
1. Network connectivity
2. Valid authentication token
3. Correct date format (YYYY-MM-DD)
4. User ID matches authenticated user
