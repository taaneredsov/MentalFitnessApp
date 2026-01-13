# Implementation Plan: Redis Caching Layer

## Overview

Add a Redis-based caching layer using Redis Cloud to reduce Airtable API latency and request volume. The implementation uses `ioredis` for both production (Redis Cloud) and local development (Docker Redis).

## Phase 1: Setup & Cache Utility

Create the foundational cache infrastructure.

### Tasks

- [x] Install ioredis package
- [x] Update `.env.example` with new environment variables
- [x] Create `api/_lib/cache.ts` with cache functions

### Technical Details

**Package Installation:**
```bash
npm install ioredis
```

**Environment Variables (.env.example):**
```
# Redis Configuration
REDIS_URL=redis://default:xxx@host:port

# Cache Configuration
CACHE_INVALIDATION_SECRET=
USE_LOCAL_REDIS=false
```

**Cache Utility (api/_lib/cache.ts):**
```typescript
import Redis from "ioredis"

// Singleton Redis client
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.USE_LOCAL_REDIS === "true"
      ? "redis://localhost:6379"
      : process.env.REDIS_URL

    if (!url) {
      throw new Error("REDIS_URL environment variable is required")
    }

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    })
  }
  return redis
}

// Public API
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await getRedis().get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      await getRedis().setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      console.error("Cache set error:", error)
    }
  },

  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await getRedis().keys(pattern)
      if (keys.length > 0) {
        await getRedis().del(...keys)
      }
      return keys.length
    } catch (error) {
      console.error("Cache invalidate error:", error)
      return 0
    }
  }
}

// Cache key helpers
export function cacheKey(table: string, filter?: string): string {
  const filterHash = filter ? hashString(filter) : "all"
  return `airtable:${table}:${filterHash}`
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// TTL configuration per table (in seconds)
export const TABLE_TTL = {
  methods: 30 * 60,      // 30 minutes - static reference data
  goals: 30 * 60,        // 30 minutes
  daysOfWeek: 30 * 60,   // 30 minutes
  users: 5 * 60,         // 5 minutes
  companies: 5 * 60,     // 5 minutes
  programs: 60,          // 1 minute - dynamic data
  methodUsage: 60        // 1 minute
}
```

## Phase 2: Cached Airtable Service

Create wrapper functions that integrate caching with Airtable calls.

### Tasks

- [x] Create `api/_lib/cached-airtable.ts` with cached query functions
- [x] Implement `cachedSelect` function for read operations
- [x] Implement cache invalidation on write operations

### Technical Details

**Cached Airtable Service (api/_lib/cached-airtable.ts):**
```typescript
import { base, tables } from "./airtable.js"
import { cache, cacheKey, TABLE_TTL } from "./cache.js"

type TableName = keyof typeof tables

interface SelectOptions {
  filterByFormula?: string
  maxRecords?: number
  returnFieldsByFieldId?: boolean
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>
}

/**
 * Cached select query for Airtable
 * Returns cached data if available, otherwise fetches from Airtable and caches
 */
export async function cachedSelect<T>(
  tableName: TableName,
  options: SelectOptions = {},
  transform: (records: any[]) => T[]
): Promise<T[]> {
  const tableId = tables[tableName]
  const key = cacheKey(tableId, JSON.stringify(options))
  const ttl = TABLE_TTL[tableName] || 300

  // Try cache first
  const cached = await cache.get<T[]>(key)
  if (cached) {
    return cached
  }

  // Fetch from Airtable
  const query = base(tableId).select({
    returnFieldsByFieldId: true,
    ...options
  })

  const records = options.maxRecords === 1
    ? await query.firstPage()
    : await query.all()

  const data = transform(records)

  // Cache the result
  await cache.set(key, data, ttl)

  return data
}

/**
 * Invalidate cache for a specific table
 */
export async function invalidateTable(tableName: TableName): Promise<number> {
  const tableId = tables[tableName]
  return cache.invalidate(`airtable:${tableId}:*`)
}

/**
 * Wrapper for write operations that invalidates cache
 */
export async function withCacheInvalidation<T>(
  tableName: TableName,
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation()
  await invalidateTable(tableName)
  return result
}
```

## Phase 3: Update API Endpoints

