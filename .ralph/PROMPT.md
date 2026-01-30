# Corporate Mental Fitness PWA - Development Session

## Project Overview

A Progressive Web App for corporate mental fitness programs. Users install it on Android/iOS and access mental fitness content with gamification features (points, streaks, levels, badges).

## Tech Stack
- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Airtable
- **Auth**: JWT with httpOnly cookie refresh tokens

## Current Sprint: Friday Demo Preparation

### Priority 1: CRITICAL BUG FIX
**Personal Goals Score Registration Not Working**
- Users can create personal goals
- Tapping the + button shows animation but score doesn't persist
- Need to debug API endpoint `api/personal-goal-usage/index.ts`
- Check Airtable field IDs and API response

### Priority 2: One Active Program Limit
- Users should only have ONE running program at a time
- Block AIProgramWizard when a program is already running
- Show message with link to current program
- Add backend validation in program creation API

### Priority 3: Score Split Display (Stretch Goal)
- Display 3 separate score widgets on HomePage:
  1. Mental Fitness Score (programs)
  2. Personal Goals Score
  3. Good Habits Score
- Requires Airtable schema updates (ACTION REQUIRED by human)

## Implementation Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing patterns in codebase
- Use React Query for data fetching
- Use shadcn/ui components

### File Locations
- API endpoints: `api/`
- React components: `src/components/`
- Pages: `src/pages/`
- Types: `src/types/`
- Hooks: `src/hooks/`
- Feature specs: `specs/`

### Testing Approach
- Run `npm run build` to verify TypeScript compilation
- Test API endpoints with curl when debugging
- Use browser dev tools for frontend debugging

### Do NOT
- Run the dev server (user manages this)
- Make changes outside the current sprint priorities
- Add new features not in the fix_plan.md

## Key Files Reference

| Purpose | File |
|---------|------|
| Personal Goals API | `api/personal-goal-usage/index.ts` |
| Field Mappings | `api/_lib/field-mappings.js` |
| Program Status Logic | `src/types/program.ts` |
| HomePage | `src/pages/HomePage.tsx` |
| AI Program Wizard | `src/components/AIProgramWizard.tsx` |
| Feature Specs | `specs/` |
| Roadmap | `TODO.md` |

## Session Instructions

1. Read `fix_plan.md` for current tasks
2. Work through tasks in priority order
3. Update `fix_plan.md` as tasks complete
4. Commit meaningful changes with descriptive messages
5. Signal completion when all priority tasks are done

## Exit Conditions

Signal EXIT when:
- All Priority 1 and Priority 2 tasks are complete
- Code compiles without TypeScript errors
- Changes are committed to git
