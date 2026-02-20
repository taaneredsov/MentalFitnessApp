# Action Required: Postgres Intermediate DB + Async Airtable Sync

Manual tasks that must be completed by a human. These cannot be fully automated.

## Before Implementation

- [ ] **Provision PostgreSQL** - Create production and staging Postgres instances (or databases) with automated backups.
- [ ] **Create DB users** - Create separate users/roles for API runtime and migration tasks.
- [ ] **Add secrets to deployment** - Add `DATABASE_URL`, `DATABASE_URL_STAGING`, and any queue-related secrets.
- [ ] **Approve network access** - Ensure runtime can connect securely to Postgres (TLS enabled).
- [ ] **Set migration policy** - Decide whether schema migrations run in CI/CD or manually during deploy.
- [ ] **Agree data authority matrix** - Confirm which tables are Airtable-authoritative vs Postgres-authoritative.

## During Implementation

- [ ] **Create Airtable webhook/polling credentials** - Configure inbound sync mechanism and secret verification.
- [ ] **Add sync observability targets** - Confirm where queue depth, sync lag, and error metrics are collected.
- [ ] **Create dead-letter runbook owner** - Assign ownership for replay/triage of failed sync events.
- [ ] **Prepare backfill window** - Schedule initial import and data validation window for staging and production.
- [ ] **Configure users fast-lane webhook** - Ensure Airtable `users` create/update events are routed to high-priority inbound processing.
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

## After Cutover

- [ ] **Review Airtable automations** - Update or disable automations now replaced by Postgres-side logic.
- [ ] **Tune worker concurrency** - Adjust throughput while staying within Airtable API limits.
- [ ] **Document new operational SOP** - Update incident, backup, and replay procedures.

---

> Note: Keep this checklist aligned with `implementation-plan.md` as tasks are completed.
