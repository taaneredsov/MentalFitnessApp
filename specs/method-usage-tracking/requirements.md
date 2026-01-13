# Requirements: Method Usage Tracking

## Overview

Track user engagement with media content (audio/video) in methods. When a user watches or listens to media, record the session and prompt for feedback. When accessed from a program, link the usage to that program.

## User Story

As a user practicing mental fitness methods, I want my media consumption to be tracked so that I can see my progress and the system knows which sessions I've completed as part of my program.

## Functional Requirements

### Media Progress Tracking

1. **Track playback progress**: Monitor how much of each audio/video file the user has consumed
2. **80% completion threshold**: When a user reaches 80% of media duration, mark the session as "finished"
3. **Persist across sessions**: If user pauses and returns, resume from where they left off

### Session Recording

1. **Create usage record**: When media is marked as finished (80%), create a record in Method Usage table (tblktNOXF3yPPavXU)
2. **Link to user**: Associate the usage record with the current authenticated user
3. **Link to method**: Associate the usage record with the method being practiced
4. **Link to program**: If accessed from a program (HomePage or ProgramDetailPage), link the usage to that program
5. **Record timestamp**: Store when the session was completed (Gebruikt op)

### User Feedback

1. **Prompt after completion**: When media finishes playing (or reaches 80%), show a feedback modal
2. **Single input field**: Ask user for their feedback/remarks (Opmerking field)
3. **Optional submission**: User can skip or submit feedback
4. **Save feedback**: Store the remark in the Method Usage record

## Non-Functional Requirements

- Progress should be tracked client-side using HTML5 media events
- API calls should only be made when session is completed (not during playback)
- Feedback modal should be non-intrusive but visible
- Works for both audio and video content
- Program context passed via React Router navigation state

## Acceptance Criteria

- [x] When I play a video/audio to 80%, it's marked as completed
- [x] A record appears in Method Usage table with my user, the method, and timestamp
- [x] After media ends, I see a feedback prompt
- [x] I can submit or skip the feedback
- [x] My feedback appears in the Opmerking field if submitted
- [x] When clicking a method from a program, the usage is linked to that program

## Dependencies

- Existing MethodDetailPage with MediaPlayer component
- Authenticated user context (AuthContext)
- Airtable Method Usage table (tblktNOXF3yPPavXU)
- React Router navigation state for program context

## Related Tables

- **Method Usage (tblktNOXF3yPPavXU)**
  - Gebruiker (User link) - `fldlJtJOwZ4poOcoN`
  - Methode (Method link) - `fldPyWglLXgXVO0ru`
  - Mentale Fitnessprogramma's (Program link) - `fld18WcaPR8nXNr4a`
  - Gebruikt op (Date) - `fldvUGcgnwuux1bvi`
  - Opmerking (Text) - `fldpskQnKFWDFGRFk`
