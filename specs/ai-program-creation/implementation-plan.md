# Implementation Plan: AI-Assisted Program Creation Flow

## Overview

Build an AI-powered program creation wizard that uses OpenAI GPT-4o to generate personalized mental fitness programs with methods assigned to specific days.

## Phase 1: Backend Infrastructure

Set up OpenAI integration and create the API endpoint.

### Tasks

- [x] Install openai npm package
- [x] Add field mappings for Program Prompts table (tblHmI6cSujof3KHu)
- [x] Create OpenAI utility module (api/_lib/openai.ts)
- [x] Create POST /api/programs/generate endpoint

### Technical Details

**Install package:**
```bash
npm install openai
```

**Field mappings (api/_lib/field-mappings.js):**
```javascript
// Add to TABLES object:
programPrompts: "tblHmI6cSujof3KHu"

// Add new field mappings (get actual IDs from Airtable):
export const PROGRAM_PROMPT_FIELDS = {
  name: "fldXXX",
  prompt: "fldXXX",
  goals: "fldXXX"  // Linked to Goals table
}

export function transformProgramPrompt(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[PROGRAM_PROMPT_FIELDS.name],
    prompt: fields[PROGRAM_PROMPT_FIELDS.prompt],
    goals: fields[PROGRAM_PROMPT_FIELDS.goals] || []
  }
}
```

**OpenAI utility (api/_lib/openai.ts):**
```typescript
import OpenAI from "openai"

let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required")
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export interface AIScheduleDay {
  dayId: string
  dayName: string
  methods: Array<{
    methodId: string
    methodName: string
    duration: number
    order: number
  }>
}

export interface AIProgramResponse {
  schedule: AIScheduleDay[]
  totalSessionTime: number
  weeklySessionTime: number
  recommendations: string[]
  notes?: string
}
```

**API Endpoint (api/programs/generate.ts):**
- POST handler with JWT verification
- Request body: { userId, goals[], startDate, duration, daysOfWeek[] }
- Fetch prompts from programPrompts table filtered by selected goals
- Fetch all methods with details
- Fetch selected days names
- Build system prompt with:
  - Goal descriptions
  - Prompt instructions per goal
  - Available methods list with IDs, names, durations
  - Selected days with IDs and names
  - Rules for distribution (15-30 min/session, vary methods, etc.)
  - JSON output schema
- Call GPT-4o with response_format: { type: "json_object" }
- Parse and validate response
- Extract unique method IDs from schedule
- Create program in Airtable
- Return { program, aiSchedule, totalSessionTime, weeklySessionTime, recommendations }

---

## Phase 2: Frontend Components

Create the AI Program Wizard UI components.

### Tasks

- [x] Create types file (src/components/AIProgramWizard/types.ts)
- [x] Create GeneratingAnimation component
- [x] Create AIInputForm component
- [x] Create ProgramResult component
- [x] Create main AIProgramWizard component
- [x] Add CSS animation keyframes

### Technical Details

**Types (src/components/AIProgramWizard/types.ts):**
```typescript
import type { Goal, Day } from "@/types/program"

export interface AIWizardState {
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
  isGenerating: boolean
  error: string | null
}

export const DURATION_OPTIONS = [
  { value: "1 week", label: "1 week" },
  { value: "2 weken", label: "2 weken" },
  { value: "3 weken", label: "3 weken" },
  { value: "4 weken", label: "4 weken" },
  { value: "6 weken", label: "6 weken" },
  { value: "8 weken", label: "8 weken" }
]

export const LOADING_MESSAGES = [
  "We analyseren je doelen...",
  "We selecteren de beste methodes...",
  "We stellen je schema samen...",
  "We optimaliseren je programma...",
  "Bijna klaar..."
]
```

**GeneratingAnimation (src/components/AIProgramWizard/GeneratingAnimation.tsx):**
- Brain icon (lucide-react) with pulse animation
- Orbiting smaller icons (Sparkles, Target, Calendar) with bounce
- Main message: "We zijn bezig uw mentale fitness programma samen te stellen"
- Cycling sub-messages from LOADING_MESSAGES (3 second intervals)
- Animated progress bar

**AIInputForm (src/components/AIProgramWizard/AIInputForm.tsx):**
- Goals section: checkboxes from useGoals() with name and description
- Date input: type="date" with min=today
- Duration: select dropdown with DURATION_OPTIONS
- Days: grid of 7 buttons (Ma-Zo) with toggle selection
- Generate button: disabled until all required fields filled
- Props: state, updateState, goalsData, daysData, isLoading, onGenerate

**ProgramResult (src/components/AIProgramWizard/ProgramResult.tsx):**
- Success header with CheckCircle2 icon
- Summary card: start date, weekly time, duration
- Weekly schedule: sorted days with methods list per day
- Recommendations section with Lightbulb icon
- Action buttons: "Bekijk Programma" (primary) and "Nieuw Programma" (outline)

**Main Wizard (src/components/AIProgramWizard/index.tsx):**
- Phase state: "input" | "generating" | "result" | "error"
- Uses useGoals() and useDays() hooks for data
- Handles generate flow with api.programs.generate()
- Invalidates React Query cache on success
- Error phase shows retry and cancel buttons

**CSS animations (src/index.css):**
```css
@keyframes progress {
  0% { width: 0%; }
  50% { width: 80%; }
  100% { width: 95%; }
}
```

---

## Phase 3: Integration

Connect frontend to backend and integrate into app.

### Tasks

- [x] Add generate method to api-client.ts
- [x] Add AI types to src/types/program.ts
- [x] Add useGenerateAIProgram mutation hook (optional)
- [x] Update ProgramsPage with wizard type selection

