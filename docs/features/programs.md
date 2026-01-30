# Mental Fitness Programs

Programs are the core feature of the Mental Fitness App. A program is a personalized schedule of mental fitness methods over a defined period.

## Program Structure

A program consists of:

- **Duration:** Number of weeks (e.g., "4 weken", "8 weken")
- **Start/End Dates:** Defines the active period
- **Days of Week:** Which days the user will practice (e.g., Monday, Wednesday, Friday)
- **Goals:** What the user wants to achieve (e.g., Stress reduction, Better sleep)
- **Methods:** Mental fitness techniques assigned to the program
- **Schedule:** Day-by-day plan with specific methods (Programmaplanning)

## Program Status

A program has one of three statuses based on dates:

```typescript
type ProgramStatus = "planned" | "running" | "finished"

function getProgramStatus(program: Program): ProgramStatus {
  const today = new Date()
  const start = new Date(program.startDate)
  const end = new Date(program.endDate)

  if (today < start) return "planned"
  if (today > end) return "finished"
  return "running"
}
```

## Creating Programs

### Method 1: AI-Generated Program (Recommended)

The app uses GPT-4o to generate personalized programs:

1. **Preview Step** (`POST /api/programs/preview`)
   - User selects goals, start date, duration, days
   - AI generates a suggested schedule
   - User can edit the schedule

2. **Confirm Step** (`POST /api/programs/confirm`)
   - Save the edited schedule to Airtable
   - Create Programmaplanning records

### AI Generation Flow

```
┌─────────────┐
│  User Input │
│  - Goals    │
│  - Duration │
│  - Days     │
└─────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Fetch Context from Airtable        │
│  - Methods (with frequency, level)  │
│  - Goals (with descriptions)        │
│  - Program Prompts (instructions)   │
│  - Experience Levels                │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Build System Prompt                │
│  - Goal-specific instructions       │
│  - Method selection rules           │
│  - Frequency rules                  │
│  - Training dates list              │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  OpenAI GPT-4o                      │
│  (Structured Outputs)               │
│                                     │
│  Returns:                           │
│  - Schedule (date, methods)         │
│  - Weekly session time              │
│  - Recommendations                  │
│  - Program summary                  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  User Edits (Optional)              │
│  - Swap methods                     │
│  - Adjust durations                 │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Save to Airtable                   │
│  - Program record                   │
│  - Programmaplanning records        │
└─────────────────────────────────────┘
```

### AI Response Schema

```typescript
interface AIProgramResponse {
  schedule: {
    date: string           // YYYY-MM-DD
    dayOfWeek: string      // Dutch day name
    dayId: string          // Airtable record ID
    methods: {
      methodId: string
      methodName: string
      duration: number
    }[]
  }[]
  weeklySessionTime: number
  recommendations: string[]  // 3-5 tips in Dutch
  programSummary: string     // Brief summary in Dutch
}
```

### Method 2: Manual Creation

Create a program directly without AI:

```typescript
const response = await fetch("/api/programs", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "recXXX",
    startDate: "2024-06-01",
    duration: "4 weken",
    daysOfWeek: ["recMon", "recWed", "recFri"],
    goals: ["recGoal1"],
    methods: ["recMethod1", "recMethod2"]
  })
})
```

## Program Schedule (Programmaplanning)

Each training day has a Programmaplanning record linking:
- The program
- The date
- The day of week
- The methods to practice
- Method usage records (completed methods)

### Programmaplanning Fields

| Field | Type | Description |
|-------|------|-------------|
| Planning ID | Text | Human-readable identifier |
| Mentale Fitnessprogramma | Link | Parent program |
| Datum | Date | Training date |
| Dag van de week | Link | Day record |
| Beoogde methodes | Link | Methods for this day |
| Methodegebruik | Link | Completed method records |
| Beschrijving van sessie(s) | Text | AI-generated description |
| Opmerkingen | Text | User notes |

## Progress Tracking

Progress is calculated based on completed methods:

```typescript
function getSessionProgress(programDetail: ProgramDetail): number {
  const { totalMethods, completedMethods } = programDetail

  if (totalMethods === 0) return 0

  const progress = Math.round((completedMethods / totalMethods) * 100)
  return Math.min(progress, 100)
}
```

### Progress Calculation

