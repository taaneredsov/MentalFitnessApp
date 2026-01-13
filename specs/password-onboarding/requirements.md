# Requirements: Password Onboarding & Reset

## Overview

Enable users to set their own password during first login (onboarding) and change their password from the Account page.

## Background

Users are created in Airtable by administrators without a password. They receive a link to the app URL. When they first access the app, they need to set up their own password.

## User Stories

### Onboarding Flow
**As a new user**, I want to set my password when I first log in, so that I can secure my account.

**Acceptance Criteria:**
- [ ] When I enter my email on the login page and no password hash exists, I'm redirected to a "Set Password" page
- [ ] The Set Password page requires me to enter a password and confirm it
- [ ] Password must be at least 8 characters
- [ ] After setting my password, I'm automatically logged in
- [ ] My password hash is stored in Airtable

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
- Password hash stored in Airtable `Paswoord Hash` field (ID: `fldjzJzy8mvpU39Jz`)
- Minimum password length: 8 characters
- Password confirmation required for both set and change flows

## Dependencies

- Existing auth system (login, JWT tokens)
- Existing Airtable integration
- bcryptjs for password hashing

## Out of Scope

- Email-based password reset (forgot password flow)
- Password strength indicator
- Previous password requirement for change (keep it simple)
