# Corporate Mental Fitness PWA

## Project Overview
A Progressive Web App for corporate mental fitness programs. Users can install it on Android/iOS and access mental fitness content.

## Tech Stack
- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Vercel Serverless Functions
- **Database**: Airtable
- **Auth**: JWT (jose library) with httpOnly cookie refresh tokens

## Running Locally

```bash
# Start the dev server (includes both frontend and API)
vercel dev --yes --listen 3333
```

The user will run the dev server, never run the dev server yourself unless explicitly asked to do.

**Note**: Don't use `npm run dev` alone - it won't include the serverless API functions.

## Environment Variables

Required in `.env.local`:
```
AIRTABLE_ACCESS_TOKEN=pat...
AIRTABLE_BASE_ID=app...
AIRTABLE_USER_TABLE_ID=tbl... or table name
JWT_SECRET=random-secret-string
```

## Airtable Schema

The User table uses **Dutch field names**:

| Field | Dutch Name | Type |
|-------|------------|------|
| Name | Naam | Single line text |
| Email | E-mailadres | Email |
| Company | Bedrijf | Linked record |
| Role | Rol | Single line text |
| Language Code | Taalcode | Single line text |
| Profile Photo | Profielfoto | Attachment |
| Password Hash | Paswoord Hash | Single line text |
| Created At | Aangemaakt op | Created time (computed) |
| Last Login | Laatste login | Date |

**Important**: `Aangemaakt op` is a computed field - don't try to write to it.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Clear refresh token |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user |
| `/api/users` | POST | Create new user |
| `/api/users/[id]` | PATCH | Update user |
| `/api/users/lookup` | GET | Find user by email |

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── _lib/              # Shared code (not endpoints)
│   │   ├── airtable.js    # Airtable client
│   │   ├── api-utils.js   # Response helpers
│   │   ├── jwt.js         # JWT utilities
│   │   ├── password.js    # bcrypt helpers
│   │   └── user.js        # User types & transform
│   ├── auth/              # Auth endpoints
│   └── users/             # User endpoints
├── src/
│   ├── components/        # React components
│   │   └── ui/           # shadcn/ui components
│   ├── contexts/         # React contexts (AuthContext)
│   ├── lib/              # Frontend utilities
│   ├── pages/            # Page components
│   └── types/            # TypeScript types
└── specs/                # Feature specifications
```

## Known Issues & Gotchas

1. **Vercel dev env vars**: The `api/_lib/airtable.js` uses dotenv to explicitly load `.env.local` because Vercel dev doesn't inject env vars at module load time.

2. **SPA Rewrites**: Don't add SPA rewrites to `vercel.json` for dev - they cause Vite to parse HTML as JavaScript.

3. **Airtable Date Format**: Use `YYYY-MM-DD` format for Date fields, not full ISO strings.

4. **Zod Version**: Using Zod v3.x (not v4) for TypeScript compatibility with @vercel/node.

## Test User

```
Email: test@example.com
Password: testpassword123
```

## GitHub

- Repo: github.com/taaneredsov/MentalFitnessApp
- Project Board: github.com/users/taaneredsov/projects/7

## Deployment

**Production URL**: https://mfa.drvn.be

For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md). Always reference that file when deploying to the Hetzner server.
