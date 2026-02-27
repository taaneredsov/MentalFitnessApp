# Requirements: Password Onboarding & Reset

## Overview

Enable users to set their own password during first login (onboarding) and change their password from the Account page.

## Background

Users are provisioned (via admin workflow, synced to Postgres) without a password. They receive a link to the app URL. When they first access the app, they need to set up their own password.

### First-Time User Detection

A user is considered a **first-time user** when both conditions are met:
1. No password hash exists (`Paswoord Hash` field is empty)
2. No last login date exists (`Laatste login` field is empty)

This dual condition ensures:
- New users created by admins are properly prompted to set a password
- Existing users who somehow lost their password hash are not confused (they would have a last login date)

## User Stories

### Onboarding Flow
**As a new user**, I want to set my password when I first log in, so that I can secure my account.

**Acceptance Criteria:**
- [ ] When I enter my email on the login page and I'm a first-time user (no password hash AND no last login), I'm redirected to a "Set Password" page
- [ ] The Set Password page requires me to enter a password and confirm it
- [ ] Password must be at least 8 characters
- [ ] After setting my password, I'm automatically logged in
- [ ] My password hash is stored in Postgres (synced to Airtable via outbox)

### Password Change
**As an existing user**, I want to change my password from the Account page, so that I can maintain security.

**Acceptance Criteria:**
- [ ] On the Account page, there's a "Change Password" section
- [ ] I can enter a new password and confirm it
- [ ] Password must be at least 8 characters
- [ ] After changing, I see a success message
- [ ] I can log in with my new password

## Technical Requirements

- Passwords are hashed using bcrypt (already implemented in `api/_lib/password.js`)
- Password hash stored in Postgres `users_pg.password_hash` column
- Last login stored in Postgres `users_pg.last_login` column
- First-time user detection: no password hash AND no last login
- Minimum password length: 8 characters
- Password confirmation required for both set and change flows

## Dependencies

- Existing auth system (login, JWT tokens)
- Postgres `users_pg` table
- bcryptjs for password hashing

## Edge Cases

| Password Hash | Last Login | Behavior |
|---------------|------------|----------|
| Empty | Empty | First-time user → Redirect to Set Password page |
| Empty | Has value | Error: "Account niet correct geconfigureerd. Neem contact op met beheerder." |
| Has value | Any | Normal login flow (validate password) |

## Out of Scope

- Email-based password reset (forgot password flow)
- Password strength indicator
- Previous password requirement for change (keep it simple)
