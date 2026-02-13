# Lessons Learned

## Project-Specific Gotchas

### Local Dev vs Production
- `api/_lib/airtable.js` uses dotenv to explicitly load `.env.local` for local development
- **Routes must be registered in server.ts** for production Express server
- Missing routes in server.ts returns `{ error: "Not found" }` on production
- Local dev uses `npm run dev` (Vite + Express), production uses Docker Swarm

### SPA Rewrites
- Don't add SPA rewrites to `vercel.json` for dev - causes Vite to parse HTML as JavaScript

### Airtable
- Use `YYYY-MM-DD` format for Date fields, not full ISO strings
- `Aangemaakt op` is a computed field - don't write to it
- Linked record filtering in Airtable formulas is unreliable - filter in JavaScript instead
- Formula fields (scores) are read-only - app cannot write to them

### Zod Version
- Using Zod v3.x (not v4) for TypeScript compatibility with @vercel/node

### Points/Rewards System
- **Three separate Airtable formula fields** calculate scores automatically:
  - Mental Fitness Score = method_usage count × 10
  - Personal Goals Score = personal_goal_usage count × 10
  - Good Habits Score = habit_usage count × 5
- `bonusPoints` field is ONLY for milestones/streaks - do NOT add regular activity points there
- Adding to bonusPoints when formula already counts = double counting bug

### Program Schedule & Progress
- Method usage records are linked to Programmaplanning sessions
- When regenerating schedule, orphaned method_usage records lose their link
- **Solution**: Link method_usage to program directly before deleting sessions
- Progress calculation must include both session-linked AND program-linked usages

### PWA Session Persistence
- Access token (1h) stored in localStorage
- Refresh token (7d) stored as httpOnly cookie
- Users stay logged in as long as they use app within 7 days
- PWA installation may require re-login (known limitation)

---

## Patterns to Avoid

### 2024-02-03: Missing Server Routes
**Mistake**: Added API endpoints in `api/` folder but forgot to register them in `server.ts`
**Symptom**: "Not found" error on production (Hetzner)
**Fix**: Always update `server.ts` when adding new API endpoints
**Prevention**: After adding any `api/*.ts` file, immediately add route to `server.ts`

### 2024-02-03: Points Double Counting
**Mistake**: Added points to bonusPoints field when Airtable formula already counts them
**Symptom**: Users getting 2x points for personal goals
**Fix**: Only update streak fields in personal-goal-usage, not bonusPoints
**Prevention**: Before modifying points logic, trace where each score comes from (formula vs field)

### 2024-02-03: Progress Lost on Schedule Regeneration
**Mistake**: Deleting Programmaplanning sessions also orphaned linked method_usage records
**Symptom**: Progress resets to 0% after editing program
**Fix**: Link method_usage to program before deleting sessions; include in progress calculation
**Prevention**: When deleting records with linked children, preserve or migrate the links first

### 2024-02-03: Phantom Bug Reports
**Mistake**: Assumed "blue screen" report was a crash/error
**Reality**: User saw blue "Gepland" status badge - expected UI, not a bug
**Prevention**: Before investigating, ask for screenshots or exact reproduction steps

### 2026-02-03: iOS Scroll Broken by overflow-x-hidden
**Mistake**: Added `overflow-x: hidden` to body/html to prevent horizontal scroll
**Symptom**: Vertical scrolling completely broken on iOS Safari/PWA
**Fix**: Use `overflow-x: clip` on html element only - prevents horizontal scroll without creating a scroll container
**Prevention**: Never use `overflow-x: hidden` on body for iOS apps. Use `overflow-x: clip` instead, which clips without affecting scroll behavior.

### 2026-02-03: iOS Video Forced Fullscreen
**Mistake**: Video element without `playsInline` attribute
**Symptom**: Video playback forces fullscreen on iOS, breaking feedback prompt UX
**Fix**: Add `playsInline` and `webkit-playsinline=""` attributes to video element
**Prevention**: Always add playsInline to video elements for mobile-first apps

### 2026-02-03: Method Usage Registration Timing
**Pattern**: Register method usage when feedback dialog OPENS, not when user clicks save/skip
**Reason**: Users may dismiss dialog without interacting, but usage should still be recorded
**Implementation**: Use `useEffect` watching `showFeedback` state, with `usageRegisteredRef` to prevent duplicates
**Benefit**: Usage is always tracked, feedback/remarks are optional

