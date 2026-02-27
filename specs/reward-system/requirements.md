# Requirements: Reward System

## Redesign (2026-02-27)

Key changes from original spec:
- **Variable method points**: Methods now award 1-10 pts based on `Punten waarde` field (Airtable field ID: `fldcyKMc8Q02H2QGN`), replacing flat 10 pts
- **Overtuiging bonus**: Completing an overtuiging adds +1 bonus point to total (not a separate scoring dimension)
- **Journey-based badges**: 12 badges in 3 tiers (Eerste Stappen, Consistentie, Mentale Atleet) replacing the old 10-badge set
- **Program-aligned streaks**: Streaks track consecutive on-time Programmaplanning completions, not daily calendar activity
- **No 90-day score wipe**: Points never expire; only streak resets on missed scheduled session
- **Recalibrated levels**: Top level is 2000 pts (was 6000)
- **Silent failure fix**: `pointsAwarded` returns 0 on award failure instead of throwing
- **Method usage handler**: Now awards points via `awardRewardActivity` reading `points_value` from the method record

## Overview

Implement a gamification system to increase user engagement and retention in the Mental Fitness PWA. Users earn points, levels, streaks, and badges for completing activities.

## Goals

1. **Increase engagement** - Motivate users to complete more activities
2. **Build habits** - Encourage daily usage through streak tracking
3. **Celebrate progress** - Recognize achievements with badges and level-ups
4. **Retain users** - Create compelling reasons to return daily

## User Stories

### Points
- As a user, I want to earn points when I complete a method so I feel rewarded
- As a user, I want to see my total points in the header so I can track my progress
- As a user, I want bonus points for completing all session methods to encourage full sessions

### Streaks
- As a user, I want to see my current streak so I'm motivated to maintain it
- As a user, I want streak milestone rewards (7 sessions, 30 sessions) to celebrate consistency
- As a user, I want my streak to track consecutive on-time Programmaplanning completions (program-aligned)

### Levels
- As a user, I want to level up as I accumulate points to show my progress
- As a user, I want to see my progress toward the next level
- As a user, I want level titles that feel meaningful (not just numbers)

### Badges
- As a user, I want to earn badges for achievements (first method, first program, etc.)
- As a user, I want to see all available badges and which I've unlocked
- As a user, I want to be notified when I earn a new badge

### Good Habits
- As a user, I want to earn points for completing good habits
- As a user, I want my habit completions to persist across devices (not just localStorage)
- As a user, I want habits to count toward my daily streak

## Acceptance Criteria

### Points System
- [ ] Users earn variable points per method (1-10 pts, read from `Punten waarde` / `fldcyKMc8Q02H2QGN`)
- [ ] Overtuiging completion awards +1 bonus point to total
- [ ] Users earn 5 points per good habit completed
- [ ] Users earn 5 points per personal goal completed
- [ ] Points persist in Airtable (not localStorage)
- [ ] Points display in header updates after each activity
- [ ] Points never expire (no 90-day wipe)

### Streak System
- [ ] Streak increments when user completes a scheduled Programmaplanning on time
- [ ] Streak resets to 0 if user misses a scheduled session
- [ ] Streaks are program-aligned (not daily calendar-based)
- [ ] Longest streak is tracked separately and never decreases
- [ ] 7-session streak awards 50 bonus points
- [ ] 30-session streak awards 200 bonus points

### Level System
- [ ] 10 levels with recalibrated thresholds (top level at 2000 pts, not 6000)
- [ ] Level titles in Dutch (Beginner → Mentale Atleet)
- [ ] Account page shows circular progress toward next level
- [ ] Level-up triggers celebration animation

### Badge System
- [ ] 12 journey-based badges in 3 tiers:
  - **Eerste Stappen** (first steps): early milestones
  - **Consistentie** (consistency): sustained engagement
  - **Mentale Atleet** (mental athlete): mastery achievements
- [ ] Badges stored as JSON array in user record
- [ ] Badge grid shows earned (colored) vs locked (greyed)
- [ ] Toast notification when badge unlocked

### Good Habits Persistence
- [ ] Habit completions stored in new Airtable table (Gewoontegebruik)
- [ ] Habit checkmarks hydrate from API on page load
- [ ] Completing a habit triggers point awarding
- [ ] No duplicate records for same habit on same day

## Dependencies

- Existing Airtable schema (Gebruikers, Methodes tables)
- Existing method completion flow (MethodDetailPage, method-usage API)
- Existing Good Habits component (GoodHabitsSection)

## Out of Scope (Future)

- Leaderboards / social comparison
- Redeemable rewards (shop)
- Daily challenges / quests
- Achievement sharing
- Push notifications for streaks at risk