### Technical Details

**API Client (src/lib/api-client.ts):**
```typescript
// Add to programs object:
generate: (data: AIGenerateRequest, accessToken: string) =>
  request<AIGenerateResponse>("/programs/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(data)
  })
```

**Types (src/types/program.ts):**
```typescript
export interface AIGenerateRequest {
  userId: string
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
}

export interface AIScheduleDay {
  dayId: string
  dayName: string
  methods: Array<{
    methodId: string
    methodName: string
    duration: number
    order: number
  }>
}

export interface AIGenerateResponse {
  program: Program
  aiSchedule: AIScheduleDay[]
  totalSessionTime: number
  weeklySessionTime: number
  recommendations: string[]
}
```

**ProgramsPage (src/pages/ProgramsPage.tsx):**
```typescript
// Add state:
const [wizardType, setWizardType] = useState<"manual" | "ai" | null>(null)

// In Dialog content, before wizard:
{!wizardType ? (
  <div className="space-y-4 py-4">
    <p className="text-center text-muted-foreground">
      Hoe wil je je programma samenstellen?
    </p>
    <Button onClick={() => setWizardType("ai")} className="w-full" size="lg">
      <Sparkles className="mr-2 h-5 w-5" />
      AI Programma (Aanbevolen)
    </Button>
    <Button onClick={() => setWizardType("manual")} variant="outline" className="w-full">
      Handmatig Samenstellen
    </Button>
  </div>
) : wizardType === "ai" ? (
  <AIProgramWizard
    onComplete={handleWizardComplete}
    onCancel={() => setWizardType(null)}
  />
) : (
  <ProgramWizard
    mode="create"
    onComplete={handleWizardComplete}
    onCancel={() => setWizardType(null)}
  />
)}

// Reset wizardType when dialog closes:
onOpenChange={(open) => {
  setShowWizard(open)
  if (!open) setWizardType(null)
}}
```

---

## Phase 4: Environment Configuration

### Tasks

- [x] Update .env.example with OPENAI_API_KEY
- [x] Add OPENAI_API_KEY to Vercel environment variables [manual]

### Technical Details

**.env.example:**
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
```

---

## Phase 5: Enhanced AI Generation with Structured Outputs & Programmaplanning (IMPLEMENTED)

Enhanced the AI program generation to use OpenAI's Structured Outputs feature, incorporate method frequency data ("Optimale frequentie"), and create detailed sub-schedules in the Programmaplanning table.

### Key Changes

| Before | After |
|--------|-------|
| Basic `json_object` response format | Structured Outputs with JSON Schema |
| Methods without frequency info | Include "Optimale frequentie" field |
| Weekly template schedule | Specific dates for each training day |
| Schedule not persisted | Store in Programmaplanning table |

### Tasks Completed

- [x] Add `programmaplanning` to TABLES in field-mappings.js
- [x] Add `optimalFrequency` to METHOD_FIELDS
- [x] Add PROGRAMMAPLANNING_FIELDS constant
- [x] Update `transformMethod()` to include optimalFrequency
- [x] Add `transformProgrammaplanning()` function
- [x] Define `AI_PROGRAM_SCHEMA` with strict JSON schema
- [x] Update interfaces for date-based scheduling (TrainingDate, AIMethod)
- [x] Update `buildSystemPrompt()` with frequency rules and training dates
- [x] Add `calculateTrainingDates()` helper function
- [x] Add `createProgramplanningRecords()` for batch creation
- [x] Update OpenAI call to use `AI_PROGRAM_SCHEMA`
- [x] Create Programmaplanning records after program creation
- [x] Update frontend types (AIScheduleDay with date field, Method with optimalFrequency)
- [x] Update ProgramResult.tsx to display date-based schedule with week headers

### Frequency Rules

The AI respects the "Optimale frequentie" field from Methodes:
- "Dagelijks": Schedule on EVERY training day
- "Wekelijks": Schedule 1x per week
- "Meermaals per dag": Can appear multiple times per day
- "Ad-hoc": Flexible placement

### Programmaplanning Table (tbl2PHUaonvs1MYRx)

Records created for each training date:
- `fldTPzVYhmSBxYRa3` - Mentale Fitnessprogramma (link)
- `fldvqnZDdjaVxB25H` - Datum (date)
- `fldxC8uxRqMdS7InU` - Dag van de week (link)
- `fldxQn8r2ySIFs4pg` - Beoogde methodes (link)
- `fld2Xyx6dzgSMR7Yy` - Doelstelling(en) (link)
- `fldnY9fKqbItJVxel` - Beschrijving van sessie(s) (text)

---

## Verification

1. Set OPENAI_API_KEY in .env.local
2. Run `vercel dev --yes --listen 3333`
3. Navigate to /programs
4. Click "Nieuw Programma"
5. Select "AI Programma (Aanbevolen)"
6. Select 1-2 goals
7. Set start date to tomorrow
8. Select "4 weken" duration
9. Select 2 days (e.g., Mon, Wed)
10. Click "Genereer Mijn Programma"
11. Verify loading animation appears with cycling messages
12. Wait for generation (5-15 seconds)
13. Verify result shows:
    - Success message
    - Program summary
    - Date-based schedule with week headers (8 entries for 4 weeks × 2 days)
    - Recommendations list
14. Click "Bekijk Programma"
15. Verify program detail page shows correct data
16. Check Airtable Programmaplanning table for created records (8 records)
17. Verify records are linked to correct program, dates, methods
18. Test error handling by disconnecting network during generation
