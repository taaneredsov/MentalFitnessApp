# Lessons Learned

## Project-Specific Gotchas

### Vercel Dev vs Docker/Hetzner
- `api/_lib/airtable.js` uses dotenv to explicitly load `.env.local` because Vercel dev doesn't inject env vars at module load time
- **Routes must be registered in BOTH places**:
  - `api/` folder (for Vercel)
  - `server.ts` (for Docker/Hetzner Express server)
- Missing routes in server.ts returns `{ error: "Not found" }` on production

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
**Symptom**: "Not found" error on production (Hetzner) but works on Vercel
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

---

## Deployment Checklist

Before deploying to Hetzner:
1. [ ] All new API endpoints added to `server.ts`
2. [ ] TypeScript compiles without errors
3. [ ] Test locally with `vercel dev`
4. [ ] Commit and push to GitHub
5. [ ] Deploy: `ssh hetzner-code` → git pull → docker build → docker push → service update

### 2026-02-03: ARM vs x64 Architecture
**CRITICAL**: Always build Docker images ON the Hetzner server, not locally.
- Local machine: ARM (Apple Silicon MacBook)
- Hetzner server: x64 (Linux)
- Building locally produces ARM images that won't run on x64

**Deployment steps**:
```bash
git push origin main
ssh -p 666 renaat@37.27.180.117 "cd /mnt/build/mfa && git pull origin main"
ssh -p 666 renaat@37.27.180.117 "cd /mnt/build/mfa && docker build -t registry.shop.drvn.be/mfa:latest . && docker push registry.shop.drvn.be/mfa:latest"
ssh -p 666 renaat@37.27.180.117 "docker service update --force mfa_app"
```

**Private Registry**: `registry.shop.drvn.be`
**Build Path**: `/mnt/build/mfa`
**Compose Path**: `/mnt/compose/mfa.yml`

---

## Key Architecture Decisions

- **One active program per user** - enforced in API, don't reopen
- **Cumulative scoring** - total score persists across programs
- **Program statuses**: Actief, Gepland, Afgewerkt
- **Manual creation type**: "Manueel" vs "AI" for tracking
