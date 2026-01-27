# Requirements: AI-Assisted Program Creation Flow

## Overview

Enable users to create personalized mental fitness programs using AI (OpenAI GPT-4o). The AI generates a schedule with specific methods assigned to specific days based on user goals, available time, and prompt instructions from Airtable.

## Problem Statement

Currently, program creation relies on Airtable automations to suggest methods after goals are selected. This process:
- Requires polling and waiting for automation
- Doesn't provide day-specific method assignments
- Lacks personalized recommendations

## Solution

Replace the polling-based approach with direct AI generation that:
- Instantly generates a complete program
- Assigns specific methods to specific days
- Provides personalized recommendations
- Creates a more engaging user experience with loading animations

## User Flow

1. User clicks "Nieuw Programma" on Programs page
2. User chooses "AI Programma (Aanbevolen)" option
3. User selects one or more goals (Doelstellingen)
4. User sets start date
5. User selects program duration (1-8 weeks)
6. User selects available days of the week
7. User clicks "Genereer Mijn Programma"
8. Loading animation shows: "We zijn bezig uw mentale fitness programma samen te stellen"
9. AI generates schedule and program is created in Airtable
10. User sees result with weekly schedule and recommendations
11. User can view program details or create another

## Acceptance Criteria

### Functional Requirements

- [ ] User can select multiple goals from available Doelstellingen
- [ ] User can set a start date (minimum: today)
- [ ] User can select duration: 1 week, 2-4 weken, 6 weken, 8 weken
- [ ] User can select one or more days of the week
- [ ] All required fields must be filled before generation
- [ ] Loading animation displays during AI processing
- [ ] AI returns methods assigned to specific selected days
- [ ] Program is created in Airtable with all details
- [ ] User sees weekly schedule showing which methods on which days
- [ ] User receives personalized recommendations from AI
- [ ] User can navigate to view the created program
- [ ] User can create another program from result screen
- [ ] Error handling shows user-friendly messages

### Non-Functional Requirements

- [ ] AI generation completes within 15 seconds
- [ ] Loading animation is engaging and informative
- [ ] UI is responsive and works on mobile
- [ ] Uses existing authentication (JWT)
- [ ] Integrates with existing React Query caching

## Data Requirements

### Input Data

From user:
- Selected goal IDs (1 or more)
- Start date (ISO format)
- Duration string (e.g., "4 weken")
- Selected day of week IDs (1 or more)

From Airtable:
- Goal details and prompts from tblHmI6cSujof3KHu
- Available methods from tblB0QvbGg3zWARt4 (including "Optimale frequentie" field)
- Day names from tblS3gleG8cSlWOJ3

Calculated:
- Training dates: all specific dates across the program duration based on start date, weeks, and selected days

### Output Data

AI returns (via OpenAI Structured Outputs):
- Schedule: array of specific dates with assigned methods
- Weekly session time total
- Personalized recommendations
- Program summary

Created in Airtable:
- Program record linked to user, goals, days, methods
- Methods field contains all unique methods from schedule
- Programmaplanning records for each training date (tbl2PHUaonvs1MYRx)
  - Linked to program, day of week, goals
  - Contains date, methods, and session description

## Dependencies

- OpenAI API (GPT-4o model)
- Existing Airtable integration
- Existing authentication system
- React Query for caching

## Out of Scope

- Edit program functionality (can be added later)
- Calendar integration
- Push notifications for scheduled activities
- Method reordering within days
