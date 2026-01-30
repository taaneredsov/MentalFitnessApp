# Recent Feature Changes (January 2026)

This document summarizes recent feature implementations and updates to the Corporate Mental Fitness PWA.

## Overview

Six significant features were implemented in January 2026:

1. **Score Split Display** - Three separate score widgets on home page
2. **Program Status Field** - Auto-set status for programs
3. **One Active Program Limit** - Enforce single active program rule
4. **Personal Goals Feature** - User-created custom goals with tracking
5. **Header Change** - Removed total points, show streak only
6. **Edit Running Program** - Edit active/planned programs with schedule regeneration

## 1. Score Split Display (3 Widgets)

**Status**: ✅ Implemented

### What Changed

Previously, only a total points display was shown in the header. Now, three separate score widgets are prominently displayed on the home page below the greeting.

### Implementation

- **Component**: `src/components/ScoreWidgets.tsx`
- **Location**: HomePage, below greeting, above program info
- **API**: Uses existing GET /api/rewards endpoint
- **Airtable**: Three new formula fields added to Users table

### Score Breakdown

| Widget | Points Formula | Icon | Color |
|--------|----------------|------|-------|
| Mental Fitness | Methods × 10 + bonusPoints | 🧠 Brain | Blue |
| Personal Goals | Personal goals × 10 | 🎯 Target | Orange |
| Good Habits | Habits × 5 | ❤️ Heart | Pink |

### Documentation

- **Feature Guide**: `docs/features/score-widgets.md`
- **API Reference**: Updated `docs/api/endpoints.md` (User fields)
- **Rewards Guide**: Updated `docs/features/rewards.md`

---

## 2. Program Status Field

**Status**: ✅ Implemented

### What Changed

Programs now have an auto-set Status field with three values: Actief, Gepland, Afgewerkt.

### Implementation

- **Airtable Field**: Status (fldJcgvXDr2LDin14) - Single Select
- **Auto-set Logic**: On program creation based on start date
- **Files Modified**:
  - `api/programs/index.ts` - Creation logic
  - `api/programs/confirm.ts` - AI program confirmation
  - `api/_lib/field-mappings.js` - Field mapping added

### Status Logic

```
IF startDate <= today THEN "Actief"
ELSE "Gepland"
```

**Note**: "Afgewerkt" status is not automatically set (future enhancement).

### Documentation

- **Feature Guide**: `docs/features/program-status.md`
- **API Reference**: Updated `docs/api/endpoints.md` (Program fields)

---

## 3. One Active Program Limit

**Status**: ✅ Implemented

### What Changed

Users can now only have one running program at a time. Creation attempts are blocked with a 409 error.

### Implementation

- **Backend Validation**: `api/programs/index.ts` - POST handler
- **Frontend Blocking**: `src/pages/HomePage.tsx` - Hides create button
- **Error Message**: "Je hebt al een actief programma. Voltooi dit eerst voordat je een nieuw programma start."

### Rules

- ✅ Only one program with dates spanning today
- ✅ Scheduled (future) programs are allowed
- ✅ Multiple completed programs are allowed
- ❌ Cannot create new program while one is running

### Documentation

- **Feature Guide**: `docs/features/one-active-program-limit.md`
- **API Reference**: Updated `docs/api/endpoints.md` (POST /api/programs)

---

## 4. Personal Goals Feature

**Status**: ✅ Implemented

### What Changed

Users can now create custom personal goals (e.g., "Speak up in meeting"), track completions, and earn 10 points per completion.

### Implementation

**New Airtable Tables:**
1. **Persoonlijke doelen** (tblbjDv35B50ZKG9w)
   - Fields: Naam, Beschrijving, Gebruikers, Status, Aangemaakt op
2. **Persoonlijk Doelgebruik** (tbl8eJeQtMnIF5EJo)
   - Fields: Gebruikers, Persoonlijke doelen, Datum

**New API Endpoints:**
- `GET /api/personal-goals` - List user's goals
- `POST /api/personal-goals` - Create new goal
- `PATCH /api/personal-goals/:id` - Update goal
- `DELETE /api/personal-goals/:id` - Archive goal
- `GET /api/personal-goal-usage` - Get completion counts
- `POST /api/personal-goal-usage` - Record completion

