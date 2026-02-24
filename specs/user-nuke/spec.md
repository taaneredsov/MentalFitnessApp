# User Nuke — Delete User & All Associated Data

## Endpoint

`POST /api/account/nuke`

- **Auth**: Bearer token (JWT) — `requireAuth(req)`
- **Input**: None (user ID comes from token)
- **Guard**: Returns 503 if Postgres is not configured (`isPostgresConfigured()`)
- **Output**: `{ success: true, data: { deleted: { postgres: { ... counts }, airtableEventsQueued: number } } }`

## Deletion Logic

All Postgres deletes run in a single transaction for atomicity.

### Step 1: Pre-collect entity IDs for Airtable cleanup
Before any deletes, gather IDs that have Airtable counterparts:
- User's Airtable record ID = `users_pg.id` (it IS the Airtable record ID)
- Program IDs from `programs_pg WHERE user_id = $1`
- Personal goal IDs from `personal_goals_pg WHERE user_id = $1`
- Look up Airtable record IDs from `airtable_id_map` for programs & goals

### Step 2: Manual deletes (tables WITHOUT ON DELETE CASCADE)
```sql
DELETE FROM magic_link_codes WHERE user_id = $1;
DELETE FROM overtuiging_usage_pg WHERE user_id = $1;
DELETE FROM persoonlijke_overtuigingen_pg WHERE user_id = $1;
```

### Step 3: Delete user row (CASCADE handles the rest)
```sql
DELETE FROM users_pg WHERE id = $1;
```
Auto-cascades: programs_pg, program_schedule_pg, method_usage_pg, habit_usage_pg, personal_goals_pg, personal_goal_usage_pg, push_subscriptions_pg, notification_preferences_pg, notification_jobs_pg, notification_delivery_log_pg.

### Step 4: Cleanup sync/mapping tables
```sql
DELETE FROM sync_outbox WHERE entity_id = ANY($1::text[]);
DELETE FROM sync_dead_letter WHERE entity_id = ANY($1::text[]);
DELETE FROM airtable_id_map WHERE postgres_id = ANY($1::text[]);
```

### Step 5: Enqueue Airtable deletes (outside transaction)
For each collected Airtable entity, enqueue `enqueueSyncEvent()` with `eventType: 'delete'`:
- User record → entity type `user` (userId IS the Airtable record ID — destroyed directly)
- Program records → entity type `program` (uses Airtable record IDs from `airtable_id_map` collected in Step 1)
- Personal goal records → entity type `personal_goal` (same)

Events are enqueued with `priority: 10` (high priority) and `reason: "user-nuke"` in payload. Failures are caught per-event and logged — they don't block the endpoint response.

## Airtable Delete Handling

The `deleteByEntity()` function in `airtable-writers.ts` was extended to handle `entityType: "user"`:
- User IDs are Airtable record IDs — calls `base(tables.users).destroy(entityId)` directly (no `airtable_id_map` lookup)
- All other entity types use the existing `findAirtableId()` → `destroy()` flow

### Edge case: running nuke on both production and local
If you nuke a user on production first (Airtable records get deleted), then nuke the same user locally:
- The Postgres transaction succeeds normally (independent databases)
- The Airtable delete events enqueued locally will either:
  - No-op silently if `findAirtableId()` returns null (map already cleaned up)
  - Fail with a 404 from Airtable API if the map still had entries → retries → dead letter (non-blocking)
- The endpoint itself never errors from this — Airtable event queuing is fire-and-forget

## Files
- `specs/user-nuke/spec.md` — this file
- `api/account/nuke.ts` — POST endpoint handler (with `isPostgresConfigured()` guard)
- `api/_lib/repos/user-nuke-repo.ts` — Postgres deletion + Airtable event queuing
- `api/_lib/sync/airtable-writers.ts` — Added `user` case to `deleteByEntity()`
- `server.ts` — route registration
