# Implementation Plan: API Layer

## Overview

Build a secure API layer using Vercel serverless functions with Airtable as the backend. The API will be reusable for both the mobile PWA and future admin dashboard.

## Phase 1: Airtable Client Setup

Configure the Airtable SDK and create reusable client utilities.

### Tasks

- [ ] Install Airtable SDK and dependencies
- [ ] Create Airtable client configuration
- [ ] Create TypeScript types for User table
- [ ] Build generic CRUD helper functions

### Technical Details

**Install dependencies:**
```bash
npm install airtable zod bcryptjs
npm install -D @types/bcryptjs
```

**src/lib/airtable.ts (client config):**
```typescript
import Airtable from "airtable"

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error("AIRTABLE_API_KEY is not defined")
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID is not defined")
}

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
})

export const base = airtable.base(process.env.AIRTABLE_BASE_ID)

export const tables = {
  users: process.env.AIRTABLE_TABLE_ID || "Users"
}
```

**src/types/user.ts:**
```typescript
export interface AirtableUser {
  id: string
  fields: {
    Naam: string
    "E-mailadres": string
    Bedrijf?: string[] // Linked record IDs
    Rol?: string
    Taalcode?: string
    Profielfoto?: Array<{
      url: string
      filename: string
    }>
    password_hash?: string
    created_at?: string
    last_login?: string
  }
}

export interface User {
  id: string
  name: string
  email: string
  company?: string[]
  role?: string
  languageCode?: string
  profilePhoto?: string
  createdAt?: string
  lastLogin?: string
}

// Transform Airtable record to clean User object
export function transformUser(record: AirtableUser): User {
  return {
    id: record.id,
    name: record.fields.Naam,
    email: record.fields["E-mailadres"],
    company: record.fields.Bedrijf,
    role: record.fields.Rol,
    languageCode: record.fields.Taalcode,
    profilePhoto: record.fields.Profielfoto?.[0]?.url,
    createdAt: record.fields.created_at,
    lastLogin: record.fields.last_login
  }
}
```

**src/lib/api-utils.ts:**
```typescript
import type { VercelResponse } from "@vercel/node"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export function sendSuccess<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data
  })
}

export function sendError(res: VercelResponse, error: string, status = 400) {
  return res.status(status).json({
    success: false,
    error
  })
}

export function handleApiError(res: VercelResponse, error: unknown) {
  console.error("API Error:", error)

  if (error instanceof Error) {
    return sendError(res, error.message, 500)
  }

  return sendError(res, "An unexpected error occurred", 500)
}
```

## Phase 2: User API Endpoints

Create serverless API endpoints for user operations.

### Tasks

- [ ] Create GET /api/users/[email] endpoint (lookup by email)
- [ ] Create POST /api/users endpoint (create user with password)
- [ ] Create PATCH /api/users/[id] endpoint (update user)
- [ ] Add password hashing utility

### Technical Details

**src/lib/password.ts:**
```typescript
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**api/users/lookup.ts (GET - lookup by email):**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { transformUser, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const { email } = req.query

  if (!email || typeof email !== "string") {
    return sendError(res, "Email is required", 400)
  }

  try {
    const records = await base(tables.users)
      .select({
        filterByFormula: `{E-mailadres} = "${email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const user = transformUser(records[0] as unknown as AirtableUser)
    return sendSuccess(res, user)
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

**api/users/index.ts (POST - create user):**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { hashPassword } from "../../src/lib/password"
import { transformUser, type AirtableUser } from "../../src/types/user"

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().optional(),
  languageCode: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const body = createUserSchema.parse(req.body)

    // Check if user already exists
    const existing = await base(tables.users)
      .select({
        filterByFormula: `{E-mailadres} = "${body.email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (existing.length > 0) {
      return sendError(res, "User with this email already exists", 409)
    }

    // Hash password
    const passwordHash = await hashPassword(body.password)

    // Create user
    const record = await base(tables.users).create({
      Naam: body.name,
      "E-mailadres": body.email,
      password_hash: passwordHash,
      Rol: body.role,
      Taalcode: body.languageCode,
      created_at: new Date().toISOString()
    })

    const user = transformUser(record as unknown as AirtableUser)
    return sendSuccess(res, user, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
```

**api/users/[id].ts (PATCH - update user):**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { transformUser, type AirtableUser } from "../../src/types/user"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  languageCode: z.string().optional(),
  lastLogin: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return sendError(res, "User ID is required", 400)
  }

  try {
    const body = updateUserSchema.parse(req.body)

    const fields: Record<string, unknown> = {}
    if (body.name) fields.Naam = body.name
    if (body.role) fields.Rol = body.role
    if (body.languageCode) fields.Taalcode = body.languageCode
    if (body.lastLogin) fields.last_login = body.lastLogin

    const record = await base(tables.users).update(id, fields)
    const user = transformUser(record as unknown as AirtableUser)

    return sendSuccess(res, user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
```

## Phase 3: API Client for Frontend

Create a typed API client for use in React components.

### Tasks

- [ ] Create fetch wrapper with error handling
- [ ] Create typed API client functions for user operations
- [ ] Add response type definitions

### Technical Details

**src/api/client.ts:**
```typescript
import type { ApiResponse } from "@/lib/api-utils"

const API_BASE = "/api"

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  }

  const response = await fetch(url, config)
  const data: ApiResponse<T> = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Request failed")
  }

  return data.data as T
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body)
    })
}
```

**src/api/users.ts:**
```typescript
import { api } from "./client"
import type { User } from "@/types/user"

export const usersApi = {
  getByEmail: (email: string) =>
    api.get<User>(`/users/lookup?email=${encodeURIComponent(email)}`),

  create: (data: {
    name: string
    email: string
    password: string
    role?: string
    languageCode?: string
  }) => api.post<User>("/users", data),

  update: (id: string, data: Partial<{
    name: string
    role: string
    languageCode: string
    lastLogin: string
  }>) => api.patch<User>(`/users/${id}`, data)
}
```