**New Components:**
- `src/components/PersonalGoalsSection.tsx` - Main display component
- `src/components/PersonalGoalDialog.tsx` - Create/edit dialog

**New Query Hooks:**
- `usePersonalGoals()`
- `usePersonalGoalUsage(userId, date)`
- `useCreatePersonalGoal()`
- `useUpdatePersonalGoal()`
- `useDeletePersonalGoal()`
- `useCompletePersonalGoal()`

### Features

- Maximum 10 active goals per user
- Unlimited completions per day
- 10 bonus points per completion
- Expandable cards with descriptions
- Today's count and total count tracking
- Points animation on completion
- Contributes to streak tracking

### Documentation

- **Feature Guide**: `docs/features/personal-goals.md`
- **API Reference**: Updated `docs/api/endpoints.md` (new section)
- **Airtable Schema**: Updated field mappings

---

## 5. Header Points Display Change

**Status**: ✅ Implemented

### What Changed

The header now shows only the streak (🔥12), not total points.

---

## 6. Edit Running Program

**Status**: ✅ Implemented

### What Changed

Users can now edit active ("running") and planned programs. When schedule-affecting changes are made (days or goals), the system regenerates future sessions while preserving completed activities.

### Implementation

**New Airtable Field:**
- `Type Programma Creatie` (fldC7QjG65RAnplH2) - Single select: "Manueel" / "AI"

**New API Endpoint:**
- `POST /api/programs/:id/regenerate-schedule` - Regenerates future sessions

**Modified Components:**
- `src/components/ProgramEditDialog.tsx` - Full rewrite with regeneration flow
- `src/pages/ProgramDetailPage.tsx` - Integration with regeneration mutation

### Features

1. **Goal Editing** - Change which mental fitness goals the program targets
2. **Day Selection** - Change training days (Ma, Di, Wo, etc.)
3. **Notes** - Add/edit personal notes
4. **Schedule Regeneration** - Future sessions regenerated when days/goals change
5. **Past Session Preservation** - Completed activities never lost

### Regeneration Options

For AI-created programs with goal changes:
- **AI Regeneration** (Recommended) - Uses GPT-4o with edit context
- **Simple Redistribution** - Evenly distributes existing methods

For manual programs:
- **Simple Redistribution** - Only option available

### Safeguards

1. **Warning Banner** - Shows number of future sessions affected
2. **Confirmation Dialog** - Explains consequences before regenerating
3. **Past Preservation** - Sessions with date <= today are never deleted
4. **Conflict Detection** - Warns if future sessions have completed activities

### UI Flow

```
┌─────────────────────────┐
│  Edit Program Dialog    │
│  - Goals checkboxes     │
│  - Day pills (Ma-Zo)    │
│  - Notes textarea       │
└─────────────────────────┘
         │
         │ (days or goals changed)
         ▼
┌─────────────────────────┐
│  Warning Banner         │
│  "X sessions affected"  │
└─────────────────────────┘
         │
         │ (click "Wijzigingen bekijken")
         ▼
┌─────────────────────────┐
│  Confirmation Dialog    │
│  - What happens         │
│  - AI vs Simple choice  │
│  (for AI programs)      │
└─────────────────────────┘
         │
         │ (confirm)
         ▼
┌─────────────────────────┐
│  Schedule Regenerated   │
│  Dialog closes          │
└─────────────────────────┘
```

### Documentation

- **Feature Guide**: Updated `docs/features/programs.md` (Editing Programs section)

### Rationale

- Avoid redundancy with score widgets on home page
- Save mobile header space
- Focus on daily engagement (streak)
- Split scores are more meaningful than total

### Implementation

- **Component**: `src/components/rewards/PointsDisplay.tsx`
- **Display**: Only shows if streak > 0
- **Format**: 🔥{streak}

### Before vs After

| Before | After |
|--------|-------|
| `450 ⭐ \| 🔥12` | `🔥12` |

### Documentation

