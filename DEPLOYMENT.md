# Deployment Guide - Hetzner Server

This document describes how to deploy the Mental Fitness App to the Hetzner production server.

## Server Details

| Property | Value |
|----------|-------|
| Host | hetzner-code (37.27.180.117:666) |
| User | renaat |
| Bare Git Repo | /mnt/repo/mfa.git |
| Compose file | /mnt/compose/mfa.yml |
| Registry | registry.shop.drvn.be/mfa:latest |
| Registry Auth | /mnt/auth (server-side) |
| Live URL | https://mfa.drvn.be |

## Quick Deploy

The deployment process is automated via a git post-receive hook. Push to the `dev` remote to deploy:

```bash
# Push to dev remote (triggers automatic deploy)
git push dev main

# Wait for build/deploy to complete (watch hook output)

# Run database migrations (REQUIRED after deploy)
ssh -p 666 renaat@37.27.180.117 "docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"

# Verify deployment
curl -s https://mfa.drvn.be/api/health

# Check all services are running
ssh -p 666 renaat@37.27.180.117 "docker service ls | grep mfa"
```

### Git Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Machine                                                  │
│                                                                 │
│  git push dev main                                              │
│          │                                                      │
└──────────┼──────────────────────────────────────────────────────┘
           │
           │ SSH (port 666)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner Server (37.27.180.117)                                 │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Bare Repo: /mnt/repo/mfa.git                          │    │
│  │  Receives push                                         │    │
│  └────────────┬───────────────────────────────────────────┘    │
│               │                                                 │
│               ▼                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  post-receive hook                                     │    │
│  │  1. Checkout to /mnt/data/mfa                          │    │
│  │  2. docker build (x64)                                 │    │
│  │  3. docker push to registry.shop.drvn.be              │    │
│  │  4. docker stack deploy -c /mnt/compose/mfa.yml mfa   │    │
│  └────────────┬───────────────────────────────────────────┘    │
│               │                                                 │
│               ▼                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Docker Swarm                                          │    │
│  │  - Pulls new image from registry                       │    │
│  │  - Rolling update (start-first)                        │    │
│  │  - 4 services: app, worker, postgres, redis           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Post-Receive Hook

The hook at `/mnt/repo/mfa.git/hooks/post-receive` automatically:
1. Checks out code from bare repo to `/mnt/data/mfa`
2. Builds Docker image for x64 architecture (important: local dev is ARM)
3. Authenticates with registry using credentials from `/mnt/auth`
4. Pushes image to private registry (`registry.shop.drvn.be/mfa:latest`)
5. Deploys stack via `docker stack deploy -c /mnt/compose/mfa.yml mfa`

**Note**: Hook does NOT run migrations. You must run migrations manually after deploy.

### Setting Up Git Remote

Add the Hetzner server as a git remote (one-time setup):

```bash
git remote add dev ssh://renaat@37.27.180.117:666/mnt/repo/mfa.git

# Verify
git remote -v
```

## Manual Deploy (Bypass Hook)

If you need to manually build and deploy:

```bash
# 1. SSH to server
ssh -p 666 renaat@37.27.180.117

# 2. Pull latest code
cd /mnt/repo/mfa.git && git fetch origin main

# 3. Checkout to working directory
GIT_WORK_TREE=/mnt/data/mfa git checkout -f origin/main

# 4. Build and push image
cd /mnt/data/mfa
docker build -t registry.shop.drvn.be/mfa:latest .
docker push registry.shop.drvn.be/mfa:latest

# 5. Deploy stack
docker stack deploy -c /mnt/compose/mfa.yml mfa

# 6. Run migrations
docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs

# 7. Clean up
docker system prune -af
```

## Verification

```bash
# Check all services
ssh -p 666 renaat@37.27.180.117 "docker service ls | grep mfa"

# Check specific service status
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_app"
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_worker"
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_postgres"
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_redis"

# Check service logs
ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_app --tail 50"
ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_worker --tail 50"

# Health check
curl -s https://mfa.drvn.be/api/health

# Check worker sync status (via Redis)
ssh -p 666 renaat@37.27.180.117 "docker exec \$(docker ps -q -f name=mfa_redis) redis-cli GET sync:status"
```

## Architecture

### Migration: 2-service → 4-service

**Before (Legacy)**:
- 2 services: App + Redis
- Deployed on Vercel (serverless functions)
- Airtable-only data backend

**After (Current)**:
- 4 services: App + Redis + Postgres + Worker
- Deployed on Hetzner Docker Swarm
- Hybrid Postgres/Airtable backend with bidirectional sync

### Service Overview

| Service | Image | Purpose | Networks | External Access |
|---------|-------|---------|----------|-----------------|
| **app** | `registry.shop.drvn.be/mfa:latest` | Express HTTP server | mfa_internal + traefik-public | Via Traefik (HTTPS) |
| **worker** | `registry.shop.drvn.be/mfa:latest` | Sync worker (Postgres ↔ Airtable) | mfa_internal + traefik-public | Airtable API only |
| **postgres** | `postgres:16-alpine` | Primary database | mfa_internal | Internal only |
| **redis** | `redis:7-alpine` | Cache + job queue | mfa_internal | Internal only |

