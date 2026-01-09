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
