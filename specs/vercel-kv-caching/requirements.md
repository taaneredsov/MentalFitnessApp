# Requirements: Redis Caching Layer for Airtable API

## Overview

Add Redis Cloud as a caching layer between the app and Airtable to reduce API latency and request volume. Airtable API calls are relatively slow, and caching frequently-accessed data will significantly improve performance.

## Problem Statement

- Airtable API calls have noticeable latency (500ms-2s per request)
- Reference data (methods, goals, days) rarely changes but is fetched on every request
- High request volume may approach Airtable API rate limits
- User experience suffers from slow API responses

## Solution

Implement a caching layer using Redis Cloud that:
- Caches Airtable API responses with configurable TTL
- Supports both production (Redis Cloud) and development (local Docker Redis) environments
- Provides cache invalidation via webhook for Airtable Automations

## Acceptance Criteria

### Cache Utility Module
- [ ] Generic `get<T>`, `set`, and `invalidate` functions
- [ ] Adapter pattern supporting Vercel KV (production) and local Redis (development)
- [ ] TTL configuration per cache key
- [ ] Environment variable `USE_LOCAL_REDIS=true` switches to local Docker Redis

### Airtable Service Wrapper
- [ ] Wraps Airtable API calls with cache layer
- [ ] Cache keys format: `airtable:{tableId}:{filterHash}`
- [ ] Default TTL of 5 minutes, configurable per table
- [ ] Fetches fresh data on cache miss and populates cache before returning
- [ ] Write operations (create/update/delete) invalidate relevant cache entries

### Cache Invalidation API
- [ ] POST endpoint at `/api/cache/invalidate`
- [ ] Secret token authentication via `CACHE_INVALIDATION_SECRET`
- [ ] Accepts table ID and optional record ID to invalidate specific cache keys
- [ ] Can be called from Airtable Automations via webhook

### Environment Configuration
- [ ] `REDIS_URL` - Redis Cloud connection string
- [ ] `CACHE_INVALIDATION_SECRET` - Secret for invalidation webhook
- [ ] `USE_LOCAL_REDIS` - Flag to use local Docker Redis for development

## Cache Strategy

### High TTL (30 minutes) - Static Reference Data
- Methods (`/api/methods`)
- Goals (`/api/goals`)
- Days of Week (`/api/days`)

### Medium TTL (5 minutes) - Semi-Static Data
- User profiles (after login)
- Company data

### Low TTL (1 minute) or No Cache - Dynamic Data
- Programs (user-specific, frequently updated)
- Method usage records

## Dependencies

- Redis Cloud instance (already provisioned)
- Local Redis (for development, via Docker)
- ioredis npm package

## Related Features

- All existing API endpoints will benefit from caching
- Airtable Automations can trigger cache invalidation
