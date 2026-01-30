# Corporate Mental Fitness PWA - Documentation

## Overview

A Progressive Web App (PWA) for corporate mental fitness programs. Users can install it on Android/iOS and access mental fitness content including scheduled programs, good habits tracking, and a gamification rewards system.

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- Airtable account with configured base
- (Optional) Vercel CLI for local development

### Environment Setup

Create a `.env.local` file with the following variables:

```bash
# Airtable Configuration
AIRTABLE_ACCESS_TOKEN=pat...
AIRTABLE_BASE_ID=app...

# Authentication
JWT_SECRET=your-secret-key-min-32-chars

# OpenAI (for AI program generation)
OPENAI_API_KEY=sk-...

# Email (for magic link authentication)
SMTP_SERVER=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@example.com

# App URL (for magic link emails)
APP_URL=http://localhost:3333
```

### Running Locally

```bash
# Install dependencies
npm install

# Start development server with API functions
vercel dev --yes --listen 3333
```

> **Note:** Don't use `npm run dev` alone - it won't include the serverless API functions.

### Test User

```
Email: test@example.com
Password: testpassword123
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui |
| State Management | TanStack Query (React Query) |
| Backend | Vercel Serverless Functions (local), Express (production) |
| Database | Airtable |
| Authentication | JWT (jose library) with httpOnly cookie refresh tokens |
| AI | OpenAI GPT-4o with Structured Outputs |
| Deployment | Docker Swarm on Hetzner |

## Documentation Structure

- **[Recent Changes](./RECENT-CHANGES.md)** - ⭐ Latest feature implementations (Jan 2026)
- **[Architecture Overview](./architecture/overview.md)** - System architecture and design decisions
- **[API Reference](./api/endpoints.md)** - Complete API endpoint documentation
- **Features**
  - [Authentication](./features/authentication.md) - JWT + Magic Link auth system
  - [Programs](./features/programs.md) - Mental fitness programs
  - [Program Status](./features/program-status.md) - Auto-set program status field
  - [One Active Program Limit](./features/one-active-program-limit.md) - Single active program enforcement
  - [Habits](./features/habits.md) - Good habits tracking
  - [Personal Goals](./features/personal-goals.md) - User-created custom goals
  - [Rewards](./features/rewards.md) - Gamification system
  - [Score Widgets](./features/score-widgets.md) - Split score display (3 widgets)
  - [Header Display](./features/header-points-display.md) - Streak-only header
- **[Deployment Guide](./deployment/hetzner.md)** - Production deployment on Hetzner

## Project Structure

```
corporate-mental-fitness-program/
├── api/                    # Vercel serverless functions
│   ├── _lib/              # Shared utilities (not endpoints)
│   │   ├── airtable.js    # Airtable client setup
│   │   ├── api-utils.js   # Response helpers
│   │   ├── cache.ts       # Redis caching
│   │   ├── email.ts       # Email sending
│   │   ├── field-mappings.js # Airtable field mappings
│   │   ├── jwt.js         # JWT utilities
│   │   ├── openai.ts      # OpenAI integration
│   │   ├── password.js    # bcrypt helpers
│   │   ├── secrets.js     # Docker secrets loader
│   │   └── security.ts    # Security utilities
│   ├── auth/              # Authentication endpoints
│   ├── cache/             # Cache management
│   ├── companies/         # Company lookup
│   ├── days/              # Days of week data
│   ├── goals/             # Goals data
│   ├── habit-usage/       # Habit tracking
│   ├── method-usage/      # Method completion tracking
│   ├── methods/           # Mental fitness methods
│   ├── programs/          # Program management
│   ├── rewards/           # Rewards system
│   └── users/             # User management
├── src/
│   ├── components/        # React components
│   │   └── ui/           # shadcn/ui components
│   ├── contexts/         # React contexts (AuthContext)
│   ├── hooks/            # Custom hooks (queries)
│   ├── lib/              # Frontend utilities
│   ├── pages/            # Page components
│   └── types/            # TypeScript types
├── specs/                # Feature specifications
├── docs/                 # Documentation (you are here)
├── server.ts             # Production Express server
├── Dockerfile            # Production container
└── docker-compose.yml    # Docker Swarm configuration
```

## Key Features

### Mental Fitness Programs
- AI-powered program generation using GPT-4o
- Manual program creation
- Edit active and planned programs with schedule regeneration
- Scheduled sessions with specific methods
- Progress tracking with milestones
- One active program limit (focus on completion)
- Program status tracking (Actief, Gepland, Afgewerkt)

### Good Habits (Goede gewoontes)
- Daily habit tracking
- Methods linked to "Goede gewoontes" goal
- Visual completion indicators

### Personal Goals
- User-created custom goals
- Unlimited completions per day
- 10 bonus points per completion
- Separate score widget display

### Rewards System
- Split score display (Mental Fitness, Personal Goals, Habits)
- Points for completing methods, habits, and personal goals
- Streak tracking (daily activity)
- Badges for achievements
- 10 experience levels
- Milestone rewards (25%, 50%, 75%, 100%)

## GitHub

- Repository: [github.com/taaneredsov/MentalFitnessApp](https://github.com/taaneredsov/MentalFitnessApp)
- Project Board: [github.com/users/taaneredsov/projects/7](https://github.com/users/taaneredsov/projects/7)