- **Feature Guide**: `docs/features/header-points-display.md`
- **Rewards Guide**: Updated `docs/features/rewards.md`

---

## Files Modified

### Backend (API)

```
api/
├── programs/
│   ├── index.ts              ✏️  (status auto-set, one-active limit)
│   ├── confirm.ts            ✏️  (status auto-set)
│   └── [id]/
│       └── regenerate-schedule.ts  ✨  (new endpoint)
├── personal-goals/
│   └── index.ts              ✨  (new endpoint)
├── personal-goal-usage/
│   └── index.ts              ✨  (new endpoint)
└── _lib/
    ├── field-mappings.js     ✏️  (new fields added: creationType)
    └── openai.ts             ✏️  (editContext for regeneration)
```

### Frontend (UI)

```
src/
├── components/
│   ├── ScoreWidgets.tsx              ✨  (new component)
│   ├── PersonalGoalsSection.tsx      ✨  (new component)
│   ├── PersonalGoalDialog.tsx        ✨  (new component)
│   ├── ProgramEditDialog.tsx         ✏️  (rewritten with regeneration flow)
│   └── rewards/
│       └── PointsDisplay.tsx         ✏️  (removed total points)
├── pages/
│   ├── HomePage.tsx                  ✏️  (score widgets, one-active blocking)
│   ├── AccountPage.tsx               ✏️  (personal goals management)
│   └── ProgramDetailPage.tsx         ✏️  (regeneration integration)
├── hooks/
│   └── queries.ts                    ✏️  (personal goals + regeneration hooks)
├── lib/
│   ├── api-client.ts                 ✏️  (new endpoints)
│   └── query-keys.ts                 ✏️  (new query keys)
└── types/
    ├── program.ts                    ✏️  (PersonalGoal + ProgramCreationType)
    └── rewards.ts                    ✏️  (split scores, personal goal points)
```

### Documentation

```
docs/
├── README.md                         ✏️  (updated features list)
├── RECENT-CHANGES.md                 ✨  (this file)
├── api/
│   └── endpoints.md                  ✏️  (personal goals endpoints, fields)
├── features/
│   ├── score-widgets.md              ✨  (new)
│   ├── program-status.md             ✨  (new)
│   ├── one-active-program-limit.md   ✨  (new)
│   ├── personal-goals.md             ✨  (new)
│   ├── header-points-display.md      ✨  (new)
│   └── rewards.md                    ✏️  (updated for split scores)
└── architecture/
    └── overview.md                   ✏️  (updated reward fields)
```

Legend: ✨ New file, ✏️ Modified file

---

## Airtable Schema Changes

### Users Table (Gebruikers)

**New Formula Fields:**

| Field ID | Dutch Name | Formula |
|----------|------------|---------|
| fldMTUjMC2vcY0HWA | Mental Fitness Score | `(# methods × 10) + bonusPoints` |
| fldVDpa3GOFSWTYly | Persoonlijke Doelen Score | `# personal goals × 10` |
| fldpW5r0j9aHREqaK | Goede Gewoontes Score | `# habits × 5` |

### Programs Table (Mentale Fitnessprogramma's)

**New Fields:**

| Field ID | Dutch Name | Type | Values |
|----------|------------|------|--------|
| fldJcgvXDr2LDin14 | Status | Single Select | Actief, Gepland, Afgewerkt |
| fldC7QjG65RAnplH2 | Type Programma Creatie | Single Select | Manueel, AI |

### New Tables

**Persoonlijke doelen** (tblbjDv35B50ZKG9w)

| Field | Type | Description |
|-------|------|-------------|
| Naam | Single line text | Goal name (max 200 chars) |
| Beschrijving | Long text | Optional description (max 1000 chars) |
| Gebruikers | Link to Users | Goal owner |
| Status | Single select | Actief / Gearchiveerd |
| Aangemaakt op | Created time | Auto-generated |

**Persoonlijk Doelgebruik** (tbl8eJeQtMnIF5EJo)

| Field | Type | Description |
|-------|------|-------------|
| Gebruikers | Link to Users | User who completed |
| Persoonlijke doelen | Link to Personal Goals | Completed goal |
| Datum | Date | Completion date (YYYY-MM-DD) |

