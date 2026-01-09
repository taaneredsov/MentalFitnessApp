# Requirements: Project Setup

## Overview

Initialize the base PWA project with React + Vite, Tailwind CSS, and shadcn/ui components. This establishes the foundation for a Progressive Web App that can be installed on Android and iOS devices.

## Goals

1. Create a React + Vite project configured for PWA capabilities
2. Set up Tailwind CSS with shadcn/ui component library
3. Configure PWA manifest for mobile installation
4. Prepare project structure for Vercel deployment with serverless functions
5. Set up environment variable handling for Airtable credentials

## Tech Stack

- **Framework**: React 18+ with Vite
- **Styling**: Tailwind CSS v3
- **Components**: shadcn/ui
- **PWA**: vite-plugin-pwa (Workbox)
- **Deployment**: Vercel (static + serverless)
- **Language**: TypeScript

## Acceptance Criteria

- [ ] Project initializes and runs locally with `npm run dev`
- [ ] Tailwind CSS is configured and working
- [ ] At least one shadcn/ui component is installed and renders
- [ ] PWA manifest is configured with app name, icons, and theme colors
- [ ] Service worker registers successfully
- [ ] App can be "installed" on mobile devices (Add to Home Screen)
- [ ] Project structure supports `/api` folder for Vercel serverless functions
- [ ] Environment variables load from `.env.local`
- [ ] TypeScript is configured with strict mode

## Dependencies

- None (this is the first feature)

## Related Features

- `api-layer` - Will add Airtable client and serverless functions
- `auth-system` - Will add JWT authentication
- `app-shell` - Will add navigation and tab structure
