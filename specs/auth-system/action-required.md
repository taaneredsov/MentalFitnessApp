# Action Required: Auth System

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [ ] **Set JWT_SECRET environment variable** - Add a strong random secret to `.env.local` (at least 32 characters). Generate with: `openssl rand -base64 32`

## During Implementation

None required.

## After Implementation

- [ ] **Create test user with password** - Use the API or a script to create a user with a hashed password for testing login
- [ ] **Test login flow on mobile device** - Verify the login works correctly on both iOS and Android browsers

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