### 2026-02-10: Docker Swarm Service Hostnames
**CRITICAL**: Service hostnames in Docker Swarm are prefixed with the stack name.
- **Wrong**: `redis://redis:6379` or `postgresql://postgres@postgres:5432/db`
- **Correct**: `redis://mfa_redis:6379` and `postgresql://postgres@mfa_postgres:5432/mfa`
- **Why**: Multiple stacks share the same Swarm network namespace
- **Impact**: Services won't resolve hostnames and connection will fail
- **Prevention**: Always use stack-prefixed hostnames in connection strings

### 2026-02-10: Adding Docker Secrets Requires Stack Removal
**CRITICAL**: Simply running `docker stack deploy` does NOT add new secrets to running services.
- **Wrong**: Create secret → `docker stack deploy` → expect service to get new secret
- **Correct**: Create secret → `docker stack rm mfa` → wait for shutdown → `docker stack deploy`
- **Why**: Swarm doesn't modify running containers when secrets change
- **Impact**: Services won't have access to new secrets, causing auth failures
- **Prevention**: Always do full stack removal when adding new secrets

### 2026-02-10: Worker Needs External Network for API Access
**Pattern**: Worker service needs BOTH `mfa_internal` AND `traefik-public` networks
- **mfa_internal**: For postgres/redis communication
- **traefik-public**: For external API calls (Airtable)
- **Why**: Internal-only networks block all external traffic
- **Impact**: Without traefik-public, worker cannot sync with Airtable
- **Prevention**: Services that call external APIs need a public network attachment

### 2026-02-10: ESM Main Guard in Docker
**Pattern**: Node.js ESM files with `if (import.meta.url === \`file://\${process.argv[1]}\`) {}` fail in Docker
- **Wrong**: `if (import.meta.url.endsWith(process.argv[1]))`
- **Correct**: Use absolute path comparison or separate entry point file
- **Why**: Docker paths may differ from local paths
- **Impact**: Main guard never evaluates true, script doesn't run
- **Prevention**: Keep worker entry points simple, no conditional execution

### 2026-02-10: Worker Healthcheck Must Be Disabled
**CRITICAL**: The worker service uses the same Docker image as the app, which includes a HEALTHCHECK that pings `localhost:3000/api/health`.
- **Problem**: Worker doesn't serve HTTP, so health checks always fail
- **Impact**: After 3 failed checks (~90s), Docker Swarm kills the worker with SIGTERM, causing a restart loop
- **Fix**: Add `healthcheck: disable: true` in docker-compose.yml for the worker service
- **Prevention**: When using the same image for a worker, always override/disable the healthcheck

### 2026-02-10: Graceful Shutdown Must Not Close Pool While In-Flight
**Pattern**: SIGTERM handler should NOT immediately call `closeDbPool()` while async operations are in-flight.
- **Problem**: Closing pool while queries are running causes "Cannot use a pool after calling end on the pool" errors
- **Fix**: Set a `shuttingDown` flag, let the loop exit naturally, THEN close connections
- **Prevention**: Shutdown handlers should only set flags, not destroy resources still in use

### 2026-02-10: Migration Step Must Be Manual
**Pattern**: Database migrations are NOT run automatically during deploy
- **Why**: Migrations might fail or require rollback, should be explicit
- **When**: After successful docker stack deploy
- **How**: `docker exec $(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs`
- **Prevention**: Add to deployment checklist, never assume migrations auto-run

---

## Deployment Checklist

Before deploying to production:
1. [ ] All new API endpoints added to `server.ts`
2. [ ] TypeScript compiles without errors: `npm run build`
3. [ ] Test locally with `npm run dev`
4. [ ] Commit and push to GitHub: `git push origin main`
5. [ ] Deploy to Hetzner: `git push dev main`
6. [ ] Run migrations: `ssh -p 666 renaat@37.27.180.117 "docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"`
7. [ ] Verify deployment: `curl https://mfa.drvn.be/api/health`
8. [ ] Check all services: `ssh -p 666 renaat@37.27.180.117 "docker service ls | grep mfa"`
9. [ ] Monitor worker logs: `ssh -p 666 renaat@37.27.180.117 "docker service logs mfa_worker --tail 50"`

### 2026-02-03: ARM vs x64 Architecture
**CRITICAL**: Always build Docker images ON the Hetzner server, not locally.
- Local machine: ARM (Apple Silicon MacBook)
- Hetzner server: x64 (Linux)
- Building locally produces ARM images that won't run on x64