1. **Total Methods:** Sum of methods across all Programmaplanning records
2. **Completed Methods:** Count of Method Usage records linked to Programmaplanning

Example:
- Program has 12 training days
- Each day has 2 methods
- Total methods = 24
- User completed 12 methods
- Progress = 50%

## Method Completion

When a user completes a method:

1. **Frontend calls** `POST /api/method-usage`
2. **API creates** Method Usage record in Airtable
3. **API updates** Programmaplanning link
4. **API awards** points via rewards system
5. **Frontend updates** UI state via TanStack Query invalidation

```typescript
// Method completion request
{
  userId: "recUser",
  methodId: "recMethod",
  programmaplanningId: "recPlanning",
  date: "2024-06-03",
  remark: "Great session!"
}
```

## Milestones

Programs have milestone achievements at 25%, 50%, 75%, and 100% completion:

```typescript
const MILESTONE_POINTS = {
  25: 25,   // Kwart klaar
  50: 50,   // Halverwege
  75: 75,   // Bijna daar
  100: 100  // Afgerond
}
```

Milestones are:
- Automatically detected when progress crosses thresholds
- Awarded only once per program (tracked in `milestonesAwarded`)
- Trigger bonus points and badges

## Frontend Components

### ProgramCard

Displays program summary on the programs list:
- Progress bar
- Status badge (Actief, Gepland, Afgerond)
- Next scheduled day

### ProgramDetailPage

Shows full program details:
- Overview (dates, duration, frequency)
- Milestone progress component
- Schedule with day names
- Goals list
- Methods list (clickable to method detail)
- Recent activities

### MilestoneProgress

Visual component showing:
- Progress bar with milestone markers
- Achieved milestones with badges
- Points earned

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/programs` | GET | List user's programs |
| `/api/programs` | POST | Create program manually |
| `/api/programs/:id` | GET | Get program details |
| `/api/programs/:id` | PATCH | Update program |
| `/api/programs/:id` | DELETE | Delete program |
| `/api/programs/:id/methods` | GET | Get methods for a date |
| `/api/programs/preview` | POST | AI program preview |
| `/api/programs/confirm` | POST | Save AI program |
| `/api/programs/generate` | POST | Generate + save directly |

## Airtable Schema

### Program Table (Mentale Fitnessprogramma's)

```
├── ID (AutoNumber)
├── Programma ID (Formula - display name)
├── Gebruiker (Link to Users)
├── Startdatum (Date)
├── Duur van programma (Single select)
├── Einddatum Programma (Formula)
├── Dagen van de week (Link to Days)
├── Frequentie per week (Count)
├── Doelstellingen (Link to Goals)
├── Mentale methode (Link to Methods)
├── Notities (Long text)
├── Methodegebruik (Link to Method Usage)
└── Behaalde Mijlpalen (Long text - JSON array)
```

### Programmaplanning Table

```
├── Planning ID (Text)
├── Mentale Fitnessprogramma (Link to Programs)
├── Datum (Date)
├── Dag van de week (Link to Days)
├── Beoogde methodes (Link to Methods)
├── Doelstelling(en) (Link to Goals)
├── Methodegebruik (Link to Method Usage)
├── Beschrijving van sessie(s) (Long text)
└── Opmerkingen (Long text)
```

## AI Prompts Configuration

The AI uses prompts stored in Airtable (`Programma opbouw prompts` table):

### System Prompts (Type: Systeem)

| Name | Purpose |
|------|---------|
| intro | Introduction and role definition |
| selectie_regels | Method selection rules |
| frequentie_regels | Frequency rules |
| samenstelling_regels | Program composition rules |
| output_formaat | Output format specification |

### Goal Prompts (Type: Programmaopbouw)

Goal-specific instructions linked to goal records. For example:
- "For stress reduction, prioritize breathing exercises..."
- "For better sleep, schedule calming methods in the evening..."

### Method Selection Rules

The AI considers:
1. **Goal relevance** - Methods linked to selected goals have priority
2. **Experience level** - Start with "Beginner" level, progress to "Gevorderd"
3. **Optimal frequency** - Methods marked "Dagelijks", "Wekelijks", etc.
4. **Session duration** - Each session should be 15-30 minutes

## Editing Programs

Users can edit active ("running") and planned programs. The edit functionality includes:

### Editable Fields

1. **Goals** - Which mental fitness goals the program targets
2. **Training Days** - Which days of the week the user will practice
3. **Notes** - Personal notes about the program

### Program Creation Type

Programs track how they were created via the `creationType` field:

```typescript
type ProgramCreationType = "Manueel" | "AI"
```

This determines the regeneration options when schedule changes are needed.

### ProgramEditDialog Component

The edit dialog (`src/components/ProgramEditDialog.tsx`) provides:

- Goal selection with checkboxes
- Day-of-week selection pills (Ma, Di, Wo, Do, Vr, Za, Zo)
- Notes textarea
- Change detection (goals, days, notes)
- Schedule regeneration warnings

## Schedule Regeneration

When a user changes the training days or goals, future sessions need to be regenerated.

### How It Works

```
┌─────────────────────────────────┐
│  User edits program             │
│  - Changes days (e.g., Mon→Tue) │
│  - Or changes goals             │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Dialog shows warning           │
│  "X future sessions will be     │
│   regenerated"                  │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Regeneration Options           │
│  (AI programs only)             │
│  - AI regeneration (recommended)│
│  - Simple redistribution        │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Backend Processing             │
│  1. Preserve past sessions      │
│  2. Delete future sessions      │
│  3. Generate new schedule       │
│  4. Create Programmaplanning    │
└─────────────────────────────────┘
```

### Session Preservation Logic

```typescript
// Past sessions are preserved (date <= today)
const pastSessions = allSessions.filter(s => s.date <= todayStr)

