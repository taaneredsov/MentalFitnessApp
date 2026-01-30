# TODO - Development Roadmap

## Product Decisions (Documented 2026-01-30)

### Score System Architecture
- **3 separate scores** displayed as widgets on HomePage:
  1. **Mental Fitness Score** (from programs)
  2. **Personal Goals Score**
  3. **Good Habits Score**
- Stored in **3 separate fields** in Airtable User table
- Global total = sum of all three scores
- Per-program score tracked at program level

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

### 1. [BUG] Fix Personal Goals Score Registration
- **Status**: Not working - score not being saved
- **Priority**: CRITICAL
- **Spec**: `specs/personal-goals/`

### 2. [FEATURE] One Active Program Limit
- **Status**: Not implemented
- **Priority**: HIGH
- **Action**: Block starting new program if one is "running"

### 3. [FEATURE] Score Split Display (3 Widgets)
- **Status**: Planned
- **Priority**: STRETCH for Friday
- **Action**: Create 3 separate score widgets on HomePage

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

### Airtable Schema Updates Needed
- Add to User table:
  - `Mental Fitness Score` (number)
  - `Personal Goals Score` (number)
  - `Good Habits Score` (number)
  - `Last Active Date` (for inactivity tracking)
- Add to Program table:
  - `Program Score` (number)

### Key Files
- `src/pages/HomePage.tsx` - Score widgets display
- `src/types/rewards.ts` - Score types
- `api/personal-goal-usage/` - Fix scoring bug
- `api/programs/` - One active program validation