### 2026-02-13: docker stack deploy Does NOT Force-Restart Services
**CRITICAL**: `docker stack deploy` with the same `:latest` tag does NOT restart containers.
- **Problem**: Hook built new image as `:latest`, ran `docker stack deploy`, but Swarm saw same tag → no restart
- **Symptom**: Server kept serving old code despite successful deploy
- **Fix**: After `docker stack deploy`, run `docker service update --force --image IMAGE:TAG mfa_app`
- **Why `:TAG` not `:latest`**: Using the unique tag (e.g. `20260213-161258-04c85d1`) ensures Swarm sees a genuine image change
- **Prevention**: Always force-update services after stack deploy, use unique tags

### 2026-02-13: GitHub CI/CD Deploy Never Worked
**Issue**: The `.github/workflows/ci-deploy.yml` build-and-deploy job requires `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `HETZNER_HOST`, `HETZNER_SSH_USER`, `HETZNER_SSH_KEY` — none of these GitHub secrets were configured.
- **Impact**: Test job passed, but deploy was always skipped/failed
- **Primary deploy method**: `git push dev main` via bare repo post-receive hook
- **To enable GitHub CI deploy**: Add secrets in GitHub repo settings → Secrets → Actions

---

## Deployment Infrastructure

### Primary Method: Git Push (Fully Automatic)
```bash
git push dev main
```
Triggers post-receive hook at `/mnt/repo/mfa.git/hooks/post-receive` which:
1. Checks out code to `/mnt/data/mfa/`
2. Builds Docker image on server (x64 native)
3. Tags with timestamp+commit hash AND `:latest`
4. Pushes to private registry `registry.shop.drvn.be`
5. Runs `docker stack deploy` to update compose
6. Force-updates `mfa_app` and `mfa_worker` services with unique tag
7. Runs database migrations automatically
8. Runs health check

### Server Layout
```
/mnt/repo/mfa.git          # Bare git repo (push target)
/mnt/data/mfa/              # Working directory (checkout target)
/mnt/compose/mfa.yml        # Active compose file (copied from repo)
/mnt/auth/registry.password # Registry htpasswd (testuser + renaat)
```

### Registry
- **URL**: `registry.shop.drvn.be`
- **Auth**: Docker login stored at `~/.docker/config.json` on server (user: renaat)
- **Credentials file**: `/mnt/auth/registry.password` (htpasswd format)

### Docker Swarm Services
- `mfa_app` — Express server + Vite static files (port 3000, healthcheck enabled)
- `mfa_worker` — Airtable↔Postgres sync worker (healthcheck disabled)
- `mfa_postgres` — PostgreSQL 16 Alpine
- `mfa_redis` — Redis 7 Alpine
- Secrets: All `mfa_*` prefixed in Docker secrets (see `docker secret ls | grep mfa`)

### Manual Deployment (if hook fails)
```bash
ssh -p 666 renaat@37.27.180.117 "cd /mnt/data/mfa && git --git-dir=/mnt/repo/mfa.git --work-tree=. checkout -f main"
ssh -p 666 renaat@37.27.180.117 "cd /mnt/data/mfa && docker build -t registry.shop.drvn.be/mfa:latest . && docker push registry.shop.drvn.be/mfa:latest"
ssh -p 666 renaat@37.27.180.117 "docker service update --force --image registry.shop.drvn.be/mfa:latest mfa_app"
ssh -p 666 renaat@37.27.180.117 "docker service update --force --image registry.shop.drvn.be/mfa:latest mfa_worker"
ssh -p 666 renaat@37.27.180.117 "sleep 15 && docker exec \$(docker ps -q -f name=mfa_app) node tasks/db-migrate.mjs"
```

### PWA Update Delivery
- Service worker (`sw.js`) served with `Cache-Control: no-cache` so browsers always check
- `PWAUpdatePrompt` component checks for SW updates every 60s + on app focus
- New SW activates immediately (`skipWaiting` + `clientsClaim`)
- App auto-reloads when new SW takes control — no user interaction needed

---

## Key Architecture Decisions

- **One active program per user** - enforced in API, don't reopen
- **Cumulative scoring** - total score persists across programs
- **Program statuses**: Actief, Gepland, Afgewerkt
- **Manual creation type**: "Manueel" vs "AI" for tracking
