# Requirements: Good Habits Section

## Overview

Add a "Goede Gewoontes" (Good Habits) section to the HomePage that displays habit-based methods. These are methods linked to the "Goede gewoontes" goal in Airtable. Unlike regular methods, these are simple reminders/tips without video content.

## User Story

As a user on the homepage, I want to see a section with good daily habits I can practice, so that I can build healthy routines alongside my mental fitness program.

## Data Source

Good habits are methods from the `Methodes` table filtered by their linked `Doelstellingen` (Goals):
- Filter: Methods where linked goal name = "Goede gewoontes"
- Current habits (3):
  1. 💧 Drink water
  2. 🧘 Stretch-pauze
  3. 🥗 Eet gezond

## Display Requirements

### Section Layout
- Separate card section on HomePage titled "Goede Gewoontes"
- Located after "Activiteit van Vandaag" or "Huidig Programma" section
- Collapsible or always visible (simple card list)

### Habit Card Display
- **Name**: Full method name including emoji (e.g., "💧 Drink water")
- **Description**: Method description in smaller/muted text
- **No navigation**: Clicking does NOT navigate to method detail (no video)
- **No duration**: Don't show duration since there's no media

### Visual Style
- Simple, clean cards matching existing app design
- Emoji should display prominently
- Description text in `text-muted-foreground` and smaller size

## Functional Requirements

1. **Fetch good habits**: Query methods API with goal filter for "Goede gewoontes"
2. **Display on HomePage**: Show section with habit cards
3. **Static display**: No interaction needed (read-only reminder cards)
4. **Cache-friendly**: Use React Query for caching

## Non-Functional Requirements

- Should not slow down HomePage load (parallel fetch or lazy load)
- Gracefully handle empty state (no habits configured)
- Works on mobile and desktop

## Acceptance Criteria

- [ ] "Goede Gewoontes" section appears on HomePage
- [ ] Shows all methods linked to "Goede gewoontes" goal
- [ ] Each habit displays name (with emoji) and description
- [ ] Habits are NOT clickable/navigable
- [ ] Section doesn't appear if no good habits exist

## Technical Notes

### Airtable Structure
- **Table**: Methodes (`tblB0QvbGg3zWARt4`)
- **Filter by**: `Doelstellingen (gekoppeld)` field contains goal with name "Goede gewoontes"
- **Fields needed**:
  - `name` (Methode Naam) - includes emoji
  - `description` (Beschrijving)

### API Approach Options
1. **New endpoint**: `GET /api/methods/habits` - filtered server-side
2. **Existing endpoint**: `GET /api/methods?goal=goede-gewoontes` - add query param
3. **Client filter**: Fetch all methods, filter client-side (less efficient)

Recommended: Option 1 or 2 for efficiency.

## Dependencies

- Existing Methods API (`/api/methods`)
- Existing field mappings for methods
- HomePage component

## Future Considerations

- Track habit completion (daily check-off)
- Habit streaks/gamification
- User-customizable habits
