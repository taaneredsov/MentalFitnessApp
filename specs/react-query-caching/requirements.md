# Requirements: React Query Client-Side Caching

## Overview

Add React Query (TanStack Query) for client-side data caching to improve perceived performance. Currently, navigating between pages triggers new API requests even though the server-side Redis cache responds quickly. Users still see loading spinners and experience delays due to network latency.

## Problem Statement

- Navigating away from a page and back triggers fresh API requests
- Users see loading spinners on every navigation
- Network latency makes the app feel slow despite server-side caching
- Reference data (methods, goals, days) is re-fetched unnecessarily
- No deduplication of simultaneous requests

## Solution

Implement React Query to:
- Cache API responses in browser memory
- Show cached data instantly when navigating back to a page
- Optionally refresh data in background (stale-while-revalidate)
- Deduplicate simultaneous requests
- Provide consistent loading/error state handling

## Acceptance Criteria

### React Query Setup
- [ ] TanStack Query v5 installed and configured
- [ ] QueryClient with sensible defaults (staleTime, gcTime)
- [ ] QueryClientProvider wrapping the app
- [ ] React Query DevTools available in development

### API Client Integration
- [ ] Custom hooks for each API endpoint (useGoals, useMethods, useDays, etc.)
- [ ] Hooks use consistent query keys
- [ ] Proper TypeScript types for all queries

### Caching Behavior
- [ ] Reference data (methods, goals, days) cached for 30 minutes (matches server TTL)
- [ ] User-specific data (programs) cached for 5 minutes
- [ ] Navigating back to a page shows cached data immediately
- [ ] No loading spinner for cached data

### Mutations
- [ ] Program creation/update invalidates relevant queries
- [ ] Optimistic updates for better UX (optional)

## Cache Strategy

### Long Cache (30 minutes) - Static Reference Data
- Methods (`/api/methods`)
- Goals (`/api/goals`)
- Days of Week (`/api/days`)

### Medium Cache (5 minutes) - User Data
- User profile
- User programs

### Short Cache (1 minute) - Dynamic Data
- Method usage records

## Dependencies

- @tanstack/react-query v5
- @tanstack/react-query-devtools (dev only)

## Related Features

- Complements server-side Redis caching (specs/vercel-kv-caching)
- Reduces network requests to cached API endpoints
