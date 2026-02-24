# Security Review Report

Date: 2026-02-05
Scope: API routes in `api/`, server setup in `server.ts`, auth client in `src/contexts/AuthContext.tsx`.

## Summary
Multiple broken access control paths (IDOR) allow access or mutation of other users’ data. JWT handling has critical weaknesses (fallback secret and no token type separation). There are additional risks around onboarding, formula injection, and token storage.

## Findings

1. Critical — Weak JWT secret and token type confusion
- Evidence: `api/_lib/jwt.js`
- Details:
  - JWT secret falls back to a hardcoded string when `JWT_SECRET` is missing. Any environment misconfiguration enables token forgery.
  - Access and refresh tokens are signed with the same secret and verified by the same `verifyToken` function. Endpoints accept any valid JWT in `Authorization`, so a refresh token can be used as an access token.
- Impact: Full authentication bypass if `JWT_SECRET` is missing; refresh tokens can be replayed for API access.
- Recommended fixes:
  1. Fail fast on missing `JWT_SECRET` (throw during startup).
  2. Add a `typ` or `tokenType` claim and validate it in `verifyToken`.
  3. Consider separate secrets or key IDs for access vs refresh tokens, and validate `aud`/`iss`.

2. High — Broken access control / IDOR across multiple endpoints
- Evidence:
  - `api/programs/index.ts` (GET/POST missing auth/ownership checks)
  - `api/programs/[id].ts` (GET missing auth/ownership checks)
  - `api/programs/generate.ts`, `api/programs/preview.ts`, `api/programs/confirm.ts` (does not verify `body.userId === payload.userId`)
  - `api/method-usage/index.ts` (does not verify `body.userId === payload.userId`)
  - `api/habit-usage/index.ts` (GET allows any `userId`, no ownership check)
  - `api/rewards/award.ts` (updates `programId` milestones without ownership verification)
  - `api/users/lookup.ts` (returns user data without auth)
  - `api/users/index.ts` (unauthenticated user creation; allows `role` to be set)
- Impact:
  - Any authenticated user can read or write other users’ program data and usage.
  - Unauthenticated callers can create users and possibly assign privileged roles.
  - User lookup endpoint leaks PII and enables enumeration.
- Recommended fixes:
  1. Require authentication on all endpoints that return or modify user-scoped data.
  2. Enforce `payload.userId` ownership for every user-scoped read/write path.
  3. Restrict `role` assignment to admin-only workflows.
  4. For any program mutations, verify program ownership before updates.

3. Medium — Onboarding password set can be abused
- Evidence: `api/auth/login.ts`, `api/auth/set-password.ts`
- Details:
  - `/api/auth/login` returns `needsPasswordSetup` plus `userId`/`email` for accounts without a password.
  - `/api/auth/set-password` accepts `userId` and `email` without additional proof (magic link or code).
- Impact: If an attacker knows a user’s email and the account has no password set, they can set it and take over the account.
- Recommended fixes:
  1. Require a one-time setup token (issued via magic link or email code) to set an initial password.
  2. Do not return `userId` until the setup token is validated.

4. Medium — Airtable formula injection via unescaped input
- Evidence:
  - `api/users/lookup.ts` (email used in `filterByFormula` without escaping)
  - `api/users/index.ts` (email used in `filterByFormula` without escaping)
  - `api/companies/lookup.ts` (record IDs concatenated without validation)
  - `api/programs/[id].ts` (GET path uses `id` in formula without validation)
- Impact: Malicious input could alter Airtable formulas or broaden queries.
- Recommended fixes:
  1. Always use `escapeFormulaValue` for user input in formulas.
  2. Validate record IDs with `isValidRecordId` before interpolation.

5. Medium — Access token stored in `localStorage`
- Evidence: `src/contexts/AuthContext.tsx`
- Impact: If any XSS is introduced, access tokens are directly exfiltratable.
- Recommended fixes:
  1. Prefer httpOnly cookies for access tokens, or store access tokens in memory only.
  2. Add a CSP and other hardening headers to reduce XSS impact.

6. Low — Missing rate limiting on login and password endpoints
- Evidence: `api/auth/login.ts`, `api/auth/set-password.ts`, `api/users/change-password.ts`
- Impact: Increased risk of brute-force attempts.
- Recommended fixes:
  1. Add IP- and account-based rate limiting for login, set-password, and change-password.

7. Low — Missing standard security headers
- Evidence: `server.ts`
- Impact: Increased exposure if any front-end injection occurs.
- Recommended fixes:
  1. Add `helmet` (or equivalent) and configure CSP, HSTS, and `X-Content-Type-Options`.

## Notes
- Many endpoints correctly use `escapeFormulaValue` and `isValidRecordId` in some paths; extend that pattern consistently.
- Magic-link verification and code flow include rate limiting and constant-time comparisons, which is good.

## Test Gaps
- I did not run automated tests or dynamic security testing. Findings are based on static review of the codebase only.
