# Implementation Plan: Password Onboarding & Reset

## Overview

Enable users to set their initial password during onboarding and change it from the Account page.

## Phase 1: API Changes

Modify login endpoint and create set-password endpoint.

### Tasks

- [x] Modify `api/auth/login.ts` to return `needsPasswordSetup` flag instead of error when no hash
- [x] Create `api/auth/set-password.ts` endpoint for initial password setup
- [x] Add password change endpoint to `api/users/change-password.ts`
- [x] Add `setPassword` and `changePassword` methods to `src/lib/api-client.ts`

### Technical Details

**Modified Login Response (api/auth/login.ts):**
```typescript
// When user exists but no password hash:
if (!passwordHash) {
  return sendSuccess(res, {
    needsPasswordSetup: true,
    userId: record.id,
    email: record.fields[USER_FIELDS.email]
  })
}
```

**Set Password Endpoint (api/auth/set-password.ts):**
```typescript
// POST /api/auth/set-password
// Body: { userId: string, email: string, password: string }
// - Verify user exists and has no password hash
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

1. Clear password hash for test user in Airtable
2. Go to login page, enter test user email
3. Should redirect to /set-password page
4. Set password (min 8 chars, with confirmation)
5. Should be logged in and redirected to home
6. Go to Account page
7. Change password using the form
8. Logout and login with new password
