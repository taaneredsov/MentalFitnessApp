# Deployment Guide - Hetzner Server

This document describes how to deploy the Mental Fitness App to the Hetzner production server.

## Server Details

| Property | Value |
|----------|-------|
| Host | hetzner-code (37.27.180.117:666) |
| User | renaat |
| App path | /mnt/data/mfa |
| Compose file | /mnt/compose/mfa.yml |
| Registry | registry.shop.drvn.be/mfa:latest |
| Live URL | https://mfa.drvn.be |

## Quick Deploy

Run these commands from your local machine:

```bash
# 1. Fetch latest code from GitHub
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && git fetch origin main"

# 2. Checkout to working directory
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && GIT_WORK_TREE=/mnt/data/mfa git checkout -f origin/main"

# 3. Build Docker image
ssh -p 666 renaat@37.27.180.117 "cd /mnt/data/mfa && docker build -t registry.shop.drvn.be/mfa:latest ."

# 4. Push to registry
ssh -p 666 renaat@37.27.180.117 "docker push registry.shop.drvn.be/mfa:latest"

# 5. Deploy via Docker Swarm
ssh -p 666 renaat@37.27.180.117 "docker stack deploy -c /mnt/compose/mfa.yml mfa"

# 6. Force update to pull new image
ssh -p 666 renaat@37.27.180.117 "docker service update --force mfa_app"

# 7. Verify deployment
curl -s https://mfa.drvn.be/api/health

# 8. Clean up unused images (recommended)
ssh -p 666 renaat@37.27.180.117 "docker system prune -af"
```

## One-liner Deploy

```bash
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && git fetch origin main && GIT_WORK_TREE=/mnt/data/mfa git checkout -f origin/main && cd /mnt/data/mfa && docker build -t registry.shop.drvn.be/mfa:latest . && docker push registry.shop.drvn.be/mfa:latest && docker service update --force mfa_app && docker system prune -af"
```

## Verification

```bash
# Check service status
ssh -p 666 renaat@37.27.180.117 "docker service ps mfa_app"

# Check service logs
ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_app --tail 50"

# Health check
curl -s https://mfa.drvn.be/api/health
```

## Architecture

- **Git Repository**: `/mnt/repo/mfa.git` (bare repo synced with GitHub)
- **Working Directory**: `/mnt/data/mfa` (checkout of the code)
- **Redis Data**: `/mnt/data/mfa-redis`
- **Docker Swarm Stack**: `mfa` (app + redis services)
- **Reverse Proxy**: Traefik (handles SSL via Let's Encrypt)

## Rollback

To rollback to a previous version:

```bash
# Check available commits
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && git log origin/main --oneline -10"

# Checkout specific commit
ssh -p 666 renaat@37.27.180.117 "cd /mnt/repo/mfa.git && GIT_WORK_TREE=/mnt/data/mfa git checkout -f <commit-hash>"

# Rebuild and deploy
ssh -p 666 renaat@37.27.180.117 "cd /mnt/data/mfa && docker build -t registry.shop.drvn.be/mfa:latest . && docker push registry.shop.drvn.be/mfa:latest && docker service update --force mfa_app"
```

## Secrets

Secrets are managed via Docker Swarm secrets (not environment files):

- `mfa_airtable_access_token`
- `mfa_airtable_base_id`
- `mfa_jwt_secret`
- `mfa_openai_api_key`
- `mfa_smtp_server`
- `mfa_smtp_port`
- `mfa_smtp_user`
- `mfa_smtp_password`
- `mfa_smtp_from`

To update a secret:

```bash
# Remove old secret
ssh -p 666 renaat@37.27.180.117 "docker secret rm mfa_secret_name"

# Create new secret
echo "new-value" | ssh -p 666 renaat@37.27.180.117 "docker secret create mfa_secret_name -"

# Redeploy to pick up changes
ssh -p 666 renaat@37.27.180.117 "docker service update --force mfa_app"
```
