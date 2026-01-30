# Header Points Display (Streak Only)

The header now displays only the streak count, not total points.

## Overview

Previously, the header displayed both total points and streak. With the introduction of split score widgets on the home page, total points were removed from the header to reduce clutter and avoid redundancy.

## Current Display

**Format**: 🔥12

- Shows only when user has a streak > 0
- Compact pill design
- Fire emoji + streak number

## Component

**File**: `src/components/rewards/PointsDisplay.tsx`

```typescript
export function PointsDisplay() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading || !rewards) {
    return null
  }

  // Only show if user has a streak
  if (rewards.currentStreak === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 text-sm font-medium">
      <span className="flex items-center gap-0.5">
        <span>🔥</span>
        <span>{rewards.currentStreak}</span>
      </span>
    </div>
  )
}
```

## Previous Display

**Before**: `450 ⭐ | 🔥12`
- Showed total points with star icon
- Showed streak with fire icon
- Separated by pipe

**After**: `🔥12`
- Only streak
- No total points
- No separator

## Rationale for Change

### Why Remove Total Points?

1. **Redundancy**: Score widgets on home page show detailed scores
2. **Clarity**: Split scores (Mental Fitness, Personal Goals, Habits) are more meaningful than one total
3. **Mobile space**: Header is limited on mobile devices
4. **Focus**: Streak is a daily engagement metric, more relevant for header visibility

### Why Keep Streak?

1. **Motivation**: Daily streak visible across all pages
2. **Urgency**: Reminds user to stay active
3. **Compact**: Single number with emoji
4. **Gamification**: Fire emoji is visually engaging

## Display Behavior

### States

| State | Display |
|-------|---------|
| No streak (0) | Nothing (null) |
| Streak = 1 | 🔥1 |
| Streak = 7 | 🔥7 |
| Streak = 365 | 🔥365 |
| Loading | Nothing (null) |
| Error | Nothing (null) |

### No Zero State

Unlike the old implementation, we don't show "🔥0" when there's no streak. This keeps the header clean.

## Integration

### AppHeader Component

```tsx
<header>
  <div className="logo">...</div>
  <PointsDisplay />  {/* Only shows if streak > 0 */}
  <UserMenu />
</header>
```

### Positioning

- Desktop: Right side of header, before user menu
- Mobile: Same position, compact size

## Styling

```css
.points-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: hsl(var(--muted) / 0.5);
  font-size: 0.875rem;
  font-weight: 500;
}
```

## Data Source

**API**: GET /api/rewards
**Hook**: `useUserRewards()`

```typescript
const { data: rewards } = useUserRewards()
// rewards.currentStreak
```

## Related Components

### Score Widgets (HomePage)

The three score widgets on the home page now provide the detailed breakdown:
- Mental Fitness Score
- Personal Goals Score
- Good Habits Score

**Total Points** can still be calculated by the frontend if needed:
```typescript
const totalPoints = rewards.mentalFitnessScore +
                    rewards.personalGoalsScore +
                    rewards.goodHabitsScore
```

But this is not displayed in the UI.

### RewardsSummary (AccountPage)

The account page still shows comprehensive rewards information including:
- All three scores
- Current level
- Badges
- Total points (if needed)

## Migration Notes

### Old Code (Removed)

```typescript
// Before: Showed both points and streak
return (
  <div className="flex items-center gap-2">
    <span>{rewards.totalPoints} ⭐</span>
    <span className="text-muted-foreground">|</span>
    <span>🔥{rewards.currentStreak}</span>
  </div>
)
```

### New Code (Current)

```typescript
// After: Only streak, only if > 0
if (rewards.currentStreak === 0) {
  return null
}

return (
  <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50">
    <span className="flex items-center gap-0.5">
      <span>🔥</span>
      <span>{rewards.currentStreak}</span>
    </span>
  </div>
)
```

## User Feedback

### Expected User Questions

**Q: Where did my total points go?**
A: Check the score widgets on the home page for a detailed breakdown.

**Q: Why don't I see anything in the header?**
A: The header only shows your streak if you have one. Complete an activity to start your streak.

**Q: How do I see my level?**
A: Go to your account page for full rewards details including level, badges, and history.

## Accessibility

- Emoji is decorative (no alt text needed)
- Text is readable (14px font size)
- Color contrast meets WCAG AA standards
- Screen readers announce the streak number

## Future Considerations

Potential enhancements:
- Animate fire emoji when streak increases
- Different emoji for milestone streaks (🔥🔥 for 30+ days)
- Tap to view streak history
- Streak goal reminders
