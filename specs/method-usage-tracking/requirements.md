# Requirements: Method Usage Tracking

## Overview

Track user engagement with media content (audio/video) in methods. When a user watches or listens to media, record the session and prompt for feedback. **Track usage at the Programmaplanning (scheduled session) level** to know which specific days in a program have been completed.

## User Story

As a user practicing mental fitness methods, I want my media consumption to be tracked at the **scheduled session level** so that I can see which planned days I've completed and track my actual progress through the program.

## Data Model

### Key Relationships

```
Program (Mentale Fitnessprogramma's)
  └── Programmaplanning[] (scheduled sessions)
        ├── date (specific date)
        ├── dayOfWeek (link to Days)
        ├── methods[] (planned methods for this session)
        └── methodUsage[] (completed Method Usage records)

Method Usage (Methodegebruik)
  ├── user (link to User)
  ├── method (link to Method)
  ├── programmaplanning (link to Programmaplanning) ← preferred
  ├── program (link to Program) ← legacy fallback
  ├── usedAt (date)
  └── remark (feedback text)
```

### Why Programmaplanning-level tracking?

1. **Granular progress**: Know exactly which scheduled days are done vs. pending
2. **Accurate progress calculation**: Progress = completed sessions / total sessions
3. **Clear UI**: Show checkmarks on completed days in the program schedule
4. **Method validation**: Verify the method completed matches what was planned

## Functional Requirements

### Media Progress Tracking

1. **Track playback progress**: Monitor how much of each audio/video file the user has consumed
2. **97% completion threshold**: When a user pauses near the end (97%+), mark the session as "finished"
3. **Persist across sessions**: If user pauses and returns, resume from where they left off

### Session Recording

1. **Create usage record**: When media is marked as finished (97%+), create a record in Method Usage table (tblktNOXF3yPPavXU)
2. **Link to user**: Associate the usage record with the current authenticated user
3. **Link to method**: Associate the usage record with the method being practiced
4. **Link to Programmaplanning**: If accessed from a program schedule, link the usage to that specific Programmaplanning record
5. **Record timestamp**: Store when the session was completed (Gebruikt op)

### Programmaplanning Context

When navigating to a method from a program's schedule:
1. Pass the `programmaplanningId` via navigation state
2. Method Usage record links to this specific Programmaplanning
3. The Programmaplanning.methodUsage field gets updated (Airtable linked field)

### User Feedback

1. **Prompt after completion**: When media finishes playing (or reaches 97%+), show a feedback modal
2. **Single input field**: Ask user for their feedback/remarks (Opmerking field)
3. **Optional submission**: User can skip or submit feedback
4. **Save feedback**: Store the remark in the Method Usage record

## Non-Functional Requirements

- Progress should be tracked client-side using HTML5 media events
- API calls should only be made when session is completed (not during playback)
- Feedback modal should be non-intrusive but visible
- Works for both audio and video content
- Programmaplanning context passed via React Router navigation state

## Acceptance Criteria

- [ ] When I play a video/audio and pause at 97%+, it's marked as completed
- [ ] A record appears in Method Usage table with my user, the method, and timestamp
- [ ] After media ends, I see a feedback prompt
- [ ] I can submit or skip the feedback
- [ ] My feedback appears in the Opmerking field if submitted
- [ ] When clicking a method from a program schedule, the usage is linked to that **Programmaplanning** record
- [ ] The Programmaplanning.methodUsage field shows the linked Method Usage record
- [ ] When clicking a method from Methods tab (no program context), no Programmaplanning link is set
- [ ] Progress calculation in activity-based-progress uses completed Programmaplanning count

## Reward Awarding on Method Usage (2026-02-27)

When a method usage is recorded, the method usage handler now triggers reward awarding:
- The handler calls `awardRewardActivity` after successfully recording the usage
- Points awarded are read from the method record's `points_value` field (`Punten waarde` / Airtable field ID: `fldcyKMc8Q02H2QGN`)
- Point values range from 1-10 per method (variable, not flat)
- On award failure, `pointsAwarded` returns 0 (silent failure) instead of throwing

## Dependencies

- Existing MethodDetailPage with MediaPlayer component
- Authenticated user context (AuthContext)
- Airtable Method Usage table (tblktNOXF3yPPavXU)
- Airtable Programmaplanning table (tbl2PHUaonvs1MYRx)
- React Router navigation state for Programmaplanning context

## Related Tables

### Method Usage (tblktNOXF3yPPavXU)
| Field | ID | Description |
|-------|-----|-------------|
| Gebruiker | `fldlJtJOwZ4poOcoN` | User link |
| Methode | `fldPyWglLXgXVO0ru` | Method link |
| Programmaplanning | `fld???` | Preferred link to Programmaplanning |
| Gebruikt op | `fldvUGcgnwuux1bvi` | Date |
| Opmerking | `fldpskQnKFWDFGRFk` | Feedback text |

> **Note**: `programmaplanning` is preferred for schedule-accurate tracking. `program` can still be accepted as a legacy fallback path.

### Programmaplanning (tbl2PHUaonvs1MYRx)
| Field | ID | Description |
|-------|-----|-------------|
| Planning ID | `fldufZbBLil7jDKnj` | Unique identifier |
| Mentale Fitnessprogramma | `fldTPzVYhmSBxYRa3` | Link to parent Program |
| Datum | `fldvqnZDdjaVxB25H` | Scheduled date |
| Dag van de week | `fldxC8uxRqMdS7InU` | Link to Day |
| Beoogde methodes | `fldxQn8r2ySIFs4pg` | Methods planned for this session |
| Methodegebruik | `fldoxGlLYZ5NI60hl` | Link to Method Usage (completed) |

## Migration Notes

### Airtable Changes Required

1. **Method Usage table**: Ensure Programmaplanning link exists and is used when available
2. **Verify bidirectional link**: Programmaplanning.methodUsage should auto-update when Method Usage links to it

### Code Changes

1. Prioritize `programmaplanning` in `METHOD_USAGE_FIELDS` and request payloads
2. Keep `programId` support as a legacy fallback while migration remains
3. Update navigation state to pass `programmaplanningId`
4. Update MethodDetailPage to receive and use `programmaplanningId`
