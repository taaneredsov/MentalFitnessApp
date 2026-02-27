# Implementation Plan: Magic Link Login

## Overview

Implement passwordless authentication using magic links and 6-digit codes. Users enter their email, receive a login link and code via email, then authenticate by clicking the link or entering the code.

## Phase 1: Infrastructure Setup

Set up email service and Postgres table for storing magic link tokens.

### Tasks

- [x] Install Resend package for email sending
- [x] Create `api/_lib/email.ts` utility for sending emails
- [x] Create `magic_link_codes` Postgres table (migration applied)

### Technical Details

**Install Resend:**
```bash
npm install resend
```

**Environment Variable (add to .env.local and production):**
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**Postgres table `magic_link_codes`:**
- `id` (serial PK)
- `user_id` (FK to users_pg)
- `token_hash` (text, hashed token)
- `code` (text, 6-digit code)
- `expires_at` (timestamptz)
- `created_at` (timestamptz)

**api/_lib/email.ts:**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: 'Mental Fitness <noreply@mfa.drvn.be>',
      to,
      subject: 'Je login link voor Mental Fitness',
      html: getMagicLinkEmailTemplate(magicLink, code)
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

function getMagicLinkEmailTemplate(link: string, code: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Login bij Mental Fitness</h2>
      <p>Klik op de knop hieronder om in te loggen:</p>
      <a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Inloggen
      </a>
      <p>Of gebruik deze code in de app:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f3f4f6; padding: 16px; text-align: center; border-radius: 6px;">
        ${code}
      </div>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Deze link en code zijn 15 minuten geldig.<br>
        Als je deze email niet hebt aangevraagd, kun je hem negeren.
      </p>
    </div>
  `
}
```

---

## Phase 2: API Endpoints

Create the three magic link API endpoints. All endpoints use Postgres for user lookup and magic link token storage.

### Tasks

- [x] Create `api/auth/magic-link.ts` - Request magic link (POST)
- [x] Create `api/auth/verify.ts` - Verify token from link (GET)
- [x] Create `api/auth/verify-code.ts` - Verify 6-digit code (POST)
- [x] Add routes to `server.ts`

### Technical Details

> **Note:** Detailed code samples omitted. The actual implementation queries Postgres `magic_link_codes` table for token/code storage and `users_pg` for user lookup. See `api/auth/magic-link.ts`, `api/auth/verify.ts`, and `api/auth/verify-code.ts` for current code.

**Add to server.ts:**
```typescript
// Magic link auth routes
const { default: magicLinkHandler } = await import("./api/auth/magic-link.js")
const { default: verifyHandler } = await import("./api/auth/verify.js")
const { default: verifyCodeHandler } = await import("./api/auth/verify-code.js")

app.post("/api/auth/magic-link", wrapVercelHandler(magicLinkHandler))
app.get("/api/auth/verify", wrapVercelHandler(verifyHandler))
app.post("/api/auth/verify-code", wrapVercelHandler(verifyCodeHandler))
```

---

## Phase 3: Frontend Pages

Create the magic link request and code verification pages.

### Tasks

- [x] Create `src/pages/MagicLinkPage.tsx` - Email input form
- [x] Create `src/pages/VerifyCodePage.tsx` - 6-digit code input
- [x] Create `src/pages/VerifyTokenPage.tsx` - Handle magic link redirect
- [x] Add routes to `src/App.tsx`
- [x] Add API methods to `src/lib/api-client.ts`

### Technical Details

**MagicLinkPage.tsx** - Simple email form:
```typescript
// src/pages/MagicLinkPage.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"

export function MagicLinkPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await api.auth.requestMagicLink(email)
      setSent(true)
      // Store email for code verification page
      sessionStorage.setItem("magicLinkEmail", email)
    } catch (err) {
      setError("Er ging iets mis. Probeer het opnieuw.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Mail className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Check je email</h1>
          <p className="text-muted-foreground">
            We hebben een login link gestuurd naar <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Klik op de link in de email of voer de code hieronder in.
          </p>
          <Button onClick={() => navigate("/auth/code")} className="w-full">
            Code invoeren
          </Button>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Ander email adres gebruiken
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Inloggen</h1>
          <p className="text-muted-foreground mt-2">
            Voer je email adres in om een login link te ontvangen
          </p>
        </div>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="je@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Stuur login link
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**VerifyCodePage.tsx** - 6-digit code input with auto-advance:
```typescript
// src/pages/VerifyCodePage.tsx
import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"

export function VerifyCodePage() {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()
  const { login } = useAuth()

  const email = sessionStorage.getItem("magicLinkEmail")

  useEffect(() => {
    if (!email) {
      navigate("/login")
    }
    inputRefs.current[0]?.focus()
  }, [email, navigate])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("")
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit
      })
      setCode(newCode)
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()

      if (newCode.every(d => d)) {
        verifyCode(newCode.join(""))
      }
      return
    }

    const digit = value.replace(/\D/g, "")
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newCode.every(d => d)) {
      verifyCode(newCode.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const verifyCode = async (fullCode: string) => {
    setLoading(true)
    setError("")

    try {
      const response = await api.auth.verifyCode(email!, fullCode)
      login(response.user, response.accessToken)
      sessionStorage.removeItem("magicLinkEmail")
      navigate("/")
    } catch (err) {
      setError("Ongeldige code. Probeer het opnieuw.")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Voer code in</h1>
          <p className="text-muted-foreground mt-2">
            Voer de 6-cijferige code in die we naar {email} hebben gestuurd
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold"
              disabled={loading}
            />
          ))}
        </div>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {loading && (
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        <div className="text-center space-y-2">
          <Button variant="ghost" onClick={() => navigate("/login")}>
            Terug naar inloggen
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**VerifyTokenPage.tsx** - Handle magic link redirect:
```typescript
// src/pages/VerifyTokenPage.tsx
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"

export function VerifyTokenPage() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setError("Geen token gevonden")
      return
    }

    api.auth.verifyToken(token)
      .then((response) => {
        login(response.user, response.accessToken)
        navigate("/")
      })
      .catch((err) => {
        setError(err.message || "Link is ongeldig of verlopen")
      })
  }, [searchParams, login, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <XCircle className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Link ongeldig</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/login")} className="w-full">
            Nieuwe link aanvragen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto" />
        <p className="text-muted-foreground">Even geduld, je wordt ingelogd...</p>
      </div>
    </div>
  )
}
```

**Add to App.tsx routes:**
```typescript
import { MagicLinkPage } from "@/pages/MagicLinkPage"
import { VerifyCodePage } from "@/pages/VerifyCodePage"
import { VerifyTokenPage } from "@/pages/VerifyTokenPage"

// In Routes:
<Route path="/login" element={<MagicLinkPage />} />
<Route path="/auth/code" element={<VerifyCodePage />} />
<Route path="/auth/verify" element={<VerifyTokenPage />} />
```

**Add to api-client.ts:**
```typescript
auth: {
  // ... existing methods

  requestMagicLink: async (email: string) => {
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
  },

  verifyToken: async (token: string) => {
    const res = await fetch(`/api/auth/verify?token=${token}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
  },

  verifyCode: async (email: string, code: string) => {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
  }
}
```

---

## Phase 4: Cleanup and Migration

Remove old password login and update existing flows.

### Tasks

- [x] Update LoginPage to redirect to MagicLinkPage
- [x] Remove FirstTimeUserPage and SetPasswordPage (deprecated)
- [x] Update AuthContext to handle magic link flow
- [ ] Remove password-related API endpoints (keep for 30 days, then delete) - keeping password login as alternative
- [x] Update SCOPE.md to reflect new auth flow

### Technical Details

**LoginPage.tsx** - Redirect to magic link:
```typescript
// Option 1: Simple redirect
export function LoginPage() {
  return <Navigate to="/login" replace />
}

// Option 2: Keep as alias, rename MagicLinkPage to LoginPage
```

**Deprecation timeline:**
- Week 1: Deploy magic link alongside password login
- Week 2-4: Monitor adoption, keep password login working
- Week 5: Remove password login endpoints
- Keep `change-password.ts` for users who want to set a backup password (optional future feature)

---

## Verification Checklist

After implementation:

- [x] User can request magic link by entering email
- [x] Email arrives within 30 seconds with link and code
- [x] Clicking link logs user in and redirects to home
- [x] Entering code logs user in
- [x] Expired tokens/codes show friendly error
- [x] Used tokens/codes cannot be reused
- [ ] Rate limiting prevents spam (max 3 requests per 15 min) - not implemented yet
- [x] Works on iOS PWA (code entry)
- [x] Works on Android PWA (link or code)
- [x] Works in browser (link preferred)
