# Deployment Guide - Hetzner Server

This guide covers deploying the Mental Fitness App to a Hetzner server running Docker Swarm.

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hetzner Cloud Server                         │
│                    IP: 37.27.180.117                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Docker Swarm                          │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Traefik (reverse proxy)                         │   │   │
│  │  │  - SSL termination (Let's Encrypt)               │   │   │
│  │  │  - Routes: mfa.drvn.be -> mfa_app                │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                         │                                │   │
│  │         ┌───────────────┴───────────────┐               │   │
│  │         ▼                               ▼               │   │
│  │  ┌─────────────────┐          ┌─────────────────┐      │   │
│  │  │   MFA App       │          │     Redis       │      │   │
│  │  │   (Express)     │◄────────►│   (Alpine)      │      │   │
│  │  │   Port 3000     │          │   Port 6379     │      │   │
│  │  └─────────────────┘          └─────────────────┘      │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Volumes:                                                       │
│  - /mnt/data/mfa-redis (Redis persistence)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Swarm initialized on the server
- Traefik configured as ingress controller
- Docker registry access (registry.shop.drvn.be)
- DNS configured for mfa.drvn.be

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

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    image: registry.shop.drvn.be/mfa:latest
    environment:
      - NODE_ENV=production
      - PORT=3000
      - AIRTABLE_ACCESS_TOKEN_FILE=/run/secrets/airtable_access_token
      - AIRTABLE_BASE_ID_FILE=/run/secrets/airtable_base_id
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
      - REDIS_URL=redis://redis:6379
    networks:
      - mfa_internal
      - traefik-public
    depends_on:
      - redis
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.mfa.rule=Host(`mfa.drvn.be`)"
        - "traefik.http.routers.mfa.entrypoints=websecure"
        - "traefik.http.routers.mfa.tls.certresolver=leresolver"
        - "traefik.http.services.mfa.loadbalancer.server.port=3000"
    secrets:
      - airtable_access_token
      - airtable_base_id
      - jwt_secret
      - openai_api_key
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - mfa_internal
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      placement:
        constraints:
          - node.role == manager
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  mfa_internal:
    driver: overlay
    internal: true
  traefik-public:
    external: true

secrets:
  airtable_access_token:
    external: true
    name: mfa_airtable_access_token
  airtable_base_id:
    external: true
    name: mfa_airtable_base_id
  jwt_secret:
    external: true
    name: mfa_jwt_secret
  openai_api_key:
    external: true
    name: mfa_openai_api_key

volumes:
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/mfa-redis
```

## Secrets Management

Docker Swarm secrets are used for sensitive configuration.

### Creating Secrets

```bash
# Create secrets (run on manager node)
echo "pat_xxx" | docker secret create mfa_airtable_access_token -
echo "appXXX" | docker secret create mfa_airtable_base_id -
echo "your-jwt-secret-min-32-chars" | docker secret create mfa_jwt_secret -
echo "sk-xxx" | docker secret create mfa_openai_api_key -
```

### Listing Secrets

```bash
docker secret ls
```

### Updating Secrets

Secrets cannot be updated directly. To change a secret:

1. Create new secret with different name
2. Update docker-compose.yml
3. Redeploy the stack

### Secrets in Code

The app loads secrets via file paths:

```typescript
// api/_lib/secrets.js
export function loadSecrets() {
  const secretMappings = {
    AIRTABLE_ACCESS_TOKEN: 'AIRTABLE_ACCESS_TOKEN_FILE',
    AIRTABLE_BASE_ID: 'AIRTABLE_BASE_ID_FILE',
    JWT_SECRET: 'JWT_SECRET_FILE',
    OPENAI_API_KEY: 'OPENAI_API_KEY_FILE'
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
ssh root@37.27.180.117

# Create data directory
mkdir -p /mnt/data/mfa-redis

# Deploy stack
docker stack deploy -c docker-compose.yml mfa
```

### Updating Deployment

```bash
# Pull latest image
docker pull registry.shop.drvn.be/mfa:latest

# Update the service (triggers rolling update)
docker service update --image registry.shop.drvn.be/mfa:latest mfa_app
```

### Viewing Logs

```bash
# App logs
docker service logs mfa_app -f

# Redis logs
docker service logs mfa_redis -f

# All stack logs
docker stack ps mfa
```

### Checking Status

```bash
# List services
docker service ls

# Inspect service
docker service inspect mfa_app

# View running tasks
docker service ps mfa_app
```

### Scaling

```bash
# Scale app replicas (if needed)
docker service scale mfa_app=2
```

### Rolling Back

```bash
# Rollback to previous version
docker service rollback mfa_app
```

### Removing Stack

```bash
# Remove entire stack
docker stack rm mfa
```

## Networking

### Networks

- **mfa_internal:** Internal overlay network for app-to-redis communication
- **traefik-public:** External network connecting to Traefik

### Ports

| Service | Internal Port | External |
|---------|---------------|----------|
| App | 3000 | Via Traefik (443) |
| Redis | 6379 | Internal only |

### DNS

The domain `mfa.drvn.be` should point to the server IP (37.27.180.117).

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
# Check logs
docker service logs mfa_app

# Check events
docker events --filter service=mfa_app

# Inspect task failures
docker service ps mfa_app --no-trunc
```

### Cannot Connect to Redis

1. Check Redis is running: `docker service ls`
2. Check network connectivity
3. Verify REDIS_URL environment variable
4. Check Redis logs: `docker service logs mfa_redis`

### SSL Certificate Issues

1. Verify DNS is correct
2. Check Traefik logs
3. Ensure port 80 is accessible for ACME challenge

### High Memory Usage

1. Check Redis memory: `docker exec -it $(docker ps -q -f name=mfa_redis) redis-cli INFO memory`
2. Clear cache: `curl -X POST https://mfa.drvn.be/api/cache/invalidate`
3. Restart services if needed

### Slow Response Times

1. Check Airtable API status
2. Verify Redis is caching properly
3. Check network latency
4. Review application logs for slow queries

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
