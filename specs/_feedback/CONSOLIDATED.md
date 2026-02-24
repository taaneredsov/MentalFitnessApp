# Consolidated Feedback & Reviews

> All feedback from stakeholder meetings, demos, and technical audits gathered in one place.
> Individual session notes are archived in this folder for reference.

---

## Timeline

| Date | Session | Participants |
|------|---------|-------------|
| ~Jan 2026 | Initial evaluation | Iris, Renaat |
| 2026-01-30 | Friday demo | 6 participants |
| 2026-02-06 | Vergadering | Iris, Renaat |
| 2026-02-20 | Functional audit | Technical review |
| 2026-02-20 | App review plan | Technical review |

---

## 1. Scoring & Gamification

### Decided
- Three separate score categories: Mental Fitness, Persoonlijke Doelen, Goede Gewoontes
- Points: 10 per methode, 10 per persoonlijk doel, 5 per goede gewoonte
- Bonus points for milestones (25%, 50%, 75%, 100%)
- Streak system for daily habits (resets on missed day)
- Badges: ontdekker -> mentale atleet progression
- Score is cumulative across programs (not reset per program)
- Score resets after 3 months inactivity (warning shown beforehand)
- Single active program at a time

### Fixed (as of Feb 2026)
- [x] Bug: points awarded incorrectly
- [x] Bug: personal goals score not added to total
- [x] Bug: overtuiging levels required 3 registrations (should be 1 completion)
- [x] Formula incorrectly divided by 3

### Open
- [ ] Beginner/gevorderd user level distinction not implemented
- [ ] Score reset after inactivity mechanism (3 months)

---

## 2. Overtuigingen (Beliefs)

### Decided
- Users train a belief, then self-mark as "ingeprint" (completed) = 1 point
- Instruction text: "Print in met de balansmethode. Indien je print in met de balansmethode, zet een vinkje."
- Completed beliefs hidden behind "bekijk voltooide" toggle (collapsed by default)

### Fixed
- [x] Checkmarks: grey for incomplete, green when completed (was all green before)
- [x] Level logic simplified (no more 3x registration)

### Architecture Issues (from Feb 20 audit)
- `GET /api/overtuigingen` bypasses Postgres, always hits Airtable (High)
- `GET /api/persoonlijke-overtuigingen` has no Postgres mode (Medium)
- Mixed-source UI composition causes transient mismatches (Medium)

---

## 3. Methodes & Program Wizard

### Decided
- AI generates program from goals, duration, training days
- Users can adjust program after creation (reschedule, add/remove)
- AI logic/prompts fully manageable from Airtable
- Library filter by doelstelling and duration

### Fixed
- [x] Program adjustment/rescheduling with preservation of completed sessions

### Architecture Issues (from Feb 20 audit)
- `GET /api/methods` bypasses Postgres, always hits Airtable (High)
- Program Wizard still polls Airtable automation for method suggestions (High)
- Slow/fragile onboarding when Airtable automation is delayed

### Open
- [ ] "Voeg toe aan mijn programma" button in library
- [ ] Images/photos per method
- [ ] AI name generation for programs
- [ ] Inline video playback (no auto-fullscreen on mobile)

---

## 4. Personal Goals

### Architecture Issues (from Feb 20 audit)
- Personal goals can duplicate in Postgres during full Airtable sync (High)
  - Postgres-created goals use UUID, Airtable uses RECORD_ID
  - No `airtable_record_id` column for reconciliation
- Frontend invalidation correct but can't fix backend duplicates (Medium)

### Addressed in App Review Plan (Feb 20)
- [x] Completed-goal lifecycle (collapsed section, reactivation)
- [x] Airtable parity for scheduleDays
- [x] Cache headers for index.html
- [ ] i18n wiring for scheduling UI strings

---

## 5. UI/UX

### Fixed
- [x] Checkmark colors (grey -> green on completion)
- [x] Plus icon replaced with checkmark for completed goals
- [x] Completed items collapsible

### Open
- [ ] Onboarding flow needs improvement (prominence of "activiteit van vandaag")
- [ ] Button placement/logic improvements
- [ ] Notification/reminder system (daily task reminders)

---

## 6. Authentication & PWA

### Fixed
- [x] Password login flow
- [x] Service worker cache busting
- [x] Session duration extended

### Known Limitations
- PWA requires re-login after homescreen install
- Deep links from email not possible (code must be copied)

---

## 7. Technical Architecture (Feb 20 Audit Summary)

**Core finding**: Backend source inconsistency is the primary issue, not frontend state management.

### Immediate Stabilization (recommended)
1. Move `/api/methods` and `/api/overtuigingen` to Postgres-primary
2. Fix personal-goal identity reconciliation (add `airtable_record_id`)
3. Remove Airtable-automation dependency from Wizard in Postgres mode
4. Keep Airtable as async sink only (no direct reads for hot paths)

### Frontend Hardening
1. Optimistic reconciliation for personal goals mutations
2. User-visible error messaging (many onError paths are silent)
3. E2E tests for goal create, overtuiging complete, wizard methods

---

## 8. Content & Data

### Open
- [ ] Not all overtuigingen linked to doelstellingen in Airtable
- [ ] Content session needed to finalize methodes/oefeningen
- [ ] English translations + audio not available yet
- [ ] AI content correctness not guaranteed

---

## 9. Commercial & Strategy

### Decided
- Target: product ready for Multifarma by March 2026
- Nationale Bank: exception with unlimited access
- Standard model: 1-year access (annual payment)
- B2C possibility at EUR 10-20/month (future)

### Open
- [ ] HR dashboard (anonymized team data)
- [ ] Native app evolution (Play Store/App Store)
- [ ] Remotion/Sora for personalized content (cost TBD)

---

## 10. Future Ideas
- AI-driven identification of belemmerende overtuigingen from user input
- Personalized relaxation exercises (audio/video) via Remotion + 11Labs
- Sora API for Flemish-language video (quality still rough)
- Mental Coach app integration
- Nulmeting (baseline measurement) during onboarding
