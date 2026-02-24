# Action Required: Postgres Intermediate DB + Async Airtable Sync

Manual tasks that must be completed by a human. These cannot be fully automated.

## Before Implementation

- [x] **Provision PostgreSQL** - Create production and staging Postgres instances (or databases) with automated backups.
- [x] **Create DB users** - Create separate users/roles for API runtime and migration tasks.
- [x] **Add secrets to deployment** - Add `DATABASE_URL`, `DATABASE_URL_STAGING`, and any queue-related secrets.
- [x] **Approve network access** - Ensure runtime can connect securely to Postgres (TLS enabled).
- [x] **Set migration policy** - Decide whether schema migrations run in CI/CD or manually during deploy.
- [x] **Agree data authority matrix** - Confirm which tables are Airtable-authoritative vs Postgres-authoritative.

## During Implementation

- [ ] **Create Airtable webhook/polling credentials** - Configure inbound sync mechanism and secret verification.
- [ ] **Add sync observability targets** - Confirm where queue depth, sync lag, and error metrics are collected.
- [ ] **Create dead-letter runbook owner** - Assign ownership for replay/triage of failed sync events.
- [ ] **Prepare backfill window** - Schedule initial import and data validation window for staging and production.
- [x] **Configure users fast-lane webhook** - Simplified to shared-secret auth (`x-sync-secret` header). Endpoint fetches user data server-side from Airtable. Airtable automation script updated (2026-02-24).
- [ ] **Configure users safety poll** - Set fallback poll interval for users (recommended 60s) in case webhooks are delayed or dropped.
- [ ] **Set users availability alerts** - Alert when user provisioning exceeds SLO (p95 > 15s or p99 > 60s).

## Before Cutover

- [x] **Staging sign-off** - Validate endpoint behavior parity and performance in staging.
- [ ] **Shadow-read verification** - Compare Airtable and Postgres responses for migrated endpoints.
- [x] **Rollback test** - Confirm feature flags can revert endpoint reads/writes safely.
- [x] **Data reconciliation check** - Validate record counts and spot-check sampled records by user/program/date.
- [x] **User provisioning drill** - Create test users in Airtable and verify login availability within fast-lane SLO.

## Go-Live Day (Completed 2026-02-20)

- [x] **Enable endpoint flags gradually** - All backends switched to `postgres_primary` (including `DATA_BACKEND_OVERTUIGINGEN` and `DATA_BACKEND_PERSOONLIJKE_OVERTUIGINGEN`, added during audit remediation 2026-02-20).
- [ ] **Watch sync lag and dead-letter queue** - Keep dashboards and logs actively monitored.
- [ ] **Capture latency baseline delta** - Record p50/p95 improvements for key endpoints.
- [ ] **Watch users fast-lane lag** - Monitor user provisioning time continuously during rollout.

## Audit Remediation (Completed 2026-02-20)

- [x] **Methods/overtuigingen Postgres routing** - `api/methods/index.ts`, `api/overtuigingen/index.ts`, `api/programs/[id]/methods`, and `api/persoonlijke-overtuigingen/index.ts` now have Postgres routing via feature flags.
- [x] **Persoonlijke overtuigingen Postgres support** - Added `persoonlijke_overtuigingen_pg` table, repo, and `DATA_BACKEND_PERSOONLIJKE_OVERTUIGINGEN` feature flag.
- [x] **Personal goals full-sync dedup fix** - `syncPersonalGoalsFromAirtable` now checks `findPostgresId` before insert to prevent duplicate rows during full sync.

## Airtable Resilience Hardening (Completed 2026-02-24)

- [x] **Reference data endpoints have Postgres paths** - Goals, days, mindset categories, and companies endpoints now route through Postgres via feature flags (`DATA_BACKEND_GOALS`, `DATA_BACKEND_DAYS`, `DATA_BACKEND_MINDSET_CATEGORIES`, `DATA_BACKEND_COMPANIES`).
- [x] **Program detail resolves names from Postgres** - `api/programs/[id].ts` uses `lookupGoalsByIds()`, `lookupMethodsByIds()`, `lookupDayNamesByIds()`, `lookupOvertuigingenByIds()` from `reference-repo.ts` instead of `fetchAirtableDetails()`.
- [x] **Auth works without Airtable** - Magic link codes stored in Postgres (`magic_link_codes` table). `magic-link.ts`, `verify-code.ts`, and `set-password.ts` have Postgres-primary paths. Read-through Airtable calls wrapped in try/catch.
- [x] **AI program generation uses Postgres reference data** - Shared `loadProgramGenerationData()` helper loads prompts, experience levels, methods, goals, days from Postgres. `generate.ts`, `preview.ts`, and `confirm.ts` all use it.
- [x] **Dead-letter auto-replay implemented** - Sync worker replays dead-letter events when Airtable recovers, throttled by `DEAD_LETTER_REPLAY_SECONDS` (default 300s).
- [x] **Outbox resilience** - `enqueueSyncEventSafe()` fire-and-forget wrapper prevents outbox failures from breaking user-facing writes.
- [x] **User webhook simplified** - `api/sync/users/inbound.ts` uses plain shared-secret (`x-sync-secret` header) instead of HMAC. Endpoint only needs `{recordId}` and fetches user data server-side.
- [x] **New migrations** - `011_reference_companies_pg.sql`, `012_magic_link_codes.sql`, `013_reference_prompts_experience_levels.sql`.

## After Cutover

- [x] **Review Airtable automations** - User webhook automation script updated for simplified shared-secret contract (2026-02-24). Remaining automations to review post-cutover.
- [ ] **Tune worker concurrency** - Adjust throughput while staying within Airtable API limits.
- [ ] **Document new operational SOP** - Update incident, backup, and replay procedures.

---

> Note: Keep this checklist aligned with `implementation-plan.md` as tasks are completed.
