# Deployment Guide - Hetzner Server

This guide covers deploying the Mental Fitness App to a Hetzner server running Docker Swarm.

## Infrastructure Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         Hetzner Cloud Server                                  │
│                         IP: 37.27.180.117:666                                 │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │                         Docker Swarm                                  │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │  Traefik (reverse proxy)                                       │  │   │
│  │  │  - SSL termination (Let's Encrypt)                             │  │   │
│  │  │  - Routes: mfa.drvn.be -> mfa_app                              │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                               │                                       │   │
│  │                               ▼                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                     mfa_internal (overlay)                     │  │   │
│  │  │                                                                │  │   │
│  │  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │  │   │
│  │  │   │   App        │    │   Worker     │    │   Postgres   │   │  │   │
│  │  │   │  (Express)   │    │(sync-worker) │    │(PostgreSQL16)│   │  │   │
│  │  │   │  Port 3000   │    │              │    │  Port 5432   │   │  │   │
│  │  │   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │  │   │
│  │  │          │                   │                   │            │  │   │
│  │  │          └───────────────┬───┴───────────────────┘            │  │   │
│  │  │                          │                                    │  │   │
│  │  │                    ┌─────▼─────┐                              │  │   │
│  │  │                    │   Redis   │                              │  │   │
│  │  │                    │  (Alpine) │                              │  │   │
│  │  │                    │ Port 6379 │                              │  │   │
│  │  │                    └───────────┘                              │  │   │
│  │  │                                                                │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  External API Access (Airtable):                                     │   │
│  │  - App: via traefik-public                                           │   │
│  │  - Worker: via traefik-public                                        │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  Volumes:                                                                     │
│  - /mnt/data/mfa-redis (Redis persistence)                                   │
│  - /mnt/data/mfa-postgres (Postgres data)                                    │
│                                                                               │
│  Git & Build:                                                                 │
│  - /mnt/repo/mfa.git (bare repo + post-receive hook)                         │
│  - /mnt/data/mfa (checkout working directory)                                │
│  - /mnt/auth (registry credentials)                                          │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Swarm initialized on the server
- Traefik configured as ingress controller
- Docker registry access (registry.shop.drvn.be, credentials at `/mnt/auth`)
- DNS configured for mfa.drvn.be
- Bare git repo at `/mnt/repo/mfa.git` with post-receive hook
- Data directories: `/mnt/data/mfa`, `/mnt/data/mfa-redis`, `/mnt/data/mfa-postgres`

## Docker Image

### Dockerfile

The app uses a multi-stage Dockerfile:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx tsc --project tsconfig.server.json

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./
RUN chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3000
ENV NODE_ENV=production PORT=3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["dumb-init", "node", "server.js"]
```

### Building and Pushing

```bash
# Build the image
docker build -t registry.shop.drvn.be/mfa:latest .

# Push to registry
docker push registry.shop.drvn.be/mfa:latest
```

## Docker Compose (Swarm)

### 4-Service Stack

The current production stack consists of:

1. **app**: Express HTTP server (main application)
2. **worker**: Background sync worker (Postgres ↔ Airtable)
3. **postgres**: PostgreSQL 16 database
4. **redis**: Redis cache and job queue

### Key Configuration Details

#### Service Hostnames
**CRITICAL**: Service hostnames in Docker Swarm are prefixed with the stack name:
- `mfa_postgres` (not `postgres`)
- `mfa_redis` (not `redis`)
- `mfa_app` (not `app`)
- `mfa_worker` (not `worker`)

This is because multiple stacks share the same Swarm network namespace.

#### Worker Service
- Runs `api/workers/sync-worker.js`
- Needs **both** `mfa_internal` (for postgres/redis) AND `traefik-public` (for Airtable API access)
- Uses same Docker image as app, just different command

#### Database URL
Must use stack-prefixed hostname:
```
postgresql://postgres:<password>@mfa_postgres:5432/mfa
```

#### Redis URL
Must use stack-prefixed hostname:
```
redis://mfa_redis:6379
```

### docker-compose.yml

See `/docker-compose.yml` in the repository for the full configuration. Key highlights:

- All 4 services use `mfa_internal` overlay network
- App and Worker also connect to `traefik-public` for external API access
- 11 total secrets (all prefixed with `mfa_`)
- Feature flags control which entities use Postgres vs Airtable
- Postgres and Redis data persisted to `/mnt/data/*`

## Secrets Management

Docker Swarm secrets are used for all sensitive configuration.

### Complete Secret List (11 total)

All secrets are prefixed with `mfa_`:

1. `mfa_airtable_access_token` - Airtable API token
2. `mfa_airtable_base_id` - Airtable base ID
3. `mfa_jwt_secret` - JWT signing key (min 32 chars)
4. `mfa_openai_api_key` - OpenAI API key
5. `mfa_smtp_server` - SMTP server hostname
6. `mfa_smtp_port` - SMTP port (e.g., 587)
7. `mfa_smtp_user` - SMTP username
8. `mfa_smtp_password` - SMTP password
9. `mfa_smtp_from` - Email from address
10. `mfa_database_url` - PostgreSQL connection string
11. `mfa_postgres_password` - PostgreSQL root password

### Creating Secrets

```bash
# Airtable
echo "pat_xxx" | docker secret create mfa_airtable_access_token -
echo "appXXX" | docker secret create mfa_airtable_base_id -

# Auth
echo "your-jwt-secret-min-32-chars" | docker secret create mfa_jwt_secret -

# OpenAI
echo "sk-xxx" | docker secret create mfa_openai_api_key -

# SMTP
echo "smtp.example.com" | docker secret create mfa_smtp_server -
echo "587" | docker secret create mfa_smtp_port -
echo "user@example.com" | docker secret create mfa_smtp_user -
echo "password" | docker secret create mfa_smtp_password -
echo "noreply@example.com" | docker secret create mfa_smtp_from -

# Database (CRITICAL: use mfa_postgres hostname)
echo "postgresql://postgres:secret@mfa_postgres:5432/mfa" | docker secret create mfa_database_url -
echo "secret" | docker secret create mfa_postgres_password -
```

### Listing Secrets

```bash
docker secret ls | grep mfa
```

### Updating Secrets

**IMPORTANT**: After adding new secrets, you MUST remove and redeploy the stack. Simply running `docker stack deploy` alone does NOT add new secrets to already-running services.

```bash
# 1. Remove stack
docker stack rm mfa

# 2. Wait for complete shutdown
watch docker service ls

# 3. Create/update secrets
echo "new-value" | docker secret create mfa_new_secret -

# 4. Redeploy stack
docker stack deploy -c /mnt/compose/mfa.yml mfa
```

### Secrets in Code

The app loads secrets via file paths (Docker mounts secrets to `/run/secrets/`):

```typescript
// api/_lib/secrets.js
export function loadSecrets() {
  const secretMappings = {
    AIRTABLE_ACCESS_TOKEN: 'AIRTABLE_ACCESS_TOKEN_FILE',
    AIRTABLE_BASE_ID: 'AIRTABLE_BASE_ID_FILE',
    JWT_SECRET: 'JWT_SECRET_FILE',
    OPENAI_API_KEY: 'OPENAI_API_KEY_FILE',
    // ... SMTP fields, DATABASE_URL
  }

  for (const [envVar, fileEnvVar] of Object.entries(secretMappings)) {
    const filePath = process.env[fileEnvVar]
    if (filePath && fs.existsSync(filePath)) {
      process.env[envVar] = fs.readFileSync(filePath, 'utf8').trim()
    }
  }
}
```

## Deployment Commands

### Initial Deployment

```bash
# SSH to server
ssh -p 666 renaat@37.27.180.117

# Create data directories
mkdir -p /mnt/data/mfa-redis
mkdir -p /mnt/data/mfa-postgres

# Create all secrets (see Secrets section above)
# ... create 11 secrets

# Deploy stack
docker stack deploy -c /mnt/compose/mfa.yml mfa

# Run migrations
docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs

# Verify
docker service ls | grep mfa
```

### Standard Deployment (via Git Hook)

The recommended deployment method uses the git post-receive hook:

```bash
# From local machine
git push dev main
```

The hook automatically:
1. Checks out code from bare repo
2. Builds Docker image (x64 architecture)
3. Pushes to registry
4. Deploys via `docker stack deploy`

### Updating Deployment Manually

```bash
# Pull latest image
docker pull registry.shop.drvn.be/mfa:latest

# Deploy stack (updates all services)
docker stack deploy -c /mnt/compose/mfa.yml mfa

# Run migrations
docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs
```

### Viewing Logs

```bash
# App logs
docker service logs mfa_app -f --tail 50

# Worker logs (important for sync monitoring)
docker service logs mfa_worker -f --tail 50

# Redis logs
docker service logs mfa_redis -f --tail 20

# Postgres logs
docker service logs mfa_postgres -f --tail 20

# All services
for svc in app worker postgres redis; do
  echo "=== mfa_$svc ==="
  docker service logs mfa_$svc --tail 10
done
```

### Checking Status

```bash
# List all services
docker service ls | grep mfa

# Check specific service
docker service ps mfa_app
docker service ps mfa_worker
docker service ps mfa_postgres
docker service ps mfa_redis

# Inspect service details
docker service inspect mfa_app

# Check health status
docker inspect --format='{{json .Status.Health}}' $(docker ps -q -f name=mfa_app)
```

### Database Migrations

After deploying, run migrations:

```bash
docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs
```

### Scaling

```bash
# Scale app replicas (if needed)
docker service scale mfa_app=2

# Scale worker (usually keep at 1 to avoid duplicate sync)
docker service scale mfa_worker=1
```

### Rolling Back

```bash
# Rollback app service
docker service rollback mfa_app

# Rollback worker service
docker service rollback mfa_worker
```

### Removing Stack

**WARNING**: This will stop all services. Data volumes are preserved.

```bash
# Remove entire stack
docker stack rm mfa

# Verify removal
watch docker service ls

# Redeploy when ready
docker stack deploy -c /mnt/compose/mfa.yml mfa
```

## Networking

### Networks

- **mfa_internal:** Internal overlay network (app, worker, postgres, redis)
  - `internal: true` - no external access
- **traefik-public:** External network for ingress and API access
  - App: Traefik routes HTTP traffic
  - Worker: Needs external access for Airtable API calls

### Service Hostnames

**CRITICAL**: Service hostnames are prefixed with the stack name (`mfa`):

| Logical Name | Docker Hostname | Used In |
|--------------|----------------|---------|
| postgres | `mfa_postgres` | DATABASE_URL |
| redis | `mfa_redis` | REDIS_URL |
| app | `mfa_app` | Service name |
| worker | `mfa_worker` | Service name |

### Ports

| Service | Internal Port | External Access |
|---------|---------------|----------------|
| App | 3000 | Via Traefik (443) |
| Worker | - | Airtable API only |
| Redis | 6379 | Internal only |
| Postgres | 5432 | Internal only |

### DNS

The domain `mfa.drvn.be` points to the server IP (37.27.180.117).

### Why Worker Needs traefik-public

The worker service needs access to external APIs (Airtable). Without `traefik-public` network, the worker cannot reach the internet. It needs:
- `mfa_internal`: To communicate with postgres and redis
- `traefik-public`: To make HTTP requests to Airtable API

## SSL/TLS

SSL is handled by Traefik with Let's Encrypt:

```yaml
labels:
  - "traefik.http.routers.mfa.rule=Host(`mfa.drvn.be`)"
  - "traefik.http.routers.mfa.entrypoints=websecure"
  - "traefik.http.routers.mfa.tls.certresolver=leresolver"
```

Certificates are automatically renewed by Traefik.

## Health Checks

### App Health Check

```bash
# Manual check
curl https://mfa.drvn.be/api/health

# Expected response
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-06-20T12:00:00Z"
  }
}
```

### Docker Health Check

The Dockerfile includes a health check that Docker uses:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

### Redis Health Check

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## Monitoring

### Check Service Health

```bash
# Check all services
docker service ls

# Check specific service health
docker inspect --format='{{json .Status.Health}}' $(docker ps -q -f name=mfa_app)
```

### Resource Usage

```bash
# Container stats
docker stats

# Specific container
docker stats mfa_app.1.xxx
```

## Backup

### Redis Data

Redis data is persisted to `/mnt/data/mfa-redis`. Back up this directory:

```bash
# Stop Redis (optional, for consistency)
docker service scale mfa_redis=0

# Backup
tar -czvf redis-backup-$(date +%Y%m%d).tar.gz /mnt/data/mfa-redis

# Restart Redis
docker service scale mfa_redis=1
```

### Airtable

Airtable data is backed up via Airtable's built-in backup features or API exports.

## Troubleshooting

### Container Won't Start

```bash
# Check logs for all services
docker service logs mfa_app --tail 50
docker service logs mfa_worker --tail 50

# Check events
docker events --filter service=mfa_app

# Inspect task failures (shows full error)
docker service ps mfa_app --no-trunc
docker service ps mfa_worker --no-trunc

# Common issues:
# - Missing secrets (check docker secret ls)
# - Wrong service hostnames (mfa_postgres not postgres)
# - Image not found (check registry authentication)
```

### Cannot Connect to Redis

1. Check Redis is running: `docker service ls | grep redis`
2. Verify hostname: Must be `mfa_redis` (not `redis`)
3. Check environment variable: `REDIS_URL=redis://mfa_redis:6379`
4. Check Redis logs: `docker service logs mfa_redis`
5. Test connection:
   ```bash
   docker exec $(docker ps -q -f name=mfa_app) sh -c "ping -c 1 mfa_redis"
   ```

### Cannot Connect to Postgres

1. Check Postgres is running: `docker service ls | grep postgres`
2. Verify hostname: Must be `mfa_postgres` (not `postgres`)
3. Check DATABASE_URL format: `postgresql://postgres:password@mfa_postgres:5432/mfa`
4. Check Postgres logs: `docker service logs mfa_postgres`
5. Test connection:
   ```bash
   docker exec $(docker ps -q -f name=mfa_app) sh -c "pg_isready -h mfa_postgres -U postgres"
   ```

### Worker Not Syncing

1. Check worker logs: `docker service logs mfa_worker -f --tail 100`
2. Verify worker has both networks: `docker service inspect mfa_worker --format '{{json .Spec.TaskTemplate.Networks}}'`
3. Check Airtable API access: Worker needs `traefik-public` network
4. Check Redis for sync jobs:
   ```bash
   docker exec $(docker ps -q -f name=mfa_redis) redis-cli KEYS "sync:*"
   ```

### Database Migration Failed

1. Check app logs: `docker service logs mfa_app --tail 50`
2. Manually run migration:
   ```bash
   docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs
   ```
3. Check applied migrations:
   ```bash
   docker exec $(docker ps -q -f name=mfa_postgres) \
     psql -U postgres -d mfa -c 'SELECT * FROM schema_migrations;'
   ```

### New Secrets Not Applied

**IMPORTANT**: Adding secrets requires stack removal and redeployment:

```bash
# 1. Remove stack
docker stack rm mfa

# 2. Wait for complete shutdown
watch docker service ls

# 3. Verify no services running
docker service ls | grep mfa

# 4. Redeploy with new secrets
docker stack deploy -c /mnt/compose/mfa.yml mfa
```

Simply running `docker stack deploy` does NOT add new secrets to already-running services.

### SSL Certificate Issues

1. Verify DNS is correct: `dig mfa.drvn.be`
2. Check Traefik logs
3. Ensure port 80 is accessible for ACME challenge
4. Verify Traefik labels on app service

### High Memory Usage

1. Check Redis memory:
   ```bash
   docker exec $(docker ps -q -f name=mfa_redis) redis-cli INFO memory
   ```
2. Check Postgres stats:
   ```bash
   docker exec $(docker ps -q -f name=mfa_postgres) \
     psql -U postgres -d mfa -c "SELECT * FROM pg_stat_database WHERE datname='mfa';"
   ```
3. Clear cache: `curl -X POST https://mfa.drvn.be/api/cache/invalidate`
4. Restart services if needed

### Slow Response Times

1. Check Airtable API status
2. Verify Redis is caching properly
3. Check Postgres query performance
4. Review application logs for slow queries
5. Check worker sync lag (should be < 2 minutes)

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Registry
        run: echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login registry.shop.drvn.be -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin

      - name: Build and Push
        run: |
          docker build -t registry.shop.drvn.be/mfa:${{ github.sha }} .
          docker push registry.shop.drvn.be/mfa:${{ github.sha }}
          docker tag registry.shop.drvn.be/mfa:${{ github.sha }} registry.shop.drvn.be/mfa:latest
          docker push registry.shop.drvn.be/mfa:latest

      - name: Deploy to Swarm
        uses: appleboy/ssh-action@master
        with:
          host: 37.27.180.117
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            docker pull registry.shop.drvn.be/mfa:latest
            docker service update --image registry.shop.drvn.be/mfa:latest mfa_app
```
