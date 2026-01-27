# Requirements: Magic Link Login

## Overview

Replace password-based authentication with a passwordless "magic link" system. Users enter their email and receive a one-time login link plus a 6-digit code. This simplifies the login experience and eliminates password-related security issues.

## Problem Statement

Current authentication has friction points:
- Users must remember passwords
- First-time users need a separate password setup flow
- Password reset requires additional infrastructure
- Passwords can be weak, reused, or forgotten

## Solution

Implement passwordless authentication using magic links:
1. User enters email address
2. Server generates a unique token and 6-digit code
3. Email sent with clickable link AND visible code
4. User clicks link (browser) OR enters code (PWA)
5. Session created, user logged in

## PWA Considerations

| Platform | Link Click Behavior | Recommended Action |
|----------|--------------------|--------------------|
| Browser | Opens directly, works | Use link |
| Android PWA | Can deep-link with proper config | Use link |
| iOS PWA | Opens Safari, not PWA | Use 6-digit code |

The dual approach (link + code) ensures all users can authenticate regardless of platform.

## User Stories

### US-1: Request Magic Link
**As a** user
**I want to** enter my email to receive a login link
**So that** I can log in without remembering a password

**Acceptance Criteria:**
- [ ] Email input field with validation
- [ ] Submit button triggers email send
- [ ] Loading state while sending
- [ ] Success message directs user to check email
- [ ] Error shown if email not found in system
- [ ] Rate limiting: max 3 requests per email per 15 minutes

### US-2: Login via Magic Link
**As a** user
**I want to** click the link in my email to log in
**So that** I can access the app with one click

**Acceptance Criteria:**
- [ ] Link format: `https://mfa.drvn.be/auth/verify?token=xxx`
- [ ] Valid token creates session and redirects to home
- [ ] Expired token (>15 min) shows friendly error with option to request new link
- [ ] Already-used token shows "link already used" message
- [ ] Invalid token shows generic error

### US-3: Login via 6-Digit Code
**As a** PWA user on iOS
**I want to** enter a 6-digit code from my email
**So that** I can log in when magic links open in Safari

**Acceptance Criteria:**
- [ ] 6 individual digit input boxes with auto-focus advance
- [ ] Paste support (paste full code, auto-fills all boxes)
- [ ] Auto-submit when 6 digits entered
- [ ] Code expires after 15 minutes
- [ ] Max 5 attempts before requiring new code
- [ ] Clear error message on invalid code

### US-4: Email Content
**As a** user
**I want to** receive a clear, professional email
**So that** I know how to proceed

**Acceptance Criteria:**
- [ ] Subject: "Je login link voor Mental Fitness"
- [ ] Contains clickable button/link
- [ ] Contains visible 6-digit code
- [ ] States expiry time (15 minutes)
- [ ] Professional branding
- [ ] Works in all major email clients

## Technical Requirements

### Security
- Tokens are cryptographically random (32 bytes, hex encoded)
- 6-digit code derived separately (not substring of token)
- Tokens stored hashed in database (like passwords)
- One-time use: deleted after successful verification
- Expiry: 15 minutes from creation
- Rate limiting on request endpoint

### Storage
- Use existing Airtable Users table
- New fields: `magicLinkToken`, `magicLinkCode`, `magicLinkExpiry`
- Clear fields after successful login or expiry

### Email Service
- Use Resend (simple API, good deliverability)
- Environment variable: `RESEND_API_KEY`
- From address: `noreply@mfa.drvn.be` (requires domain verification)

## Dependencies

- Resend account and API key
- Domain verification for sending emails
- Airtable schema update (3 new fields on Users table)

## Out of Scope

- Password login (will be deprecated but kept for transition period)
- Email change flow
- Account deletion
- Multi-factor authentication beyond magic link

## Success Metrics

- Login completion rate increases
- Support tickets for "forgot password" eliminated
- Average time to login decreases
