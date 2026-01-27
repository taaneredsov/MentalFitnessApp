# Implementation Plan: Auth System

## Overview

Implement JWT-based authentication with login/logout, protected routes, and auth state management using React Context.

## Phase 1: JWT Utilities and Auth Endpoints

Create JWT handling utilities and authentication API endpoints.

### Tasks

- [x] Install jose library for JWT handling
- [x] Create JWT utility functions (sign, verify, decode)
- [x] Create POST /api/auth/login endpoint
- [x] Create POST /api/auth/logout endpoint
- [x] Create POST /api/auth/refresh endpoint
- [x] Create GET /api/auth/me endpoint

### Technical Details

**Install dependencies:**
```bash
npm install jose
npm install -D @types/cookie
```

**src/lib/jwt.ts:**
```typescript
import { SignJWT, jwtVerify, type JWTPayload } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
)

const ACCESS_TOKEN_EXPIRY = "15m"
const REFRESH_TOKEN_EXPIRY = "7d"

export interface TokenPayload extends JWTPayload {
  userId: string
  email: string
}

export async function signAccessToken(payload: {
  userId: string
  email: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function signRefreshToken(payload: {
  userId: string
  email: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as TokenPayload
  } catch {
    return null
  }
}
```

**api/auth/login.ts:**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyPassword } from "../../src/lib/password"
import { signAccessToken, signRefreshToken } from "../../src/lib/jwt"
import { transformUser, type AirtableUser } from "../../src/types/user"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, password } = loginSchema.parse(req.body)

    // Find user by email
    const records = await base(tables.users)
      .select({
        filterByFormula: `{E-mailadres} = "${email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "Invalid email or password", 401)
    }

    const record = records[0] as unknown as AirtableUser
    const passwordHash = record.fields.password_hash

    if (!passwordHash) {
      return sendError(res, "Account not set up for password login", 401)
    }

    // Verify password
    const isValid = await verifyPassword(password, passwordHash)
    if (!isValid) {
      return sendError(res, "Invalid email or password", 401)
    }

    // Update last_login
    await base(tables.users).update(record.id, {
      last_login: new Date().toISOString()
    })

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: record.id,
      email: record.fields["E-mailadres"]
    })

    const refreshToken = await signRefreshToken({
      userId: record.id,
      email: record.fields["E-mailadres"]
    })

    // Set refresh token as httpOnly cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    const user = transformUser(record)

    return sendSuccess(res, {
      user,
      accessToken
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
```

**api/auth/logout.ts:**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, sendError } from "../../src/lib/api-utils"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  // Clear refresh token cookie
  res.setHeader("Set-Cookie", [
    `refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  ])

  return sendSuccess(res, { message: "Logged out successfully" })
}
```

**api/auth/refresh.ts:**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { parse } from "cookie"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyToken, signAccessToken, signRefreshToken } from "../../src/lib/jwt"
import { transformUser, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const cookies = parse(req.headers.cookie || "")
    const refreshToken = cookies.refreshToken

    if (!refreshToken) {
      return sendError(res, "No refresh token", 401)
    }

    const payload = await verifyToken(refreshToken)
    if (!payload) {
      return sendError(res, "Invalid refresh token", 401)
    }

    // Get fresh user data
    const record = await base(tables.users).find(payload.userId)
    const user = transformUser(record as unknown as AirtableUser)

    // Generate new tokens
    const newAccessToken = await signAccessToken({
      userId: payload.userId,
      email: payload.email
    })

    const newRefreshToken = await signRefreshToken({
      userId: payload.userId,
      email: payload.email
    })

    // Set new refresh token
    res.setHeader("Set-Cookie", [
      `refreshToken=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    return sendSuccess(res, {
      user,
      accessToken: newAccessToken
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

**api/auth/me.ts:**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyToken } from "../../src/lib/jwt"
import { transformUser, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    const record = await base(tables.users).find(payload.userId)
    const user = transformUser(record as unknown as AirtableUser)

    return sendSuccess(res, user)
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

## Phase 2: React Auth Context

Create auth context for state management across the app.

### Tasks

- [x] Create AuthContext with user state and methods
- [x] Create AuthProvider component
- [x] Create useAuth hook
- [x] Add token storage and auto-refresh logic
- [x] Add auth initialization on app load

### Technical Details

**src/contexts/AuthContext.tsx:**
```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react"
import type { User } from "@/types/user"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "accessToken"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Login failed")
    }

    localStorage.setItem(TOKEN_KEY, data.data.accessToken)
    setUser(data.data.user)
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include"
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.data.accessToken)
        setUser(data.data.user)
        return
      }
    } catch {
      // Refresh failed, clear auth state
    }

    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)

      if (token) {
        try {
          const response = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
          })

          const data = await response.json()

          if (data.success) {
            setUser(data.data)
          } else {
            // Token expired, try refresh
            await refreshAuth()
          }
        } catch {
          await refreshAuth()
        }
      }

      setIsLoading(false)
    }

    initAuth()
  }, [refreshAuth])

  // Auto-refresh token every 10 minutes
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      refreshAuth()
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user, refreshAuth])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
```

## Phase 3: Protected Routes and Login Page

Create protected route component and login page UI.

### Tasks

- [x] Install react-router-dom for routing
- [x] Create ProtectedRoute component
- [x] Create login page with form
- [x] Add form validation with react-hook-form + zod
- [x] Style login page for mobile-first design
- [x] Add loading and error states

### Technical Details

**Install dependencies:**
```bash
npm install react-router-dom react-hook-form @hookform/resolvers
```

**src/components/ProtectedRoute.tsx:**
```typescript
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

**src/pages/LoginPage.tsx:**
```typescript
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required")
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null)
      await login(data.email, data.password)

      const from = location.state?.from?.pathname || "/"
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Update src/main.tsx:**
```typescript
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
```
