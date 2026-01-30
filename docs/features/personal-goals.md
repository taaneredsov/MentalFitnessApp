# Personal Goals Feature

Users can create custom personal goals to track and get rewarded for activities outside the main program.

## Overview

Personal Goals allow users to define their own objectives (e.g., "Speak up in meetings", "Take a 10-minute walk") and track completions. Each completion awards 10 bonus points and contributes to the Personal Goals score widget.

## Key Features

- ✅ User-created custom goals
- ✅ Unlimited completions per day (track each occurrence)
- ✅ 10 points per completion
- ✅ Separate score widget on home page
- ✅ Total count and today's count tracking
- ✅ Optional description for context
- ✅ Maximum 10 active goals per user
- ✅ Archive functionality (via status field)

## Airtable Schema

### Personal Goals Table

**Table**: Persoonlijke doelen (tblbjDv35B50ZKG9w)

| Field ID | Dutch Name | Type | Description |
|----------|------------|------|-------------|
| fldJgnovQb0fukTHy | Naam | Single line text | Goal name (max 200 chars) |
| fldIa30JSumth6urq | Beschrijving | Long text | Optional description (max 1000 chars) |
| fld430TQiorQDQqfT | Gebruikers | Link to Users | Owner of the goal |
| fldppY7CetkUqYeTU | Status | Single select | "Actief" or "Gearchiveerd" |
| fldVYfcER59IGdFg8 | Aangemaakt op | Created time | Auto-generated timestamp |

### Personal Goal Usage Table

**Table**: Persoonlijk Doelgebruik (tbl8eJeQtMnIF5EJo)

| Field ID | Dutch Name | Type | Description |
|----------|------------|------|-------------|
| fldlSHZh0ECrWMRV9 | Gebruikers | Link to Users | User who completed the goal |
| fldGwiJAk7FRirOqY | Persoonlijke doelen | Link to Personal Goals | The goal that was completed |
| fldC2lY17qPmMsI5x | Datum | Date (YYYY-MM-DD) | Completion date |

**Note**: No unique constraint - allows multiple completions per day.

## API Endpoints

### GET /api/personal-goals

Get all active personal goals for the authenticated user.

**Query Parameters:**
- `userId` (optional) - Defaults to authenticated user

**Request:**
```
GET /api/personal-goals?userId=recXXX
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recGoal1",
      "name": "Speak up in meeting",
      "description": "Share my opinion at least once per meeting",
      "status": "Actief",
      "userId": "recXXX",
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

**Security**: Users can only view their own goals (403 if accessing another user's goals).

### POST /api/personal-goals

Create a new personal goal.

**Request Body:**
```json
{
  "name": "Take a 10-minute walk",
  "description": "During lunch break or between meetings"
}
```

**Validation:**
- `name`: Required, 1-200 characters
- `description`: Optional, max 1000 characters
- Maximum 10 active goals per user

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recNewGoal",
    "name": "Take a 10-minute walk",
    "description": "During lunch break or between meetings",
    "status": "Actief",
    "userId": "recXXX",
    "createdAt": "2026-01-30T14:20:00.000Z"
  }
}
```

**Errors:**
- `400` - Validation error (missing name, too long)
- `400` - Maximum 10 personal goals allowed
- `401` - Unauthorized

### PATCH /api/personal-goals/:id

Update an existing personal goal.

**Request Body:**
```json
{
  "name": "Updated goal name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recGoal1",
    "name": "Updated goal name",
    "description": "Updated description",
    "status": "Actief",
    "userId": "recXXX",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Security**: Users can only update their own goals (403 if not owner).

### DELETE /api/personal-goals/:id

Soft delete (archive) a personal goal by setting status to "Gearchiveerd".

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Personal goal archived"
  }
}
```

**Security**: Users can only delete their own goals (403 if not owner).

### GET /api/personal-goal-usage

Get completion counts for all personal goals.

**Query Parameters:**
- `userId` (optional) - Defaults to authenticated user
- `date` (required) - Date in YYYY-MM-DD format

**Request:**
```
GET /api/personal-goal-usage?userId=recXXX&date=2026-01-30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recGoal1": {
      "today": 3,
      "total": 45
    },
    "recGoal2": {
      "today": 0,
      "total": 12
    }
  }
}
```

