# Requirements: Activity-based Program Progress

## Summary

Change the "Voortgang" (Progress) calculation on program cards from time-based to activity-based measurement. Progress should reflect actual completed activities rather than elapsed time.

## Current Behavior

Progress is calculated based on time elapsed:
- `progress = (today - startDate) / (endDate - startDate) × 100`
- This doesn't reflect actual user engagement or completion

## Desired Behavior

Progress should be calculated based on completed activities:
- `progress = completedActivities / totalExpectedActivities × 100`
- **Total expected activities** = program duration (weeks) × frequency (days per week)
- **Completed activities** = count of Methodegebruik records linked to the program

### Example

A program with:
- Duration: 4 weeks
- Frequency: 2 days per week (Maandag, Woensdag)
- Total expected: 4 × 2 = **8 activities**

If the user has completed 2 activities (2 Methodegebruik records linked):
- Progress = 2 / 8 = **25%**

## Data Sources

### Program Table (tblqW4xeCx1tprNgX)
- `duration` (fld3mrRTtqPX2a1fX): String like "4 weken", "6 weken"
- `frequency` (fldIGX4ZfG9LyYgMt): Number (count of selected days)
- `methodUsage` (fldXNUYtU4KG84ZMX): Linked Methodegebruik record IDs

### Methodegebruik Table (tblktNOXF3yPPavXU)
- Records linked to a program represent completed activities

## Acceptance Criteria

- [ ] Progress bar on HomePage "Huidig Programma" card shows activity-based progress
- [ ] Progress bar on ProgramCard (Programma's page) shows activity-based progress
- [ ] Progress percentage is calculated as: `(linked Methodegebruik count / (weeks × frequency)) × 100`
- [ ] Duration string (e.g., "4 weken") is correctly parsed to extract number of weeks
- [ ] Progress caps at 100% even if more activities are completed than expected
- [ ] Progress shows 0% when no activities are completed

## Dependencies

- Existing Methodegebruik tracking (already implemented)
- Program detail API already returns `methodUsage` field with linked record IDs

## Affected Components

- `src/pages/HomePage.tsx` - getProgress function
- `src/components/ProgramCard.tsx` - getProgress function
- `src/types/program.ts` - Program type (may need methodUsageCount)
- API endpoints may need to return activity count
