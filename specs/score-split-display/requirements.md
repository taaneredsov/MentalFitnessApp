# Requirements: Score Split Display

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
- 10 points per method completion
- Bonus points for milestones (25%, 50%, 75%, 100%)
- Tracked per-program and cumulatively
- **Resets after 3 months of inactivity** (like physical fitness)

### 2. Personal Goals Score
- Points earned from completing **personal goals**
- 10 points per completion
- Can complete same goal multiple times (daily)
- Cumulative (never resets)

### 3. Good Habits Score
- Points earned from completing **good habits**
- 5 points per habit completion
- Daily completions
- Cumulative (never resets)

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
- Mental Fitness: Sum of all program method completions + milestones
- Personal Goals: Count of personal goal completions × 10
- Good Habits: Count of habit completions × 5

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
