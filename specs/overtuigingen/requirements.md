# Requirements: Overtuigingen (Beliefs / Mindset)

## What

Add a complete "Overtuigingen" (Beliefs) feature to the Mental Fitness app. Overtuigingen are positive mindset statements that users practice at 3 progressive levels. They are linked to goals via Mindset Categories, and users practice them as part of their program alongside methods and personal goals.

## Why

The current app focuses on methods (exercises) and personal goals, but lacks a mindset/beliefs component. Mental fitness programs benefit from a structured belief-practice system where users internalize positive beliefs through repeated, progressive practice. This adds the "mindset" pillar alongside the existing "methods" and "habits" pillars.

## Core Concepts

- **Overtuiging**: A belief/conviction statement (e.g., "Ik ben in staat om met stress om te gaan"). Has a name, description, optional order field.
- **Mindset Categorie**: Groups overtuigingen by theme (e.g., "Stressmanagement", "Zelfvertrouwen"). Each category links to Doelstellingen (goals).
- **Persoonlijke Overtuiging**: User-created custom belief, linked to a program.
- **Overtuigingen Gebruik**: Tracks each practice of a belief at a specific level (1, 2, or 3). Sequential progression required.

## Level Progression

- Level 1: First practice (reading/understanding)
- Level 2: Requires Level 1 completed (deeper engagement)
- Level 3: Requires Level 2 completed (internalization)
- Each level completion awards +1 bonus point via the existing rewards system

## User Flows

### Browse Overtuigingen
- New "Mindset" tab in bottom navigation (5th tab, between Methodes and Account)
- Browse page with search + goal filter chips (same pattern as Methods page)
- Card list: Name, Category subtitle, Level tags (colored circles)
- No photos (unlike methods)

### Program Wizard Integration
- New step inserted after Goals step (becomes step 2)
- Auto-selects up to 3 overtuigingen based on selected goals (via category → goal link)
- User can toggle selection
- Selected overtuigingen saved to program

### Home Page Practice
- OvertuigingenSection shows active overtuigingen for running program
- Level progress visualization (3 circles for levels 1/2/3)
- Check-off button advances to next level
- Also shows personal overtuigingen with simple check-off

### Program Detail
- OvertuigingenSection showing progress
- Option to add more overtuigingen from the pool

## Acceptance Criteria

1. All 4 new Airtable tables have correct field mappings and transforms
2. Browse page shows all overtuigingen with search and goal filtering
3. Overtuigingen linked to goals via Mindset Categories → Doelstellingen
4. Program wizard suggests up to 3 overtuigingen based on selected goals
5. Home page shows active overtuigingen with level progress
6. Users can check off levels sequentially (1 → 2 → 3)
7. Each level completion awards +1 bonus point
8. Users can add/manage personal overtuigingen
9. `npm run build` passes with zero errors
10. All existing tests continue to pass

## Dependencies

- Airtable tables must be created manually before coding begins
- Field IDs must be recorded via Airtable Meta API
- Existing tables: Overtuigingen, Mindset Categorien (already exist in Airtable)
- New table: Overtuigingen Gebruik (must be created)
- Modified tables: Programs (add overtuigingen link), Persoonlijke Overtuigingen (add program link + fields)

## Related Features

- Personal Goals (`specs/personal-goals/`) - same pattern for personal overtuigingen
- Rewards system (`api/rewards/award.ts`) - extended with "overtuiging" activity type
- Program Wizard (`src/components/ProgramWizard/`) - new step added
