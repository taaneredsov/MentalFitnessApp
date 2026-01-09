# Requirements: API Layer

## Overview

Create a secure API layer using Vercel serverless functions that connects to Airtable as the backend database. This layer will serve both the mobile PWA and future admin dashboard.

## Goals

1. Establish Airtable client with proper authentication
2. Create reusable API utilities for serverless functions
3. Build user-related API endpoints
4. Implement proper error handling and response formatting
5. Add request validation and sanitization

## Tech Stack

- **Runtime**: Vercel Serverless Functions (Node.js)
- **Database**: Airtable (via official SDK)
- **Validation**: Zod for schema validation
- **Language**: TypeScript

## Airtable User Table

**Existing fields:**
- Naam (Name)
- E-mailadres (Email address)
- Bedrijf (Company - linked record)
- Rol (Role)
- Taalcode (Language code)
- Profielfoto (Profile photo - attachment)

**Fields to add for auth:**
- password_hash (Single line text)
- created_at (Date with time)
- last_login (Date with time)

## Acceptance Criteria

- [ ] Airtable SDK is installed and configured
- [ ] API utility functions handle common operations (get, create, update)
- [ ] User lookup by email endpoint works
- [ ] User creation endpoint works (with password hashing)
- [ ] User update endpoint works
- [ ] All endpoints return consistent JSON response format
- [ ] Errors are properly caught and formatted
- [ ] API endpoints are protected from unauthorized access (preparation for auth)

## Dependencies

- `project-setup` - Base project must be initialized

## Related Features

- `auth-system` - Will use these endpoints for login/register
- `app-shell` - Will fetch user data for profile display