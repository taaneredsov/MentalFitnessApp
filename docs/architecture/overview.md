# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (PWA)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React 19 + TypeScript + Vite                           │   │
│  │  ├── TanStack Query (caching, state)                    │   │
│  │  ├── React Router v7                                    │   │
│  │  └── Tailwind CSS v4 + shadcn/ui                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Production Server (Hetzner)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Docker Swarm                                            │   │
│  │  ├── Traefik (reverse proxy, SSL)                        │   │
│  │  ├── Express Server (API + static files)                 │   │
│  │  └── Redis (caching)                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Airtable │   │  OpenAI  │   │   SMTP   │
        │(Database)│   │ (GPT-4o) │   │ (Email)  │
        └──────────┘   └──────────┘   └──────────┘
```

## Development vs Production

### Local Development

In development, we use **Vercel Dev** which:
- Runs Vite dev server for hot module replacement
- Serves API endpoints as serverless functions
- Automatically reloads on file changes

```bash
vercel dev --yes --listen 3333
```

### Production

In production, we use a **custom Express server** that:
- Serves the built Vite static files
- Wraps the same API handlers used in Vercel
- Runs in Docker containers orchestrated by Docker Swarm
- Uses Traefik for SSL termination and routing

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── AppHeader.tsx       # Navigation header
│   ├── FeedbackModal.tsx   # Method completion feedback
│   ├── ProgramCard.tsx     # Program display card
│   ├── ProgramEditDialog.tsx  # Edit active/planned programs
│   ├── PullToRefresh.tsx   # PWA pull-to-refresh
│   ├── ScoreWidgets.tsx    # Split score display (3 widgets)
│   ├── GoodHabitsSection.tsx  # Habit tracking component
│   ├── PersonalGoalsSection.tsx  # Personal goals display
│   ├── PersonalGoalDialog.tsx   # Create/edit personal goals
│   └── rewards/            # Rewards system components
├── contexts/
│   └── AuthContext.tsx     # Authentication state
├── hooks/
│   └── queries.ts          # TanStack Query hooks
├── pages/
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── ProgramsPage.tsx
│   ├── ProgramDetailPage.tsx
│   ├── MethodsPage.tsx
│   ├── MethodDetailPage.tsx
│   └── AccountPage.tsx
└── types/
    ├── user.ts
    ├── program.ts
    └── rewards.ts
```

### State Management

The app uses **TanStack Query (React Query)** for server state management:

```typescript
// Example: Fetching programs
const { data: programs, isLoading } = useQuery({
  queryKey: queryKeys.programs(userId),
  queryFn: () => fetchPrograms(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

Benefits:
- Automatic caching and background refetching
- Loading and error states
- Optimistic updates
- Request deduplication

### Authentication Flow

```
┌──────────┐    Login Request    ┌──────────┐
│  Client  │ ──────────────────► │   API    │
└──────────┘                     └──────────┘
     │                                │
     │                                ▼
     │                          ┌──────────┐
     │                          │ Airtable │
     │                          └──────────┘
     │                                │
     │       Access Token (1h)        │
     │ ◄──────────────────────────────┤
     │   + Refresh Cookie (7d)        │
     ▼                                │
┌──────────┐                          │
│localStorage│                        │
│(accessToken)│                       │
└──────────┘                          │
```

## Backend Architecture

### API Structure

All API endpoints follow this pattern:

```typescript
// api/[resource]/index.ts
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "GET") {
    // Handle GET
  } else if (req.method === "POST") {
    // Handle POST
  }
}
```

### Shared Libraries (`api/_lib/`)

| File | Purpose |
|------|---------|
| `airtable.js` | Airtable client initialization |
| `api-utils.js` | Response helpers (`sendSuccess`, `sendError`) |
| `cache.ts` | Redis caching layer |
| `email.ts` | Nodemailer setup for magic links |
| `field-mappings.js` | Airtable field ID mappings |
| `jwt.js` | JWT signing and verification |
| `openai.ts` | OpenAI client and prompt building |
| `password.js` | bcrypt password hashing |
| `secrets.js` | Docker Swarm secrets loader |
| `security.ts` | Security utilities (token hashing, etc.) |

### Database Design (Airtable)

The app uses Airtable as its database, with tables using **Dutch field names**.

See [API Reference](../api/endpoints.md) for the complete schema.

### Caching Strategy

Redis is used for caching frequently accessed data:

```typescript
// Cache key structure
const CACHE_KEYS = {
  methods: "mfa:methods:all",
  goals: "mfa:goals:all",
  days: "mfa:days:all",
  experienceLevels: "mfa:experience-levels:all"
}

// Cache TTL: 5 minutes
const CACHE_TTL = 300
```

Cache invalidation is available via:
- `POST /api/cache/invalidate` - Clear all caches
- Automatic expiry after TTL

## Security Considerations

### Authentication Security

1. **JWT Tokens**
   - Access tokens expire in 1 hour
   - Refresh tokens expire in 7 days
   - Refresh tokens stored as httpOnly cookies

2. **Password Security**
   - Passwords hashed with bcrypt
   - First-time users must set password

3. **Magic Link Security**
   - Tokens hashed with SHA-256 before storage
   - Codes hashed with HMAC-SHA256
   - 15-minute expiry
   - One-time use (cleared after verification)
   - Rate limiting (2-minute cooldown)
   - Timing attack prevention with random delays

### Input Validation

- All inputs validated with Zod schemas
- Airtable formula values escaped to prevent injection
- Record IDs validated against pattern `rec[A-Za-z0-9]{14}`

### Authorization

- API endpoints verify JWT tokens
- Users can only access their own data
- User ID from token used for queries (not from request body)

## Deployment Architecture

See [Deployment Guide](../deployment/hetzner.md) for detailed deployment information.

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Swarm Stack                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Traefik (reverse proxy)                            │    │
│  │  - SSL termination (Let's Encrypt)                   │    │
│  │  - Routes to services                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│           ┌───────────────┴───────────────┐                 │
│           ▼                               ▼                 │
│  ┌─────────────────┐            ┌─────────────────┐        │
│  │   MFA App       │            │     Redis       │        │
│  │   (Express)     │◄──────────►│   (Alpine)      │        │
│  └─────────────────┘            └─────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## AI Program Generation

The app uses OpenAI GPT-4o with Structured Outputs to generate personalized mental fitness programs.

### Flow

1. User selects goals, start date, duration, and days of week
2. Frontend calls `POST /api/programs/preview`
3. API fetches methods, goals, and program prompts from Airtable
4. System prompt is built with all context
5. GPT-4o generates schedule with Structured Outputs
6. User can edit the preview
7. User confirms, calling `POST /api/programs/confirm`
8. Program and schedule saved to Airtable

### Structured Output Schema

```typescript
{
  schedule: [{
    date: string,          // YYYY-MM-DD
    dayOfWeek: string,     // Dutch day name
    dayId: string,         // Airtable record ID
    methods: [{
      methodId: string,
      methodName: string,
      duration: number
    }]
  }],
  weeklySessionTime: number,
  recommendations: string[],
  programSummary: string
}
```

See [Programs Feature](../features/programs.md) for more details.