// Future sessions are deleted and regenerated (date > today)
const futureSessions = allSessions.filter(s => s.date > todayStr)
```

This ensures:
- Completed activities (Methodegebruik) are never lost
- Historical data remains intact
- Only future training dates are affected

### Regeneration Methods

#### AI Regeneration (for AI-created programs)

When goals change on an AI-created program, the schedule is regenerated using GPT-4o with edit context:

```typescript
interface EditContext {
  isEdit: boolean
  completedMethods: string[]      // Method IDs already completed
  preservedSessionCount: number   // Number of past sessions kept
}
```

The AI prompt includes:
- Information that this is a program edit, not new creation
- List of completed methods (to avoid excessive repetition)
- Number of preserved sessions (for context)

#### Simple Redistribution

For manual programs or when AI is not needed:
- Existing methods are redistributed evenly across new training dates
- 1-2 methods per session, rotating through available methods

### API Endpoint

```
POST /api/programs/:id/regenerate-schedule

Headers:
  Authorization: Bearer <token>

Body:
{
  "daysOfWeek": ["recMon", "recWed", "recFri"],
  "goals": ["recGoal1", "recGoal2"],        // Optional, if goals changed
  "regenerateMethod": "ai" | "simple",
  "force": false                             // Force delete sessions with completed activities
}

Response:
{
  "success": true,
  "data": {
    "program": { ... },
    "preservedSessions": 5,
    "regeneratedSessions": 8,
    "deletedSessions": 8,
    "newSchedule": [ ... ]
  }
}
```

### Frontend Integration

The ProgramEditDialog tracks changes and shows appropriate UI:

```typescript
// Track if schedule-affecting changes were made
const scheduleChanged = goalsChanged || daysChanged

// Calculate future sessions to show in warning
const futureSessions = program.schedule.filter(s => {
  const sessionDate = new Date(s.date)
  const today = new Date()
  return sessionDate > today
}).length
```

When schedule changes are detected:
1. Warning banner shows number of affected sessions
2. Save button becomes "Wijzigingen bekijken"
3. Confirmation dialog explains consequences
4. AI programs show method choice (AI vs Simple)
5. Manual programs show single "Herberekenen" button

### Conflict Handling

If future sessions have completed activities (Methodegebruik):

```
409 Conflict
"X future session(s) have completed activities. Pass force=true to delete them."
```

The `force` parameter can override this, but the frontend typically warns the user first.

## Session Editing

Individual sessions can also be edited separately from the program.

### SessionEditDialog

Located in `src/components/SessionEditDialog.tsx`, allows:
- Swapping methods for a specific session
- Selecting from all methods in the program

### API Endpoint

```
PATCH /api/programs/:programId/schedule/:planningId

Body:
{
  "methods": ["recMethod1", "recMethod2"]
}
```
