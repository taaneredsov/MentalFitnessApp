# Implementation Review: User Provisioning Read-Through + Airtable Webhook

Date: 2026-02-20

## Findings

1. **High: Disabled/deleted users can still refresh sessions**
- `api/auth/login.ts:41` correctly blocks non-`active` users.
- `api/auth/refresh.ts:32` issues new tokens without checking `status`.
- `api/auth/me.ts:29` also returns user payload without status enforcement.
- Impact: after `user.deleted` webhook (`status='deleted'`), existing refresh-token holders can continue to get fresh access tokens.

2. **High: Webhook signature verification is not based on raw request bytes**
- `api/sync/users/inbound.ts:55` verifies signature against `JSON.stringify(req.body)` when parsed object is present.
- Express JSON middleware runs globally (`server.ts:29`), so canonical bytes are already lost.
- Impact: valid sender signatures over raw JSON may fail verification; verification is brittle and serializer-order dependent.

3. **High: Signature format mismatch with documented `sha256=<hex>` header**
- Docs require `X-Signature: sha256=<hex>` (`specs/user-provisioning-readthrough-webhook/action-required.md:23`).
- Verifier compares header value directly to raw hex digest (`api/_lib/sync/webhook-auth.ts:4`).
- `api/sync/users/inbound.ts:49` passes header value unchanged.
- Impact: documented signing format will be rejected.

4. **Medium: Config mismatch between docs and implementation for read-through flag**
- Action doc specifies `USER_READTHROUGH_ENABLED` (`specs/user-provisioning-readthrough-webhook/action-required.md:8`).
- Implementation uses `USER_READTHROUGH_FALLBACK_ENABLED` (`api/_lib/sync/user-readthrough.ts:6`).
- Impact: operators may set the wrong flag and assume read-through is enabled/disabled when it is not.

5. **Medium: Webhook feature flag default in env example contradicts plan**
- Plan says webhook flag defaults off (`specs/user-provisioning-readthrough-webhook/implementation-plan.md:44`).
- `.env.example` sets `USER_WEBHOOK_SYNC_ENABLED=true` (`.env.example:76`).
- Impact: unintended enablement in some environments.

6. **Medium: Missing tests for new critical paths**
- No tests found for:
  - `/api/sync/users/inbound` auth/idempotency/signature handling
  - read-through provisioning behavior in login/refresh/me
  - deleted-user refresh rejection
- Existing passing tests only covered unrelated existing suites (`user-repo`, `outbox`).
- Impact: regressions likely in auth/webhook security edge cases.

## Validation Performed
- Reviewed implementation files for auth, read-through, webhook, routing, and migration.
- Ran:
  - `npm run test:run -- api/_lib/repos/__tests__/user-repo.test.ts api/_lib/sync/__tests__/outbox.test.ts` (pass)
  - `npm run build:server` (pass)

## Notes
- Schema changes for canonical email uniqueness and user status are present (`tasks/db/migrations/009_user_status_and_email_index.sql`).
- Route wiring for `/api/sync/users/inbound` is present (`server.ts:194`).
