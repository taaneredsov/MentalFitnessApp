# Action Required: Redis Caching Layer

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [x] **Redis Cloud instance** - Already provisioned at Redis Labs
- [ ] **Add REDIS_URL to Vercel** - Add the Redis Cloud connection string to Vercel project environment variables
- [ ] **Generate cache invalidation secret** - Create a secure random string for `CACHE_INVALIDATION_SECRET` (use `openssl rand -hex 32`)

## During Implementation

- [ ] **Add environment variables to Vercel** - Add `CACHE_INVALIDATION_SECRET` to Vercel project settings
- [ ] **Install Docker locally** - Required for local Redis development (if not already installed)

## After Implementation

- [ ] **Configure Airtable Automation** - Create automation in Airtable that calls the cache invalidation webhook when records are modified
  - Trigger: When record is created/updated in tables (methods, goals, days, users, companies, programs)
  - Action: Send webhook to `https://your-app.vercel.app/api/cache/invalidate`
  - Headers: `x-cache-secret: <your-secret>`
  - Body: `{ "table": "<table-name>" }`

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
