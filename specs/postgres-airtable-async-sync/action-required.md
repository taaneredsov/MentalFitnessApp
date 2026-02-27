# Action Required: Postgres Primary DB + Async Airtable Sync

Manual tasks that must be completed by a human.

## Outstanding

- [ ] **Tune worker concurrency** - Adjust throughput while staying within Airtable API limits.
- [ ] **Document operational SOP** - Update incident, backup, and replay procedures.
- [ ] **Configure users safety poll** - Set fallback poll interval for users (recommended 60s) in case webhooks are delayed.
- [ ] **Set users availability alerts** - Alert when user provisioning exceeds SLO (p95 > 15s or p99 > 60s).
- [ ] **Add sync observability targets** - Confirm where queue depth, sync lag, and error metrics are collected.

## Completed

- [x] Provision PostgreSQL with automated backups.
- [x] Create DB users for API runtime and migrations.
- [x] Add secrets to deployment (`DATABASE_URL`, queue config).
- [x] Agree data authority matrix.
- [x] Configure user fast-lane webhook (shared-secret auth, `x-sync-secret` header).
- [x] Staging sign-off and data reconciliation.
- [x] All endpoints switched to Postgres-only (toggle system removed).
- [x] Reference data endpoints use Postgres (goals, days, mindset categories, companies).
- [x] Auth works without Airtable (magic link codes in Postgres).
- [x] AI program generation uses Postgres reference data.
- [x] Dead-letter auto-replay implemented.
- [x] `enqueueSyncEventSafe()` fire-and-forget wrapper.
- [x] User webhook simplified to shared-secret auth.
- [x] Migrations 001-013 applied.
- [x] Data backend toggle system fully removed.
