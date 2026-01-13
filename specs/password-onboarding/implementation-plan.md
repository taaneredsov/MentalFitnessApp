# Implementation Plan: Password Onboarding & Reset

## Overview

Enable users to set their initial password during onboarding and change it from the Account page.

## Phase 1: API Changes

Modify login endpoint and create set-password endpoint.

### Tasks

- [x] Modify `api/auth/login.ts` to return `needsPasswordSetup` flag for first-time users (no hash AND no last login)
- [x] Create `api/auth/set-password.ts` endpoint for initial password setup
- [x] Add password change endpoint to `api/users/change-password.ts`
- [x] Add `setPassword` and `changePassword` methods to `src/lib/api-client.ts`
- [x] Update `api/auth/login.ts` to check both password hash AND last login for first-time user detection

### Technical Details

**Modified Login Response (api/auth/login.ts):**
```typescript
const passwordHash = record.fields[USER_FIELDS.passwordHash]
const lastLogin = record.fields[USER_FIELDS.lastLogin]

// First-time user: no password hash AND no last login
if (!passwordHash && !lastLogin) {
  return sendSuccess(res, {
    needsPasswordSetup: true,
    userId: record.id,
    email: record.fields[USER_FIELDS.email]
  })
}

// User has last login but no password - something is wrong
if (!passwordHash && lastLogin) {
  return sendError(res, "Account niet correct geconfigureerd. Neem contact op met beheerder.", 400)
}

// Normal flow: verify password
```

**Set Password Endpoint (api/auth/set-password.ts):**
```typescript
// POST /api/auth/set-password
// Body: { userId: string, email: string, password: string }
// - Verify user exists
// - Verify user is first-time user (no password hash AND no last login)
// - Hash password and store
// - Return tokens (same as login)
```

**Change Password Endpoint (api/users/change-password.ts):**
```typescript
// POST /api/users/change-password
// Body: { password: string }
// Headers: Authorization: Bearer <token>
// - Verify JWT token
// - Hash new password and update user
// - Return success
```

**API Client (src/lib/api-client.ts):**
```typescript
auth: {
  // existing...
  setPassword: (userId: string, email: string, password: string) =>
    request<{ user: User; accessToken: string }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ userId, email, password })
    }),
},
users: {
  // existing...
  changePassword: (password: string) =>
    request<{ success: boolean }>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    })
}
```

## Phase 2: Onboarding UI

Create the set-password page and update login flow.

### Tasks

- [x] Create `src/pages/SetPasswordPage.tsx` with password form
- [x] Update `src/pages/LoginPage.tsx` to handle `needsPasswordSetup` response
- [x] Add `/set-password` route to `src/App.tsx`
- [x] Export SetPasswordPage from `src/pages/index.ts`
- [x] Update AuthContext to handle setPassword flow

### Technical Details

**SetPasswordPage (src/pages/SetPasswordPage.tsx):**
- Receives userId and email via location state (from login redirect)
- Form with password + confirmPassword fields
- Minimum 8 characters validation
- On submit: calls api.auth.setPassword, then logs user in
- Redirects to home on success

**LoginPage changes:**
- Check if response has `needsPasswordSetup: true`
- If yes, navigate to `/set-password` with state: `{ userId, email }`

**App.tsx route:**
```tsx
<Route path="/set-password" element={<SetPasswordPage />} />
```

## Phase 3: Account Password Change

Add password change functionality to Account page.

### Tasks

- [x] Create `src/components/ChangePasswordForm.tsx` component
- [x] Add password change section to `src/pages/AccountPage.tsx`

### Technical Details

**ChangePasswordForm component:**
```typescript
// Props: onSuccess callback
// Form fields: newPassword, confirmPassword
// Validation: min 8 chars, passwords must match
// On submit: calls api.users.changePassword
// Shows success/error message
```

**AccountPage addition:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Change Password</CardTitle>
  </CardHeader>
  <CardContent>
    <ChangePasswordForm onSuccess={() => setShowSuccess(true)} />
  </CardContent>
</Card>
```

## Verification

### First-Time User Flow
1. Create test user in Airtable with NO password hash AND NO last login
2. Go to login page, enter test user email
3. Should redirect to /set-password page
4. Set password (min 8 chars, with confirmation)
5. Should be logged in and redirected to home

### Edge Case: Invalid Account State
1. Create test user in Airtable with NO password hash BUT WITH last login date
2. Go to login page, enter test user email
3. Should see error: "Account niet correct geconfigureerd. Neem contact op met beheerder."

### Password Change Flow
1. Log in with existing user
2. Go to Account page
3. Change password using the form
4. Logout and login with new password
