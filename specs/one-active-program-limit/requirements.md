# Requirements: One Active Program Limit

## Overview

Users should only be able to have **one active (running) program at a time**. This prevents confusion, simplifies the user experience, and ensures focused mental fitness training.

## Business Rationale

- **Focus**: Users should commit to one program and complete it before starting another
- **Clarity**: Prevents overlapping schedules and conflicting daily activities
- **Simplicity**: Easier to track progress and display relevant information
- **Alignment**: Matches the mental fitness training philosophy (like physical training - one program at a time)

## Functional Requirements

### FR-1: Block New Program Creation
- When a user has a program with status "running", they cannot create a new program
- Display a clear message explaining why they cannot create a new program
- Offer options: complete current program, or edit it if it's not a good fit

### FR-2: Program Status Definitions
- **Planned**: Program created but start date is in the future
- **Running**: Program is currently active (between start and end date)
- **Finished**: Program end date has passed

### FR-3: User Feedback
- Show which program is currently active
- Provide link to view/edit the active program
- Explain that only one program can be active at a time

## Acceptance Criteria

- [ ] User with a running program cannot start the AI Program Wizard
- [ ] User with a running program sees a message explaining the limitation
- [ ] User is directed to their current program from the blocked state
- [ ] User with only planned or finished programs can create new programs
- [ ] API validates and rejects program creation if user has running program

## Dependencies

- Existing program status logic in `src/types/program.ts`
- Program creation flow in `src/components/AIProgramWizard.tsx`
- Programs API endpoints

## Out of Scope

- Multiple program management (future feature)
- Program archiving
- Program deletion
