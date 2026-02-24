# APP Review Plan (2026-02-20)

## Context
This plan tracks follow-up work from the implementation review of:
- `specs/personal-goal-scheduling/requirements.md`
- `specs/personal-goal-scheduling/implementation-plan.md`
- `specs/cache-busting-strategy/requirements.md`

Related specs:
- `specs/personal-goals/requirements.md`
- `specs/push-notifications/requirements.md`
- `specs/postgres-airtable-async-sync/requirements.md`

## Scope
Primary mode is standardized on `postgres_primary`, but we will close parity gaps so Airtable mode remains functionally consistent and safe as a fallback.

## Findings To Address
1. Completed-goal lifecycle UI is incomplete (no completed section/reactivation flow).
2. Airtable mode lacks scheduling parity (`scheduleDays` create/update/read behavior).
3. Airtable mode lacks lifecycle parity for `?include=voltooid`.
4. Scheduling-related i18n keys exist but are not wired in UI.
5. Cache header policy for `index.html` should be explicit for `/` and `/index.html`, not only SPA fallback.

## Gap Coverage Checklist
- [ ] Gap 1 covered: completed goals are visible, collapsible, and reactivatable.
- [ ] Gap 2 covered: Airtable create/update/read supports `scheduleDays` end-to-end.
- [ ] Gap 3 covered: Airtable list supports `include=voltooid`.
- [ ] Gap 4 covered: scheduling/lifecycle UI strings use i18n keys (NL/FR/EN).
- [ ] Gap 5 covered: explicit no-cache headers on `/` and `/index.html`.
- [ ] Test gap covered: regression tests added for lifecycle split/reactivation.
- [ ] Test gap covered: regression tests added for Airtable parity paths.
- [ ] Test gap covered: header tests added for app shell + SW routes.

## TODO Plan

### P0: Complete personal goal lifecycle UX (spec parity)
- Add API client support for completed-goal retrieval:
  - Extend `api.personalGoals.list(...)` with optional `include` param.
  - Pass `include=voltooid` when needed from a dedicated query hook.
- Add completed-goals UI on account page:
  - Render a collapsed section for `Voltooid` goals.
  - Add `Opnieuw activeren` action (`status: Actief`).
  - Keep active list unchanged for existing behavior.
- Ensure optimistic/invalidation behavior for both active and completed lists.
- Add tests:
  - Query returns active + completed split.
  - Reactivate action moves goal back to active section.

### P0: Airtable parity for scheduling + lifecycle
- `POST /api/personal-goals` (Airtable path):
  - Validate and store `scheduleDays` into `Planningdagen` (comma-separated).
- `PATCH /api/personal-goals/[id]` (Airtable path):
  - Support partial updates for `scheduleDays` (set/clear) and keep current partial-update safety.
- `GET /api/personal-goals` (Airtable path):
  - Support `include=voltooid` similar to Postgres behavior.
  - Keep default behavior as active-only.
- Add tests for Airtable handlers:
  - Create with schedule.
  - Patch schedule set/clear.
  - List with and without `include=voltooid`.

### P1: Wire i18n keys into scheduling UI
- Replace hardcoded scheduling/lifecycle strings with translation keys:
  - PersonalGoal dialog (`scheduleOptional`, `selectDays`, `daysSelected`).
  - Personal goals section (`scheduledToday`).
  - Account page actions (`markCompleted`, confirm labels where applicable).
- Verify fallback translations for NL/FR/EN are used correctly.
- Add a basic rendering test per locale for key labels.

### P1: Cache header hardening for app shell
- In `server.ts`, enforce explicit no-cache headers for:
  - `/`
  - `/index.html`
  - (keep existing SPA fallback no-cache behavior)
- Keep immutable caching for `/assets/*` unchanged.
- Add lightweight integration checks (or route-level tests) for headers:
  - `sw.js`, `registerSW.js`, `/`, `/index.html`, `/assets/*`.

## Delivery Sequence
1. P0 lifecycle UX (Postgres path first).
2. P0 Airtable parity handlers.
3. P1 i18n wiring.
4. P1 cache header hardening + header tests.

## Exit Criteria
- All acceptance criteria in `specs/personal-goal-scheduling/requirements.md` are functionally met in both `postgres_primary` and Airtable fallback paths.
- Cache behavior in `specs/cache-busting-strategy/requirements.md` is enforced for `index.html` direct requests and fallback route.
- Tests cover new behavior and pass in CI.
