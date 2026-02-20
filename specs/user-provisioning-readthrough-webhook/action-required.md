# Action Required: User Provisioning Read-Through + Airtable Webhook

## Before Deploy

### 1. Environment Variables
Set on production/staging:
- `AIRTABLE_USER_SYNC_SECRET=<strong-random-secret>`
- `USER_READTHROUGH_FALLBACK_ENABLED=true` (already set)
- `USER_WEBHOOK_SYNC_ENABLED=true`

### 2. Docker Secret
Create on the server before deploying:
```bash
echo -n "<secret>" | docker secret create mfa_airtable_user_sync_secret -
```
Note: adding a new secret requires `docker stack rm mfa` + redeploy.

### 3. Airtable Automation
Configure Airtable automation to POST to:
- `https://mfa.drvn.be/api/sync/users/inbound`

Include:
- `eventId` (stable unique id per event)
- `eventType` (`user.created`, `user.updated`, `user.deleted`)
- `occurredAt`
- `user` payload (id, email, name, role?, languageCode?, passwordHash?)

### 4. Signing
Send signature header:
- `X-Signature: <hex-hmac>`

Signing input:
- raw request body (exact bytes)
- HMAC SHA-256 using `AIRTABLE_USER_SYNC_SECRET`
- Output: lowercase hex digest (no prefix)

### 5. Database Migration
Runs automatically on deploy. Adds:
- Canonical email uniqueness index (`LOWER(email)`)
- `status` column on `users_pg` (default `active`)

## Post-Deploy Verification
1. Create a user in Airtable only.
2. Attempt immediate login in app.
3. Confirm:
   - Login succeeds.
   - User appears in `users_pg`.
4. Send webhook update event and verify user updates in Postgres.
5. Replay same `eventId`; verify no duplicate side effects.
6. Set user to "Geen toegang" in Airtable; verify login is blocked (403).
7. Verify existing refresh tokens for disabled users are rejected.