---

## API Changes

### New Endpoints

```
GET    /api/personal-goals
POST   /api/personal-goals
PATCH  /api/personal-goals/:id
DELETE /api/personal-goals/:id
GET    /api/personal-goal-usage
POST   /api/personal-goal-usage
POST   /api/programs/:id/regenerate-schedule
```

### Modified Endpoints

**POST /api/programs**
- Now validates for one active program (409 error)
- Auto-sets Status field based on start date

**GET /api/rewards**
- Now returns three split scores:
  - `mentalFitnessScore`
  - `personalGoalsScore`
  - `goodHabitsScore`

---

## Migration Notes

### For Developers

1. **Run `vercel dev`** to reload serverless functions with new endpoints
2. **Clear browser cache** for updated frontend components
3. **Test personal goals** create, complete, edit, delete flows
4. **Verify one-active-program** blocking message appears

### For Database Admins

1. **Ensure formula fields** are correctly calculating split scores
2. **Check Status field** exists on Programs table with correct options
3. **Verify linked records** between Users and Personal Goals tables

### Breaking Changes

**None**. All changes are backwards-compatible additions.

---

## Testing Checklist

### Score Widgets
- [ ] Three widgets display on home page
- [ ] Scores update after completing method/habit/personal goal
- [ ] Loading state shows three skeleton cards
- [ ] Widgets are responsive on mobile

### Program Status
- [ ] New program with today's date gets "Actief"
- [ ] New program with future date gets "Gepland"
- [ ] Status field visible in Airtable

### One Active Program Limit
- [ ] Cannot create new program while one is running
- [ ] Can create scheduled program while one is running
- [ ] Error message is clear and friendly
- [ ] Blocking UI appears on home page

### Personal Goals
- [ ] Create goal with name only (no description)
- [ ] Create goal with name and description
- [ ] Cannot create 11th goal (max limit)
- [ ] Complete goal awards 10 points
- [ ] Today count increments correctly
- [ ] Total count increments correctly
- [ ] Edit goal updates name/description
- [ ] Delete goal archives (doesn't delete usage)
- [ ] Personal Goals score widget updates

### Header Display
- [ ] Only streak shows in header (no total points)
- [ ] Streak displays with fire emoji
- [ ] Header is empty if streak = 0

### Edit Running Program
- [ ] Edit button appears for running programs
- [ ] Edit button appears for planned programs
- [ ] Edit button does NOT appear for finished programs
- [ ] Goals can be selected/deselected
- [ ] Days can be selected/deselected
- [ ] Notes can be edited
- [ ] Warning shows when days/goals change
- [ ] Confirmation dialog shows regeneration options for AI programs
- [ ] Simple regeneration works for manual programs
- [ ] Past sessions are preserved after regeneration
- [ ] Future sessions are regenerated with new schedule
- [ ] Dialog closes after successful save

---

## Known Issues

None at this time.

---

## Future Enhancements

### Score Widgets
- Tap to see detailed breakdown/history
- Animated number changes on score update
- Progress rings instead of just numbers

### Program Status
- Automatic transition to "Afgewerkt" on end date
- Manual "Complete Program" button before end date
- Archive old programs

### One Active Program Limit
- Option to "replace" current program
- Show countdown to when new program can be created
- Multi-program mode (opt-in feature)

### Personal Goals
- Recurring goals with daily/weekly targets
- Goal categories or tags
- Charts showing progress over time
- Reminders and notifications
- Goal templates library
- Share goals with coach/team

### Header
- Animate fire emoji on streak increase
- Different emoji for milestone streaks (30, 90, 365 days)
- Tap to view streak history

---

## Support & Questions

For questions about these features, see:
- Feature-specific documentation in `docs/features/`
- API documentation in `docs/api/endpoints.md`
- Architecture overview in `docs/architecture/overview.md`

---

### Edit Running Program
- Archive/restore programs
- Extend program duration
- Clone existing program
- Bulk edit multiple sessions
- Schedule visualization calendar

**Last Updated**: January 30, 2026
