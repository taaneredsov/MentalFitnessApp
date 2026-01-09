# Requirements: Auth System

## Overview

Implement JWT-based authentication for the PWA, including login, logout, protected routes, and auth state management. Users authenticate against the Airtable Users table.

## Goals

1. Implement secure JWT token-based authentication
2. Create login/logout API endpoints
3. Build React auth context for state management
4. Add protected route wrapper component
5. Create login page UI

## Tech Stack

- **JWT**: jose library (Edge-compatible)
- **State**: React Context + localStorage
- **Cookies**: httpOnly cookies for refresh tokens
- **Forms**: React Hook Form + Zod validation

## Authentication Flow

1. User enters email + password on login page
2. Frontend calls POST /api/auth/login
3. Backend verifies credentials against Airtable
4. Backend returns JWT access token (short-lived) + sets refresh token cookie
5. Frontend stores access token and user data in context
6. Protected routes check auth context
7. Token refresh happens automatically before expiration

## Acceptance Criteria

- [ ] POST /api/auth/login endpoint authenticates users
- [ ] POST /api/auth/logout endpoint clears session
- [ ] POST /api/auth/refresh endpoint refreshes access token
- [ ] GET /api/auth/me endpoint returns current user
- [ ] Auth context provides user state to all components
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Login page with email/password form
- [ ] Form validation with helpful error messages
- [ ] Loading states during authentication
- [ ] Persistent login across page refreshes

## Security Requirements

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Refresh tokens stored in httpOnly cookies
- Passwords verified with bcrypt
- JWT signed with secret from environment variable

## Dependencies

- `project-setup` - Base project structure
- `api-layer` - User lookup and update functions

## Related Features

- `app-shell` - Will use auth state for navigation/profile
