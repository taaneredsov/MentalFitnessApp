# Requirements: Score Split Display

## Redesign (2026-02-27)

Key changes from original spec:
- **Mental Fitness**: Now sum of method `points_value` (variable 1-10 per method, from `Punten waarde` field), replacing flat 10 pts per method
- **Personal Goals**: count * 5 (unchanged)
- **Good Habits**: count * 5 (unchanged)
- **Mindset (overtuiging)**: +1 bonus point added to total score; NOT displayed as a separate fourth dimension/widget
- **No 90-day inactivity reset** on Mental Fitness score (points never expire)

## Overview

Split the gamification score into **3 separate categories** displayed as distinct widgets on the HomePage. This provides users with clearer insight into their progress across different domains and prevents a high score in one area from masking lack of progress in another.

## Business Rationale

- **Transparency**: Users see exactly where their points come from
- **Motivation**: Progress in each area is visible and trackable
- **Balance**: Encourages engagement across all three areas (mental fitness, personal goals, habits)
- **Insights**: Users can identify areas needing more attention

## Score Categories

### 1. Mental Fitness Score
- Points earned from completing **program methods**
- Variable points per method: 1-10 pts based on `points_value` from method record (`Punten waarde` / `fldcyKMc8Q02H2QGN`)
- Tracked per-program and cumulatively
- Cumulative (never resets, no 90-day wipe)

### 2. Personal Goals Score
- Points earned from completing **personal goals**
- 5 points per completion
- Can complete same goal multiple times (daily)
- Cumulative (never resets)

### 3. Good Habits Score
- Points earned from completing **good habits**
- 5 points per habit completion
- Daily completions
- Cumulative (never resets)

### Mindset (Overtuiging) — Not a Separate Widget
- Completing an overtuiging adds +1 bonus point to the **total** score
- This is NOT displayed as a separate fourth category/widget
- The bonus is folded into the overall total shown in the header

## Functional Requirements

### FR-1: Three Score Widgets on HomePage
- Display 3 separate widgets/cards below the program section
- Each widget shows:
  - Category name
  - Score value
  - Distinctive icon
  - Brief description or recent activity

### FR-2: Airtable Schema Updates
- Add 3 new fields to User table:
  - `Mental Fitness Score` (number)
  - `Personal Goals Score` (number)
  - `Good Habits Score` (number)
- Update `Total Points` formula to sum all three

### FR-3: Score Calculation
- Mental Fitness: Sum of each method's `points_value` (1-10 per method, from Airtable `Punten waarde` field)
- Personal Goals: Count of personal goal completions * 5
- Good Habits: Count of habit completions * 5
- Overtuiging: +1 bonus to total (not a separate category)

## Acceptance Criteria

- [ ] HomePage displays 3 distinct score widgets
- [ ] Each widget has unique icon and styling
- [ ] Scores update in real-time after completions
- [ ] Airtable stores scores in separate fields
- [ ] Total score in header equals sum of 3 categories

## UI/UX Design

### Widget Layout
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 🧠 Mental       │ │ 🎯 Personal     │ │ ✓ Good         │
│    Fitness      │ │    Goals        │ │   Habits       │
│    ────────     │ │    ────────     │ │    ────────    │
│    250 pts      │ │    120 pts      │ │    85 pts      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Icons
- Mental Fitness: Brain icon (🧠)
- Personal Goals: Target icon (🎯)
- Good Habits: Check circle (✓)

## Dependencies

- Personal Goals feature (completed)
- Good Habits feature (completed)
- Reward system (completed)
- Airtable User table schema

## Out of Scope

- Detailed breakdown within each category
- Historical charts/graphs
- Leaderboards
- Score sharing
