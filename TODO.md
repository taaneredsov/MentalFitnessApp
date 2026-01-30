# TODO - Development Roadmap

## Product Decisions (Documented 2026-01-30)

### Score System Architecture
- **3 separate scores** displayed as widgets on HomePage:
  1. **Mental Fitness Score** = (# of methodes from active program) × 10 + bonuspoints
  2. **Personal Goals Score** = (# of personal goal completions) × 10
  3. **Good Habits Score** = (# of habit completions) × 5
- All scores calculated via **Airtable formula fields** (read-only in app)
- Mental Fitness score is filtered by **active program** only (Status = "Actief")

### Program Status
- New field in `Mentale Fitnessprogramma's`: **Status**
  - Values: "Actief" (running), "Gepland" (planned), "Afgewerkt" (finished)
  - Used to filter which program's methods count toward Mental Fitness Score
  - Set automatically on program creation based on start date

### Score Reset Policy (Mental Fitness Only)
- **Analogy**: Like muscle training - if inactive for 3 months, progress is lost
- Mental Fitness score resets to **zero** after 3 months of inactivity
- **Soft reset with alerts**: User must be warned before reset
- Part of the experience: communicate that regular practice (even daily small exercises) is essential
- Edit program feature can help users adjust if program isn't a good fit

### Program Management
- **One active program** at a time (enforce limit)
- **Editable programs**: Users can modify schedule, methods, even in running programs
- Cumulative scoring: Total score persists across programs

---

## Friday Demo Priorities (URGENT)

### 1. [BUG] Fix Personal Goals Score Registration ✅ DONE
- **Status**: FIXED - was using field ID instead of field name in .find()
- **Priority**: CRITICAL
- **Spec**: `specs/personal-goals/`

### 2. [FEATURE] One Active Program Limit ✅ DONE
- **Status**: Implemented - frontend + backend validation
- **Priority**: HIGH
- **Action**: Block starting new program if one is "running"

### 3. [FEATURE] Score Split Display (3 Widgets) ✅ DONE
- **Status**: Implemented - 3 widgets on HomePage
- **Priority**: STRETCH for Friday
- **Action**: Create 3 separate score widgets on HomePage

### 4. [FEATURE] Program Status Field ✅ DONE
- **Status**: Airtable field created, API integration complete
- **Priority**: HIGH
- **Action**: Status auto-set on program creation (Actief/Gepland based on start date)

---

## Post-Friday Roadmap

### Tier 1: High Priority
- [ ] Edit Running Program (add/remove methods, change schedule)
- [ ] Cumulative Score Tracking (per-program + global)
- [ ] Auto-assign points when reaching method end page
- [ ] Score reset after 3 months inactivity (with warnings)

### Tier 2: Medium Priority
- [ ] Baseline Measurement (nulmeting) during onboarding
- [ ] PWA Update Issues (service worker/caching)
- [ ] Filter Methods by Goal

### Tier 3: Future
- [ ] User Level Management (beginner/advanced)
- [ ] B2B Reporting Capability
- [ ] Mental Coach Integration

---

## Technical Notes

### Airtable Schema (Updated 2026-01-30)
- **User table** (Gebruikers):
  - `Mental Fitness Score` (formula) - fldMTUjMC2vcY0HWA
  - `Persoonlijke Doelen Score` (formula) - fldVDpa3GOFSWTYly
  - `Goede Gewoontes Score` (formula) - fldpW5r0j9aHREqaK
- **Program table** (Mentale Fitnessprogramma's):
  - `Status` (single select: Actief/Gepland/Afgewerkt) - FIELD_ID_NEEDED

### Key Files
- `src/components/ScoreWidgets.tsx` - 3-score widget display
- `src/pages/HomePage.tsx` - Score widgets integration
- `src/types/rewards.ts` - Score types (mentalFitnessScore, personalGoalsScore, goodHabitsScore)
- `api/_lib/field-mappings.js` - Airtable field IDs
- `api/personal-goal-usage/` - Personal goal completions
- `api/programs/` - One active program validation + Status field
