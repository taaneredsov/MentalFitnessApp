# Ralph Loop Instructions

## Mission

Implement the tasks in `TODO.md` and `.ralph/fix_plan.md`. You have full API access to create Airtable fields if needed.

## Working Method

1. **Read Current State**: Check `TODO.md` and `.ralph/fix_plan.md` for priorities
2. **Work Systematically**: Complete tasks in priority order
3. **Invoke Specialists**: Use specialized agents when appropriate:
   - `elite-software-engineer` for complex implementation
   - `elite-code-reviewer` after significant changes
   - `security-auditor` for auth/data handling changes
   - `elite-documentation-expert` to document all changes
4. **Update Progress**: Mark tasks complete in fix_plan.md as you finish them
5. **Document Changes**: Ensure documentation-expert documents all new features

## Current Sprint Priorities

### Priority 1: CRITICAL BUG
Fix Personal Goals score registration - completions not saving to Airtable.

### Priority 2: Feature
Implement one-active-program limit - users can only have one running program.

### Priority 3: STRETCH
Score split display - 3 separate score widgets on HomePage (requires Airtable schema changes).

## Technical Context

- **Stack**: React 19 + Vite + TypeScript + Vercel Serverless + Airtable
- **Feature Specs**: Located in `specs/` folder
- **Field Mappings**: `api/_lib/field-mappings.js`
- **Build Check**: `npm run build` (must pass before committing)

## Airtable API Access

You can create fields directly using credentials from `.env.local`:
```bash
source .env.local
# AIRTABLE_ACCESS_TOKEN and AIRTABLE_BASE_ID are now available
```

## Exit Conditions

Signal EXIT_SIGNAL: true when:
- Priority 1 (bug fix) is complete and verified
- Priority 2 (one active program) is complete
- All changes compile without errors
- Changes are committed and pushed
- Documentation is updated

## Do NOT

- Run the dev server (user manages externally)
- Skip documentation updates
- Leave TypeScript errors
- Make changes outside current sprint scope
