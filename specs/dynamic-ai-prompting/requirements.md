# Requirements: Dynamic AI Prompting

## Overview

AI program generation prompts are data-driven and stored in the database-backed reference layer, with Airtable as source-of-truth and Postgres cache tables for resilience.

## Current Implementation

1. Prompt content is modeled in Airtable table `programPrompts` (`tables.programPrompts`).
2. Prompt records are synced into Postgres reference table `reference_program_prompts_pg`.
3. Experience level records are synced into `reference_experience_levels_pg`.
4. Program generation loads prompts through `loadProgramGenerationData()` and builds runtime system prompts and goal-specific prompt blocks.
5. If Postgres load fails, the code falls back to direct Airtable reads.

## Verified Evidence

- Migration for prompt/expertise reference tables:
  - `tasks/db/migrations/013_reference_prompts_experience_levels.sql`
- Prompt loading and processing:
  - `api/_lib/program-generation-data.ts`
- Prompt table mapping and field transforms:
  - `api/_lib/field-mappings.js`
- Prompt usage in AI generation endpoints:
  - `api/programs/preview.ts`
  - `api/programs/generate.ts`

## Status

Implemented and part of the current app.