Update existing API endpoints to use the cached Airtable service.

### Tasks

- [x] Update `api/methods/index.ts` to use cached queries
- [x] Update `api/goals/index.ts` to use cached queries
- [x] Update `api/days/index.ts` to use cached queries
- [x] Update `api/methods/[id].ts` to use cached queries (skipped - single record lookup)
- [x] Add cache invalidation to write endpoints (via invalidation API)

### Technical Details

**Example: Updated methods/index.ts:**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { tables } from "../_lib/airtable.js"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformMethod } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const methods = await cachedSelect(
      "methods",
      {},
      (records) => records.map(r => transformMethod(r as any))
    )

    return sendSuccess(res, methods)
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

**Example: Cache invalidation on write (programs/index.ts POST handler):**
```typescript
import { withCacheInvalidation } from "../_lib/cached-airtable.js"

// In handlePost function:
const record = await withCacheInvalidation("programs", async () => {
  return base(tables.programs).create(fields, { typecast: true })
})
```

## Phase 4: Cache Invalidation API

Create webhook endpoint for Airtable Automations to trigger cache invalidation.

### Tasks

- [x] Create `api/cache/invalidate.ts` endpoint
- [x] Implement secret token authentication
- [x] Support table-specific and record-specific invalidation

### Technical Details

**Cache Invalidation Endpoint (api/cache/invalidate.ts):**
```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, sendError, parseBody } from "./_lib/api-utils.js"
import { cache } from "./_lib/cache.js"
import { tables } from "./_lib/airtable.js"

/**
 * POST /api/cache/invalidate
 * Invalidates cache entries for specified table
 *
 * Body: { table: string, recordId?: string }
 * Headers: x-cache-secret: <CACHE_INVALIDATION_SECRET>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  // Verify secret token
  const secret = req.headers["x-cache-secret"]
  if (!secret || secret !== process.env.CACHE_INVALIDATION_SECRET) {
    return sendError(res, "Unauthorized", 401)
  }

  const body = parseBody(req)
  const { table, recordId } = body

  if (!table) {
    return sendError(res, "Table name is required", 400)
  }

  // Get table ID from name
  const tableId = tables[table as keyof typeof tables]
  if (!tableId) {
    return sendError(res, "Invalid table name", 400)
  }

  try {
    // Invalidate all cache entries for this table
    const pattern = recordId
      ? `airtable:${tableId}:*` // Could be more specific with record ID
      : `airtable:${tableId}:*`

    const count = await cache.invalidate(pattern)

    return sendSuccess(res, {
      invalidated: count,
      table,
      tableId
    })
  } catch (error) {
    console.error("Cache invalidation error:", error)
    return sendError(res, "Failed to invalidate cache", 500)
  }
}
```

**Airtable Automation Webhook Configuration:**
- URL: `https://your-app.vercel.app/api/cache/invalidate`
- Method: POST
- Headers: `x-cache-secret: <your-secret>`
- Body: `{ "table": "methods" }` or `{ "table": "programs", "recordId": "recXXX" }`

## Phase 5: Local Development Setup

Document local Redis setup for development.

### Tasks

- [x] Add Docker Compose file for local Redis
- [x] Update README with local development instructions (skipped - using existing local Redis)

### Technical Details

**docker-compose.yml (for local Redis):**
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

**Local Development:**
```bash
# Start local Redis
docker-compose up -d redis

# Set environment variable
USE_LOCAL_REDIS=true

# Run dev server
npm run dev
```

## Verification

1. **Local Redis Testing:**
   - Start local Redis with Docker
   - Set `USE_LOCAL_REDIS=true`
   - Run dev server and verify caching works
   - Check Redis with `redis-cli KEYS "airtable:*"`

2. **Cache Hit Testing:**
   - Make repeated API calls to `/api/methods`
   - Verify second call is faster (cache hit)
   - Check response headers or logs for cache status

3. **Cache Invalidation Testing:**
   - Call `/api/cache/invalidate` with correct secret
   - Verify cache is cleared
   - Test from Airtable Automation webhook

4. **Production Testing:**
   - Deploy to Vercel with KV enabled
   - Configure environment variables
   - Verify caching works in production
