# MentalFitnessApp

A Progressive Web App (PWA) for corporate mental fitness programs.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Vercel Serverless Functions
- **Database**: Airtable
- **Auth**: JWT tokens

## Features (Planned)

- [x] Project specification
- [ ] PWA setup with offline support
- [ ] JWT authentication with Airtable users
- [ ] Bottom tab navigation
- [ ] Mobile-first responsive design

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_ID=
JWT_SECRET=
```

## Project Structure

```
├── api/                 # Vercel serverless functions
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components
│   ├── contexts/        # React contexts (auth, etc.)
│   ├── lib/             # Utilities and helpers
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript types
│   └── api/             # API client functions
├── public/              # Static assets and PWA icons
└── specs/               # Feature specifications
```

## Feature Specs

- `specs/project-setup/` - Initial project configuration
- `specs/api-layer/` - Airtable API integration
- `specs/auth-system/` - JWT authentication
- `specs/app-shell/` - Navigation and layout

## Cache Invalidation (Testing)

The app has multiple cache layers that can make testing new deployments challenging:
- **Service Worker** - Caches static assets (Workbox)
- **React Query** - Caches API responses (5-30 min)
- **Browser Caches** - HTTP cache storage

### Quick Cache Clear Methods

| Method | URL Parameter | Effect |
|--------|---------------|--------|
| Nuclear clear | `?bust=all` | Clears all caches + service worker + reloads |
| Service Worker only | `?bust=sw` | Unregisters SW + reloads |
| React Query only | `?bust=rq` | Clears API cache (no reload) |
| Debug panel | `?debug=true` | Shows debug panel with granular controls |

### Usage Examples

```
# Clear everything and get fresh content
https://mfa.drvn.be?bust=all

# Open debug panel for granular control
https://mfa.drvn.be?debug=true

# Clear only API cache
https://mfa.drvn.be?bust=rq
```

### Debug Panel Features

When `?debug=true` is added to any URL, a debug panel appears showing:

- **Build Info**: Version number, build hash, build timestamp
- **Cache Status**:
  - Service Worker state (active/waiting/none)
  - Browser cache count
  - React Query stats (total/stale queries)
- **Actions**:
  - Clear RQ - Clear React Query cache
  - Clear SW - Unregister service worker
  - Check Update - Force SW update check
  - Clear All - Nuclear option

### PWA Update Banner

When a new version is deployed while the app is open (especially as installed PWA), an "Update beschikbaar" banner appears at the bottom. Tapping "Update" activates the new service worker and reloads.

### Automatic Cache Clear on Version Change

When the app version changes (detected via build hash), React Query cache is automatically cleared to prevent stale data issues.
