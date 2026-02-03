# Current Sprint Tasks

**Target**: Multifarma Launch (March 2026)
**Source**: TODO.md, FRIDAY-DEMO-FEEDBACK.md

---

## Completed (This Session)

- [x] **CB-1**: Blue screen after program creation - Not a bug (blue "Gepland" badge is expected UI)
- [x] **CB-2**: Points incorrectly awarded - Fixed double counting in personal-goal-usage
- [x] **CB-3**: Progress resets to 0% on recalculation - Preserved method_usage records
- [x] **M-2**: Replace plus icon with checkmark - Updated PersonalGoalsSection.tsx
- [x] **BUG**: Missing personal-goals routes in server.ts - Added all missing routes

### M-1: Improve Onboarding and UX Clarity ✅ COMPLETED
**Completed**: 2026-02-03

#### PWA Install Prompt
- [x] Add prominent install prompt on MagicLinkPage (login)
- [x] Updated text: "TIP: Voeg eerst de app toe aan je startscherm..."
- [x] Hide install prompt during guided tour

#### Sticky Action Buttons
- [x] AIInputForm: Fixed height container with scrollable content
- [x] ScheduleReview: Fixed height container with scrollable content
- [x] ProgramResult: Fixed height container with scrollable content
- [x] Added scroll fade indicators to hint at scrollable content

#### Welcome Screen & Guided Tour
- [x] Created WelcomeScreen explaining 3-step process
- [x] Created Spotlight component (clip-path overlay)
- [x] Created TourTooltip component
- [x] Created GuidedTour orchestrator
- [x] Tour triggers after first program creation
- [x] Tour dismisses install prompt to avoid spotlight issues

#### Program Result Improvements
- [x] Changed button text to "Naar mijn startpagina"
- [x] Added homepage data preloading for snappy navigation
- [x] Added optional Personal Goals section
- [x] Personal goals guidance text explains Mental Fitness reinforcement
- [x] Fixed auto-redirect issue (onboardingInProgress state)

#### Layout Fixes
- [x] ScoreWidgets: Changed to CSS grid for equal width columns
- [x] BottomNav: Fixed text truncation issues
- [x] Clearer instruction text in ScheduleReview step

---

## In Progress

(none)

---

## Up Next: TIER 1 Must-Haves

### M-3: Improve Overlap Warning Text Clarity
**Priority**: MEDIUM-HIGH
**Impact**: Users may accidentally create conflicting programs
- [ ] Review current warning message
- [ ] Rewrite with specific dates and program names
- [ ] Add visual distinction (red alert box)

### M-4: Fix Video Auto-Fullscreen on Mobile
**Priority**: MEDIUM-HIGH
**Impact**: Poor user experience during method execution
- [ ] Adjust video player config for inline playback
- [ ] Test on iOS and Android
- [ ] Add clear close button if needed

### M-5: Improve AI Method Selection Control
**Priority**: HIGH - **BLOCKED BY C-1**
- [ ] Review AI prompt logic
- [ ] Add validation: only select methods with proper goal linkage
- [ ] Filter out incomplete/test data

### M-6: Fix Total Training Time Calculation
**Priority**: MEDIUM - **BLOCKED BY C-1**
- [ ] Audit method duration data in Airtable
- [ ] Update calculation logic

---

## Blocked

- **M-5** and **M-6** blocked by **C-1** (Content Audit) - waiting on content team

---

## Content & Business (Non-Technical)

### C-1: Content Audit and Completion [URGENT BLOCKER]
**Owner**: Content Team
**Deadline**: February 7
- [ ] Schedule content planning meeting
- [ ] Define complete list of methods for MVP
- [ ] Fill in all Airtable fields: duration, goal linkage, media

---

## Testing

### T-1: Add Test Users
- [ ] Add Dominique, Geert to Airtable
- [ ] Share test credentials

### T-2: Pilot Testing (Prana)
- [ ] Select small engaged group
- [ ] Onboard pilot users
- [ ] Collect feedback

---

## Deferred (Post-Launch)

- S-1: AI-Generated Program Names
- S-2: Add Method from Library to Program
- S-3: PWA Re-login (known limitation)
- N-1: User Levels (Beginner/Advanced)
- N-2: Score Reset After 3 Months
- F-1: HR Dashboard
- F-2: Native App Migration