### Data Backend Strategy

The app is gradually migrating from Airtable to Postgres using feature flags:

```
DATA_BACKEND_PROGRAMS=postgres_shadow_read
DATA_BACKEND_HABIT_USAGE=airtable_only
DATA_BACKEND_METHOD_USAGE=airtable_only
...
```

- **airtable_only**: Read/write directly to Airtable
- **postgres_shadow_read**: Write to both, read from Postgres (if exists, fallback to Airtable)
- **postgres_only**: Read/write only to Postgres (future)

Worker keeps Postgres and Airtable in sync bidirectionally.

### File Locations

| Path | Purpose |
|------|---------|
| `/mnt/repo/mfa.git` | Bare git repo with post-receive hook |
| `/mnt/data/mfa` | Working directory (code checkout) |
| `/mnt/data/mfa-redis` | Redis persistence volume |
| `/mnt/data/mfa-postgres` | Postgres data volume |
| `/mnt/compose/mfa.yml` | Docker Compose stack file |
| `/mnt/auth` | Docker registry credentials |

### Networking

**Networks**:
- **mfa_internal** (overlay, internal): Private network for service-to-service communication
- **traefik-public** (external): Public network for ingress and external API access

**CRITICAL: Service Hostnames**:
Service names are prefixed with stack name (`mfa`):
- Database: `mfa_postgres` (not `postgres`)
- Cache: `mfa_redis` (not `redis`)

This is required because multiple stacks share the same Swarm network namespace.

**Why Worker Needs traefik-public**:
- Worker must call external Airtable API
- `mfa_internal` is internal-only (blocks external traffic)
- Solution: Attach worker to both networks

## Database Migrations

Migrations are run manually after deployment using the migration script inside the app container.

### Running Migrations

```bash
# Run migrations
ssh -p 666 renaat@37.27.180.117 "docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"
```

### How It Works

- Migration script: `/tasks/db-migrate.mjs`
- Migration files: `/tasks/db/migrations/*.sql`
- Reads `DATABASE_URL_FILE` secret automatically
- Tracks applied migrations in `schema_migrations` table
- Idempotent (safe to run multiple times)

### Adding New Migrations

1. Create new SQL file in `tasks/db/migrations/` (e.g., `004_add_notifications.sql`)
2. Deploy code via git push
3. Run migration script (see above)

### Viewing Applied Migrations

```bash
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_postgres) \
  psql -U postgres -d mfa -c 'SELECT * FROM schema_migrations ORDER BY id;'"
```

## Rollback

### Code Rollback

To rollback to a previous version:

```bash
# Check available commits
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && git log origin/main --oneline -10"

# Checkout specific commit
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && GIT_WORK_TREE=/mnt/data/mfa git checkout -f <commit-hash>"

# Rebuild and deploy
ssh -p 666 renaat@37.27.180.117 "cd /mnt/data/mfa && docker build -t registry.shop.drvn.be/mfa:latest . && docker push registry.shop.drvn.be/mfa:latest"

# Deploy stack
ssh -p 666 renaat@37.27.180.117 "docker stack deploy -c /mnt/compose/mfa.yml mfa"
```

### Database Rollback

**WARNING**: Migrations do not have automatic down migrations. To rollback database changes:

1. Write manual SQL to reverse the migration
2. Execute via `psql` in postgres container
3. Remove migration record from `schema_migrations` table

```bash
# Connect to postgres
ssh -p 666 renaat@37.27.180.117 \
  "docker exec -it \$(docker ps -q -f name=mfa_postgres) \
  psql -U postgres -d mfa"

# Run manual SQL to reverse migration
# DELETE FROM schema_migrations WHERE version = 'XXX';
```

## Secrets

All secrets are managed via Docker Swarm secrets (not environment files). Total: 11 secrets, all prefixed with `mfa_`.

### Secret List

| Secret Name | Used By | Description |
|-------------|---------|-------------|
| `mfa_airtable_access_token` | app, worker | Airtable API token |
| `mfa_airtable_base_id` | app, worker | Airtable base ID |
| `mfa_jwt_secret` | app | JWT signing key |
| `mfa_openai_api_key` | app | OpenAI API key |
| `mfa_smtp_server` | app | SMTP server host |
| `mfa_smtp_port` | app | SMTP server port |
| `mfa_smtp_user` | app | SMTP username |
| `mfa_smtp_password` | app | SMTP password |
| `mfa_smtp_from` | app | Email from address |
| `mfa_database_url` | app, worker | PostgreSQL connection string |
| `mfa_postgres_password` | postgres | PostgreSQL root password |

### Database URL Format

```
postgresql://postgres:<password>@mfa_postgres:5432/mfa
```

**CRITICAL**: The hostname MUST be `mfa_postgres` (not `postgres`) because Docker Swarm prefixes service hostnames with the stack name.

