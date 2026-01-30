# Authentication System

The app uses a hybrid authentication system supporting both traditional password login and passwordless magic link authentication.

## Authentication Methods

### 1. Email + Password Login

Traditional login with email and password. Used for returning users.

```typescript
// Frontend
const result = await login(email, password)
```

### 2. Magic Link Login

Passwordless authentication via email link + 6-digit code.

```typescript
// Request magic link
await fetch("/api/auth/magic-link", {
  method: "POST",
  body: JSON.stringify({ email })
})

// User receives email with:
// - Clickable link: https://mfa.drvn.be/auth/verify?token=abc123...
// - 6-digit code: 123456
```

## Token Architecture

### Access Token (JWT)

- **Storage:** localStorage
- **Expiry:** 1 hour
- **Contents:** `{ userId, email }`
- **Usage:** Sent in Authorization header

```typescript
headers: {
  Authorization: `Bearer ${accessToken}`
}
```

### Refresh Token (JWT)

- **Storage:** httpOnly cookie
- **Expiry:** 7 days
- **Purpose:** Obtain new access tokens without re-login
- **Cookie flags:** `HttpOnly; Secure; SameSite=Strict`

## Authentication Flows

### Login Flow (Password)

```
┌──────────┐    POST /api/auth/login     ┌──────────┐
│  Client  │ ────────────────────────►   │   API    │
│          │    { email, password }       │          │
└──────────┘                             └──────────┘
     │                                        │
     │                                        ▼
     │                                   ┌──────────┐
     │                                   │ Airtable │
     │                                   │  lookup  │
     │                                   └──────────┘
     │                                        │
     │                                        ▼
     │                                   ┌──────────┐
     │                                   │  bcrypt  │
     │                                   │  verify  │
     │                                   └──────────┘
     │                                        │
     │      { user, accessToken }             │
     │ ◄──────────────────────────────────────┤
     │      Set-Cookie: refreshToken          │
     │                                        │
     ▼                                        │
┌──────────────┐                              │
│ localStorage │                              │
│ (accessToken)│                              │
└──────────────┘
```

### Magic Link Flow

```
┌──────────┐   POST /api/auth/magic-link    ┌──────────┐
│  Client  │ ───────────────────────────►   │   API    │
│          │        { email }                │          │
└──────────┘                                └──────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Generate     │
                                          │ - token (64) │
                                          │ - code (6)   │
                                          └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Hash & store │
                                          │ in Airtable  │
                                          └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │ Send email   │
                                          │ (nodemailer) │
                                          └──────────────┘

--- User clicks link OR enters code ---

Option A: Click link
┌──────────┐    GET /api/auth/verify?token=...
│  Client  │ ──────────────────────────────────►

Option B: Enter code
┌──────────┐    POST /api/auth/verify-code
│  Client  │ ──────────────────────────────────►
│          │    { email, code }
```

### Token Refresh Flow

```
┌──────────┐    POST /api/auth/refresh     ┌──────────┐
│  Client  │ ──────────────────────────►   │   API    │
│          │    Cookie: refreshToken       │          │
└──────────┘                               └──────────┘
     │                                          │
     │                                          ▼
     │                                     Verify JWT
     │                                          │
     │       { user, accessToken }              │
     │ ◄────────────────────────────────────────┤
     │       Set-Cookie: refreshToken (new)     │
     ▼
Update localStorage
```

## First-Time User Flow

When a user is created in Airtable without a password:

1. User enters email on login page
2. API detects `needsPasswordSetup: true` (no password hash, no last login)
3. Frontend redirects to `/set-password`
4. User sets their password
5. User is logged in

```typescript
// API Response when needsPasswordSetup
{
  "success": true,
  "data": {
    "needsPasswordSetup": true,
    "userId": "recXXX",
    "email": "user@example.com"
  }
}
```

## Security Measures

### Password Security

- Passwords hashed with **bcrypt** (cost factor 10)
- Minimum password length enforced client-side
- Password hash stored in Airtable field `Paswoord Hash`

### Magic Link Security

1. **Cryptographically secure tokens**
   - 32 bytes (64 hex characters) for link token
   - 6-digit numeric code

2. **Hashed storage**
   - Token: SHA-256 hash
   - Code: HMAC-SHA256 with secret (prevents rainbow tables)

3. **Short expiry**
   - 15 minutes from generation

4. **One-time use**
   - Cleared after successful verification

5. **Rate limiting**
   - 2-minute cooldown between requests

6. **Timing attack prevention**
   - Random delays on failure responses
   - Constant-time comparison for token matching

7. **Email enumeration prevention**
   - Same response whether email exists or not

### JWT Security

- Signed with HS256 algorithm
- Secret loaded from environment or Docker secret
- Verification checks expiry automatically

```javascript
// api/_lib/jwt.js
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
)
```

### Cookie Security

Refresh token cookies use these flags:
- `HttpOnly` - Not accessible via JavaScript
- `Secure` - Only sent over HTTPS
- `SameSite=Strict` - Not sent with cross-site requests
- `Path=/` - Available to all API routes
- `Max-Age=604800` - 7 days

## AuthContext (Frontend)

The `AuthContext` manages authentication state in React:

```typescript
interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password?: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setAuthFromResponse: (user: User, accessToken: string) => void
}
```

### Usage

```tsx
import { useAuth } from "@/contexts/AuthContext"

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()

  if (!isAuthenticated) {
    return <LoginForm onSubmit={login} />
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

### Auto-Refresh

The AuthContext automatically refreshes the access token every 10 minutes when the user is logged in:

```typescript
useEffect(() => {
  if (!user) return

  const interval = setInterval(() => {
    refreshAuth()
  }, 10 * 60 * 1000) // 10 minutes

  return () => clearInterval(interval)
}, [user, refreshAuth])
```

## Environment Variables

```bash
# Required for JWT
JWT_SECRET=your-secret-key-minimum-32-characters

# Required for magic link emails
SMTP_SERVER=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@yourapp.com

# App URL for magic link
APP_URL=https://mfa.drvn.be
```

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/logout` | POST | Clear refresh token |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/set-password` | POST | Set password (first-time) |
| `/api/auth/magic-link` | POST | Request magic link |
| `/api/auth/verify` | GET | Verify magic link token |
| `/api/auth/verify-code` | POST | Verify 6-digit code |

## Common Issues

### "Account niet correct geconfigureerd"

This error appears when a user has a `lastLogin` date but no password hash. This is an invalid state that shouldn't occur in normal operation. Contact an administrator to fix the user record.

### Token Expired

When the access token expires and refresh fails:
1. User is redirected to login page
2. localStorage is cleared
3. User must login again

### Magic Link Not Received

Check:
1. Spam folder
2. Correct email address
3. SMTP configuration
4. Rate limiting (wait 2 minutes)
