# Requirements: Program Creation & Onboarding

## Summary

Enable users to create new mental fitness programs through a multi-step wizard. New users without any programs see this as an onboarding flow. All users can create additional programs via the "Programma's" tab.

## User Stories

### As a new user (no programs)
- I want to be guided through creating my first program
- So I can start my mental fitness journey immediately

### As an existing user
- I want to create additional programs from the Programma's tab
- So I can set up new fitness routines

## Program Creation Flow

### Step 1: Basic Info
- **Startdatum** (Start date): Date picker, defaults to today
- **Duur** (Duration): Dropdown selection
  - Options: "1 week", "2 weken", "3 weken", "4 weken", "6 weken", "8 weken"

### Step 2: Goals
- **Doelstellingen** (Goals): Multi-select dropdown
- Data source: Doelstellingen table (tbl6ngkyNrv0LFzGb)
- User can select one or more goals

### Step 3: Schedule
- **Dagen van de week** (Days of the week): Multi-select
- Data source: Dagen van de week table (tblS3gleG8cSlWOJ3)
- Options: Maandag, Dinsdag, Woensdag, Donderdag, Vrijdag, Zaterdag, Zondag

### Step 4: Methods (Auto-suggested + User Selection)
- After saving basic program data, Airtable automation populates suggested methods
- **Polling required**: Wait for automation to update "Mentale methode" field
- User can:
  - Keep suggested methods
  - Remove methods from the list
  - Add other methods from the full methods catalog
- Data source: Methodes table (tblB0QvbGg3zWARt4)

### Step 5: Confirmation
- Review all selections
- Save final program to Mentale Fitnessprogramma's table

## Data Model

### Program Table (tblqW4xeCx1tprNgX)
| Field | Type | Notes |
|-------|------|-------|
| Gebruiker | Link | Current user |
| Startdatum | Date | User selected |
| Duur van programma | Single Select | Duration |
| Doelstellingen | Link (multiple) | Selected goals |
| Dagen van de week | Link (multiple) | Selected days |
| Mentale methode | Link (multiple) | Methods (auto + user) |
| Notities | Long text | Optional |

### Supporting Tables
- **Doelstellingen** (tbl6ngkyNrv0LFzGb): Goals catalog
- **Dagen van de week** (tblS3gleG8cSlWOJ3): Days reference
- **Methodes** (tblB0QvbGg3zWARt4): Methods catalog

## Airtable Automation

After a program is created with goals and days selected:
1. Airtable automation runs
2. Automation suggests methods based on goals/days
3. Updates "Mentale methode" field with suggestions
4. Frontend polls until methods are populated

## Entry Points

### 1. Onboarding (New Users)
- Triggered when user has no programs
- Shows on HomePage or as modal after first login
- Full-screen wizard experience

### 2. Programma's Tab (All Users)
- "Nieuw Programma" button on ProgramsPage
- Same wizard flow, can be modal or full page

## Acceptance Criteria

- [ ] New users without programs see onboarding wizard
- [ ] All users can create programs via "Nieuw Programma" button
- [ ] Start date picker works correctly
- [ ] Duration dropdown shows all options
- [ ] Goals are loaded from Doelstellingen table
- [ ] Days of week can be multi-selected
- [ ] System waits for Airtable automation to suggest methods
- [ ] User can modify suggested methods (add/remove)
- [ ] Program is saved to Airtable with all fields
- [ ] After creation, user is redirected to program detail page
- [ ] Created program appears in program list

## Edge Cases

- User closes wizard mid-flow: No partial data saved
- Airtable automation timeout: Show error after 30s, allow retry
- No goals available: Show message, allow creation without goals
- No methods suggested: Allow user to pick manually

## Dependencies

- Existing Goals API endpoint (or create new)
- Existing Days API endpoint (or create new)
- Existing Methods API endpoint (already exists)
- Program creation API endpoint (create new)
