# Agent Configuration

## Build Commands

```bash
# TypeScript check (no emit)
npx tsc --noEmit

# Full production build
npm run build

# Lint (if available)
npm run lint
```

## Test Commands

```bash
# No automated tests currently configured
# Manual testing via browser
```

## Development Server

**DO NOT RUN** - User manages the dev server externally:
```bash
vercel dev --yes --listen 3333
```

## API Testing

Test API endpoints directly:
```bash
# Get Airtable schema (use token from .env.local)
source .env.local
curl -s "https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables" -H "Authorization: Bearer ${AIRTABLE_ACCESS_TOKEN}"

# Test personal goal usage (requires valid JWT)
curl -X POST http://localhost:3333/api/personal-goal-usage \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<id>","personalGoalId":"<id>","date":"2026-01-30"}'
```

## Git Commands

```bash
# Stage and commit
git add <files>
git commit -m "message"

# Push to GitHub (HTTPS with gh auth)
git push origin <branch>
```

## Key Airtable Tables

| Table | ID |
|-------|-----|
| Gebruikers | tbl6i8jw3DNSzcHgE |
| Persoonlijke doelen | tblbjDv35B50ZKG9w |
| Persoonlijk doelgebruik | tbl8eJeQtMnIF5EJo |
| Mentale Fitnessprogramma's | tblqW4xeCx1tprNgX |

## Project Type

- **Language**: TypeScript
- **Framework**: React 19 + Vite
- **Backend**: Vercel Serverless Functions
- **Package Manager**: npm