**Security**: Users can only view their own usage (403 if accessing another user's data).

### POST /api/personal-goal-usage

Record a goal completion and award points.

**Request Body:**
```json
{
  "userId": "recXXX",
  "personalGoalId": "recGoal1",
  "date": "2026-01-30"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recUsage123",
    "pointsAwarded": 10,
    "todayCount": 4,
    "totalCount": 46
  }
}
```

**Side Effects:**
1. Creates usage record
2. Awards 10 bonus points to user
3. Updates user's streak (if new day)
4. Updates `lastActiveDate`

**Security**: Users can only create completions for their own goals (403 if not owner).

**Errors:**
- `400` - Invalid request body
- `403` - Goal doesn't belong to user
- `404` - Goal not found

## Frontend Components

### PersonalGoalsSection

**File**: `src/components/PersonalGoalsSection.tsx`

Main component displaying all personal goals with completion tracking.

**Features:**
- Display all active goals
- Click to expand/collapse description
- Quick-add button to record completion
- Shows today's count and total count
- Points animation on completion
- Loading states
- Empty state with add button

**Props:**
```typescript
interface PersonalGoalsSectionProps {
  showManageLink?: boolean  // Show settings button (default: true)
}
```

**Usage:**
```tsx
<PersonalGoalsSection />
```

### PersonalGoalDialog

**File**: `src/components/PersonalGoalDialog.tsx`

Dialog for creating or editing personal goals.

**Features:**
- Create new goal
- Edit existing goal
- Form validation
- Character limits (name: 200, description: 1000)
- Loading states
- Error handling

**Props:**
```typescript
interface PersonalGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: PersonalGoal | null  // If provided, edit mode
}
```

**Usage:**
```tsx
const [dialogOpen, setDialogOpen] = useState(false)
const [editingGoal, setEditingGoal] = useState<PersonalGoal | null>(null)

<PersonalGoalDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  goal={editingGoal}
/>
```

### Goal Card UI

Each goal is displayed as an expandable card:

```
┌────────────────────────────────────────────────────────┐
│  🎯  Speak up in meeting                          [+]  │
│  2   3x vandaag · 45 totaal                            │
│                                                         │
│      Share my opinion at least once per meeting        │ (expanded)
└────────────────────────────────────────────────────────┘
```

**Elements:**
- Left: Icon with total count badge
- Center: Goal name and completion counts
- Right: Points animation + quick-add button
- Bottom: Collapsible description

## TypeScript Types

```typescript
// src/types/program.ts

export interface PersonalGoal {
  id: string
  name: string
  description?: string
  status: "Actief" | "Gearchiveerd"
  userId: string
  createdAt: string
}

export interface PersonalGoalUsage {
  id: string
  userId: string
  personalGoalId: string
  date: string  // YYYY-MM-DD
}

export interface PersonalGoalCounts {
  [goalId: string]: {
    today: number
    total: number
  }
}
```

## React Query Hooks

```typescript
// src/hooks/queries.ts

// Fetch all personal goals
export function usePersonalGoals() {
  return useQuery({
    queryKey: queryKeys.personalGoals(),
    queryFn: async () => {
      const response = await apiClient.get("/api/personal-goals")
      return response.data
    }
  })
}

// Fetch completion counts
export function usePersonalGoalUsage(userId: string | undefined, date: string) {
  return useQuery({
    queryKey: queryKeys.personalGoalUsage(userId, date),
    queryFn: async () => {
      const response = await apiClient.get("/api/personal-goal-usage", {
        params: { userId, date }
      })
      return response.data
    },
    enabled: !!userId
  })
}

// Create new goal
export function useCreatePersonalGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ data, accessToken }) => {
      const response = await apiClient.post("/api/personal-goals", data, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalGoals() })
    }
  })
}

// Complete a goal
export function useCompletePersonalGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ data, accessToken }) => {
      const response = await apiClient.post("/api/personal-goal-usage", data, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalGoalUsage() })
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards() })
    }
  })
}
```

## Points & Rewards Integration

### Points Calculation

**Per Completion**: 10 bonus points

```typescript
// api/personal-goal-usage/index.ts
const POINTS = {
  personalGoal: 10
} as const
```

### Score Widget Integration

The Personal Goals Score is calculated by Airtable:

```
personalGoalsScore = COUNT(Persoonlijk Doelgebruik[Gebruiker]) × 10
```

This formula counts all usage records linked to the user and multiplies by 10.

### User Fields Updated

On each completion:
1. **bonusPoints** - Incremented by 10
2. **currentStreak** - Updated if new day
3. **longestStreak** - Updated if new record
4. **lastActiveDate** - Set to completion date

### Streak Logic

```typescript
// If last active date was yesterday: streak++
// If last active date was today: no change
// If last active date was >1 day ago: streak = 1
```

Personal goal completions count as "active days" for streak tracking.

## User Experience Flow

### Creating a Goal

1. User clicks "Add Goal" button
2. Dialog opens with empty form
3. User enters goal name (required)
4. User optionally adds description
5. User clicks "Add"
6. Goal appears in the list immediately (optimistic update)
7. Success message (optional)

### Completing a Goal

1. User sees their goals list
2. User clicks the [+] button on a goal
3. Points animation shows (+10)
4. Today count increments (3x → 4x)
5. Total count increments (45 → 46)
6. Score widget updates
7. Streak updates (if new day)

### Editing a Goal

1. User clicks settings icon on goal card
2. Dialog opens pre-filled with goal data
3. User modifies name or description
4. User clicks "Save"
5. Changes appear immediately
6. No points awarded

### Archiving a Goal

1. User clicks settings icon
2. User clicks "Archive" or "Delete" button
3. Confirmation dialog (optional)
4. Goal disappears from list
5. Historical completions remain in database

## Validation & Limits

### Goal Creation Limits

- **Maximum active goals**: 10 per user
- **Name length**: 1-200 characters
- **Description length**: 0-1000 characters

### Usage Limits

- **Completions per day**: Unlimited
- **Date format**: YYYY-MM-DD required
- **Cannot complete other user's goals**: 403 error

## Security Considerations

### Authentication

All endpoints require JWT bearer token.

### Authorization

- Users can only access their own goals
- Users can only create usage for their own goals
- Goals are filtered by user ID on the backend

### Validation

```typescript
// Verify goal belongs to user
const goalRecord = await base(tables.personalGoals).find(body.personalGoalId)
const goalUserIds = goalRecord.fields["Gebruikers"] as string[] | undefined

if (!goalUserIds?.includes(tokenUserId)) {
  return sendError(res, "Cannot complete another user's personal goal", 403)
}
```

### Input Sanitization

- Goal names are trimmed
- Descriptions are trimmed
- No HTML allowed (stored as plain text)
- Record IDs validated with regex: `/^rec[A-Za-z0-9]{14}$/`

## Performance Considerations

### Caching

- Personal goals: Cached until mutation
- Usage counts: Cached per (userId, date) key
- Rewards: Invalidated on every completion

### Optimistic Updates

The frontend can show immediate feedback:

```typescript
const completeGoalMutation = useCompletePersonalGoal()

const completeGoal = async (goalId: string) => {
  // Show points animation immediately
  setRecentlyCompleted(goalId)

  // Then complete the goal
  completeGoalMutation.mutate({ ... })
}
```

### Database Queries

All counts are calculated by scanning the entire usage table:

```typescript
const allRecords = await base(tables.personalGoalUsage)
  .select({ returnFieldsByFieldId: true })
  .all()

// Then filter and count in JavaScript
```

**Note**: This is acceptable for MVP. For scale, consider aggregation in Airtable or caching counts.

## Testing

### Test Scenarios

1. **Create goal**: Success with valid name
2. **Create without name**: 400 error
3. **Create 11th goal**: 400 error (max limit)
4. **Complete own goal**: Success, points awarded
5. **Complete other's goal**: 403 error
6. **Complete same goal twice**: Both succeed (allowed)
7. **Complete archived goal**: 404 error
8. **View other's goals**: 403 error
9. **Update own goal**: Success
10. **Delete own goal**: Success, archived

### Sample Test Data

```json
{
  "goals": [
    {
      "name": "Speak up in meeting",
      "description": "Share opinion at least once"
    },
    {
      "name": "Take a walk",
      "description": "10 minutes during lunch"
    },
    {
      "name": "Practice breathing exercise"
    }
  ]
}
```

## Future Enhancements

Potential improvements:
- Recurring goals (daily, weekly targets)
- Goal categories or tags
- Sharing goals with team or coach
- Goal streaks (consecutive days)
- Reminders and notifications
- Export goal completion history
- Charts showing progress over time
- Goal templates library
