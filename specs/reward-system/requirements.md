# Requirements: Reward System

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
- As a user, I want streak milestone rewards (7 days, 30 days) to celebrate consistency
- As a user, I want my streak to count both program methods AND good habits

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
- [ ] Users earn 10 points per method completed
- [ ] Users earn 5 bonus points for completing all methods in a session
- [ ] Users earn 5 points per good habit completed
- [ ] Users earn 5 bonus points for completing all habits in a day
- [ ] Points persist in Airtable (not localStorage)
- [ ] Points display in header updates after each activity

### Streak System
- [ ] Streak increments when user completes any activity on consecutive days
- [ ] Streak resets to 1 if user misses a day
- [ ] Longest streak is tracked separately and never decreases
- [ ] 7-day streak awards 50 bonus points
- [ ] 30-day streak awards 200 bonus points

### Level System
- [ ] 10 levels with increasing point thresholds
- [ ] Level titles in Dutch (Beginner → Mentale Atleet)
- [ ] Account page shows circular progress toward next level
- [ ] Level-up triggers celebration animation

### Badge System
- [ ] Initial set of ~10 badges across categories (progress, streaks, habits)
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