### Creating Secrets

```bash
# Example: Create database URL secret
echo "postgresql://postgres:secret@mfa_postgres:5432/mfa" | \
  ssh -p 666 renaat@37.27.180.117 "docker secret create mfa_database_url -"
```

### Updating Secrets

**IMPORTANT**: After adding new secrets, you MUST remove and redeploy the stack. Simply running `docker stack deploy` does NOT add new secrets to already-running services.

```bash
# 1. Remove stack
ssh -p 666 renaat@37.27.180.117 "docker stack rm mfa"

# 2. Wait for services to stop
ssh -p 666 renaat@37.27.180.117 "watch docker service ls"

# 3. Create new secrets
echo "new-value" | ssh -p 666 renaat@37.27.180.117 "docker secret create mfa_new_secret -"

# 4. Redeploy stack
ssh -p 666 renaat@37.27.180.117 "docker stack deploy -c /mnt/compose/mfa.yml mfa"

# 5. Run migrations if needed
ssh -p 666 renaat@37.27.180.117 "docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_app --tail 50"
ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_worker --tail 50"

# Check task status (shows full errors)
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_app --no-trunc"

# Common causes:
# - Missing secrets
# - Wrong service hostnames (mfa_postgres not postgres)
# - Image not found in registry
```

### Cannot Connect to Database

**Symptom**: App logs show "ECONNREFUSED mfa_postgres:5432" or similar

**Check**:
1. Postgres service is running: `docker service ls | grep postgres`
2. Hostname is correct: Must be `mfa_postgres` (not `postgres`)
3. DATABASE_URL format: `postgresql://postgres:password@mfa_postgres:5432/mfa`
4. Secret exists: `docker secret ls | grep database_url`

**Test connection**:
```bash
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_app) sh -c 'nc -zv mfa_postgres 5432'"
```

### Worker Not Syncing

**Symptom**: Data changes in Airtable not appearing in Postgres (or vice versa)

**Check**:
1. Worker logs: `docker service logs mfa_worker -f --tail 100`
2. Worker has both networks: `docker service inspect mfa_worker | grep Networks`
3. Redis job queue: `docker exec $(docker ps -q -f name=mfa_redis) redis-cli KEYS "sync:*"`
4. Airtable API access: Worker needs `traefik-public` network

### New Secrets Not Working

**Symptom**: Services still using old secrets after creating new ones

**Cause**: `docker stack deploy` does NOT update secrets on running services

**Solution**:
```bash
# Must remove and redeploy stack
docker stack rm mfa
# Wait for shutdown
watch docker service ls
# Redeploy
docker stack deploy -c /mnt/compose/mfa.yml mfa
```

### Migrations Failed

**Symptom**: Migration script exits with error

**Diagnose**:
```bash
# Check migration logs
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"

# Check applied migrations
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_postgres) \
  psql -U postgres -d mfa -c 'SELECT * FROM schema_migrations ORDER BY id;'"
```

**Rollback** (manual):
```bash
# Connect to postgres
ssh -p 666 renaat@37.27.180.117 \
  "docker exec -it \$(docker ps -q -f name=mfa_postgres) \
  psql -U postgres -d mfa"

# Run rollback SQL manually
# DELETE FROM schema_migrations WHERE version = 'XXX';
```

### Git Push Hook Failed

**Symptom**: `git push dev main` succeeds but no deployment happens

**Check**:
```bash
# SSH to server
ssh -p 666 renaat@37.27.180.117

# Check post-receive hook exists
ls -la /mnt/repo/mfa.git/hooks/post-receive

# Check hook is executable
chmod +x /mnt/repo/mfa.git/hooks/post-receive

# Test hook manually
cd /mnt/repo/mfa.git
.git/hooks/post-receive
```

**Fallback**: Use manual deploy (see "Manual Deploy" section)

### Registry Authentication Failed

**Symptom**: "unauthorized: authentication required" when pushing/pulling images

**Check**:
```bash
# Verify credentials exist
ssh -p 666 renaat@37.27.180.117 "ls -la /mnt/auth"

# Re-authenticate
ssh -p 666 renaat@37.27.180.117 \
  "docker login registry.shop.drvn.be -u <user> -p <password>"
```

### High Memory Usage

**Redis**:
```bash
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_redis) redis-cli INFO memory"
```

**Postgres**:
```bash
ssh -p 666 renaat@37.27.180.117 \
  "docker exec \$(docker ps -q -f name=mfa_postgres) \
  psql -U postgres -d mfa -c \"SELECT * FROM pg_stat_database WHERE datname='mfa';\""
```

**Clear cache**:
```bash
curl -X POST https://mfa.drvn.be/api/cache/invalidate
```

## Support

For detailed architecture diagrams and troubleshooting, see:
- `/docs/deployment/hetzner.md` - Comprehensive deployment guide
- `/specs/postgres-airtable-async-sync/` - Worker sync architecture
- `/tasks/lessons.md` - Known issues and solutions
