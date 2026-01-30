# Requirements: Personal Goals

## Overview

Allow users to create their own personal goals (e.g., "speaking up during a meeting") that are always visible and completable daily for bonus points.

## User Stories

### As a user, I want to:
1. Create personal goals that are specific to me
2. See my personal goals on the homepage every day
3. Mark goals as complete each day and earn points
4. Manage (edit/delete) my personal goals from my account page

## Acceptance Criteria

### Goal Management
- [ ] Users can create personal goals with a name (required) and description (optional)
- [ ] Users can edit their existing personal goals
- [ ] Users can delete personal goals
- [ ] Maximum 10 personal goals per user
- [ ] Goals are visible only to the user who created them

### Daily Completion
- [ ] Personal goals appear on HomePage in a dedicated section
- [ ] Users can mark goals complete with a checkmark button
- [ ] Completing a goal awards 10 points
- [ ] Completing a goal counts toward daily streak
- [ ] Goals reset daily (can be completed once per day)
- [ ] Unchecking removes the completion record

### Points Integration
- [ ] 10 points awarded per completion (via bonusPoints field)
- [ ] Points appear in header total immediately
- [ ] Points animation shows "+10" on completion
- [ ] Streak updates on first completion of the day

### UI/UX
- [ ] Personal Goals section on HomePage below "Goede Gewoontes"
- [ ] Same card design pattern as Good Habits
- [ ] Goal management section on AccountPage
- [ ] Empty state when no goals created
- [ ] Loading states during data fetch

## Dependencies

- Existing rewards system (bonusPoints, streak tracking)
- Existing Good Habits pattern for UI reference
- Airtable tables (already created)

## Out of Scope

- Goal categories/tags
- Custom point values per goal
- Goal reminders/notifications
- Completion statistics
- Goal templates
- Weekly/one-time goals (daily only for MVP)
