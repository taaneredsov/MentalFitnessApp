# Action Required: API Layer

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [x] **Add new fields to Airtable User table** - Add `password_hash` (Single line text), `created_at` (Date with time), `last_login` (Date with time) fields to the Users table in Airtable

The fields are:
'Paswoord Hash'
'Aangemaakt op'
'Laatste login'

## During Implementation

None required.

## After Implementation

- [ ] **Test API endpoints with Postman/curl** - Verify all endpoints work correctly before integrating with frontend
- [ ] **Create a test user** - Create at least one user with a hashed password to test login flow

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
