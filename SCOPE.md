# Corporate Mental Fitness PWA - Scope Document

**Last Updated:** 2026-01-27 (Magic Link Login + Testing Infrastructure completed)
**Product Owner Audit**

---

## Executive Summary

The Corporate Mental Fitness PWA is a Progressive Web App designed to deliver structured mental fitness programs to corporate users. The app enables users to access guided methods (audio/video content), track their progress, build daily habits, and earn rewards for their engagement.

**Current Status:** The application has a solid foundation with authentication, program management, method tracking, and a rewards system fully implemented. The core user experience is functional, though several enhancements remain in planning or partial implementation.

---

## Current State Analysis

### Fully Implemented and Working

The following features are production-ready and functional:

1. **Authentication System**
   - JWT-based auth with httpOnly cookies for refresh tokens
   - **Magic Link Login** (primary): Email-based passwordless login with:
     - Clickable magic link (`/auth/verify?token=xxx`)
     - 6-digit code fallback for PWA users (`/auth/code`)
     - 15-minute token/code expiration
     - One-time use tokens (deleted after verification)
   - Password login (alternative): Two-step email → password flow
   - First-time user detection and password setup flow
   - Auto-refresh tokens (10-minute intervals)
   - Protected routes with redirect to login

2. **Program Management**
   - View all programs grouped by status (Running/Planned/Finished)
   - AI-powered program generation with OpenAI GPT-4o
   - Manual program creation wizard
   - Program detail pages with full schedule visibility
   - Progress tracking based on method completion
   - Schedule display via Programmaplanning records

3. **Method Library**
   - Browse all available methods
   - Method detail pages with descriptions
   - Audio/video media playback
   - Media progress tracking (80% completion threshold)
   - Method usage recording with feedback modal

4. **Good Habits System**
   - Daily habit display on home page
   - Checkbox tracking with optimistic UI updates
   - Persistent storage in Airtable (Gewoontegebruik table)
   - Points awarded for habit completion
   - Expand/collapse for full descriptions

5. **Rewards & Gamification**
   - Points system (methods: 10pts, habits: 5pts, milestones: 25pts)
   - 10-level progression system with Dutch titles
   - Badge system with ~10 initial badges
   - Streak tracking (current and longest)
   - Level progress display on account page
   - Reward toasts for points/badges/level-ups
   - Program milestone rewards (25%, 50%, 75%, 100%)

6. **PWA Features**
   - Installability prompt (Android/Chrome + iOS with instructions)
   - Offline-capable with Workbox service worker
   - App manifest with proper icons and theme colors
   - Airtable API caching (1-hour max age)
   - Pull-to-refresh on home page

7. **UI/UX Infrastructure**
   - Responsive mobile-first design
   - Bottom navigation (Home, Programs, Methods, Account)
   - React Query for data caching and optimistic updates
   - shadcn/ui component library
   - Tailwind CSS v4 styling

### Partially Implemented

1. **Testing Infrastructure** (80% COMPLETE)
   - Vitest and Playwright configured
   - **158 unit tests passing** across:
     - API utilities (security, JWT, field-mappings)
     - Program type transformations
     - Auth components (MagicLinkPage, LoginPage, VerifyCodePage, VerifyTokenPage)
     - React Query mutation hooks with cache invalidation
     - ProgramCard component
   - E2E tests for auth and programs flows (Playwright)
   - Remaining: Additional component tests, integration tests

2. **Caching Strategy** (95% COMPLETE)
   - React Query caching in frontend with proper invalidation
   - Service worker caches static assets
   - Debug panel for cache flush (`?debug=true` URL parameter)
   - Remaining: Vercel KV usage documentation unclear

### Planned but Not Implemented

1. **Additional Email Notifications** (TODO.md)
   - Welcome emails for new users
   - Streak risk alerts
   - Weekly summary emails
   - (Note: Magic link emails ARE implemented and working)

2. **Custom Methods/Goals** (WISHLIST.md)
   - User-created methods
   - User-created goals

3. **Calendar Integration** (WISHLIST.md)
   - Export program to calendar
   - Automatic scheduling

4. **Tamagotchi-style Gamification** (WISHLIST.md)
   - Avatar/character that reacts to user activity

6. **Enhanced Onboarding**
   - Baseline assessment flow

---

## Feature Inventory by Domain

### 1. Authentication

**Status:** DONE

**Key Files:**
- `/api/auth/login.ts` - Password login endpoint
- `/api/auth/magic-link.ts` - Request magic link/code
- `/api/auth/verify-token.ts` - Verify magic link token
- `/api/auth/verify-code.ts` - Verify 6-digit code
- `/api/auth/logout.ts` - Clear refresh token
- `/api/auth/refresh.ts` - Token refresh
- `/api/auth/me.ts` - Get current user
- `/api/auth/set-password.ts` - First-time password setup
- `/src/contexts/AuthContext.tsx` - Auth state management
- `/src/pages/MagicLinkPage.tsx` - Email entry for magic link (primary login)
- `/src/pages/VerifyCodePage.tsx` - 6-digit code entry with auto-focus, paste support
- `/src/pages/VerifyTokenPage.tsx` - Token verification from email link
- `/src/pages/LoginPage.tsx` - Password login (alternative)
- `/src/pages/FirstTimeUserPage.tsx` - New user flow
- `/src/pages/SetPasswordPage.tsx` - Password setup
- `/src/components/ProtectedRoute.tsx` - Route guard

**Features:**
- **Magic Link Login (Primary):**
  - User enters email at `/login`
  - System sends email with clickable link + 6-digit code
  - User clicks link (browser) OR enters code (PWA)
  - 15-minute token/code expiration
  - One-time use (tokens deleted after verification)
  - Auto-focus and paste support for code entry
- **Password Login (Alternative):**
  - Available at `/login/password`
  - Two-step flow (email → password)
  - Links between both login methods
- First-time user detection (no password hash)
- Password setup for new users
- JWT access tokens (15min) + httpOnly refresh tokens
- Auto-refresh every 10 minutes
- Session persistence via localStorage + cookies
- Protected route wrapper

**Known Issues:** None critical

**Limitations:**
- No multi-factor authentication
- Rate limiting not yet implemented (planned: max 3 requests per email per hour)

---

### 2. Programs

**Status:** DONE

**Key Files:**
- `/api/programs/index.ts` - List programs, create manual program
- `/api/programs/[id].ts` - Get program details
- `/api/programs/generate.ts` - AI program generation (deprecated)
- `/api/programs/preview.ts` - AI preview without saving
- `/api/programs/confirm.ts` - Save AI-generated program
- `/src/pages/ProgramsPage.tsx` - Programs list
- `/src/pages/ProgramDetailPage.tsx` - Program detail view
- `/src/components/ProgramCard.tsx` - Program list item
- `/src/components/ProgramWizard.tsx` - Manual creation wizard
- `/src/components/AIProgramWizard.tsx` - AI creation wizard
- `/src/types/program.ts` - Program types and utilities

**Features:**
- View all programs grouped by status (Running/Planned/Finished)
- AI-powered program creation with goals, duration, frequency
- Manual program creation wizard
- Program detail page with schedule, goals, methods
- Progress bar based on method completion
- Next scheduled activity display on home page
- Full schedule view with completion status
- Milestone tracking (25%, 50%, 75%, 100%)

**Known Issues:**
- Progress calculation uses method-based logic (spec calls for session-based)
- Some programs may lack Programmaplanning records if created before AI implementation

**Limitations:**
- No program editing (must create new)
- No program deletion
- No program duplication/templating
- No calendar export

---

### 3. Methods

**Status:** DONE

**Key Files:**
- `/api/methods/index.ts` - List all methods
- `/api/methods/[id].ts` - Get method details
- `/api/methods/habits.ts` - Get good habits (filtered methods)
- `/src/pages/MethodsPage.tsx` - Methods library
- `/src/pages/MethodDetailPage.tsx` - Method detail with media
- `/src/types/program.ts` - Method types

**Features:**
- Browse all methods in library
- Method detail page with description
- Audio/video media playback
- Media progress tracking (triggers at 97% pause or completion)
- Completion feedback modal (optional remarks)
- Method usage recording linked to Programmaplanning
- Points awarded on completion (10pts per method)
- Milestone checking for program progress

**Known Issues:** None critical

**Limitations:**
- No search/filter in methods library
- No favorites/bookmarks
- No method recommendations
- No offline media downloads

---

### 4. Good Habits

**Status:** DONE

**Key Files:**
- `/api/methods/habits.ts` - Get habits (methods linked to "Goede gewoontes" goal)
- `/api/habit-usage/index.ts` - Record habit completion
- `/src/components/GoodHabitsSection.tsx` - Habits display on home page
- `/src/hooks/queries.ts` - React Query hooks for habits

**Features:**
- Display habits on home page (filtered methods)
- Daily checkbox tracking
- Persistent storage in Gewoontegebruik table
- Points awarded (5pts per habit)
- Optimistic UI updates via React Query
- Expand/collapse for full descriptions
- Emoji extraction from habit names

**Known Issues:**
- Streak tracking works but UI for "all habits bonus" not visible

**Limitations:**
- Fixed habit list (user cannot customize)
- No habit history/calendar view
- No habit streaks per individual habit
- No habit reminders

---

### 5. Rewards & Gamification

**Status:** DONE

**Key Files:**
- `/api/rewards/index.ts` - Get user rewards
- `/api/rewards/award.ts` - Award points and process rewards
- `/src/components/rewards/` - All reward UI components
- `/src/lib/rewards-utils.ts` - Points, levels, badges logic
- `/src/types/rewards.ts` - Reward constants and types

**Features:**
- Points system:
  - Method completion: 10pts
  - Good habit: 5pts
  - Program milestones: 25pts (at 25%, 50%, 75%, 100%)
  - Session bonus: 5pts (complete all methods in a session)
  - Habit daily bonus: 5pts (complete all habits in a day)
  - Streak milestones: 50pts (7-day), 200pts (30-day)
- 10-level system with Dutch titles
- Badge system with achievement tracking
- Streak tracking (current + longest)
- Level progress bar on account page
- Reward toasts for points/badges/levels
- Milestone progress on program detail page

**Known Issues:**
- TODO.md suggests moving scoring logic to Airtable (currently calculated in API)

**Limitations:**
- No leaderboards
- No reward redemption/shop
- No achievement sharing
- No daily challenges/quests
- No streak risk notifications

---

### 6. User Profile

**Status:** DONE

**Key Files:**
- `/api/users/index.ts` - Create user
- `/api/users/[id].ts` - Update user
- `/api/users/change-password.ts` - Change password
- `/src/pages/AccountPage.tsx` - Account settings page
- `/src/components/ChangePasswordForm.tsx` - Password change UI

**Features:**
- View profile details (name, email, company)
- View rewards summary (points, level, streak, badges)
- Change password form
- Logout

**Known Issues:** None critical

**Limitations:**
- No profile photo upload
- No email change
- No account deletion
- No language/locale settings
- No notification preferences

---

### 7. PWA Features

**Status:** DONE

**Key Files:**
- `/vite.config.ts` - PWA plugin configuration
- `/src/components/InstallPrompt.tsx` - Install banner
- `/src/components/PullToRefresh.tsx` - Pull-to-refresh wrapper
- `/index.html` - PWA meta tags

**Features:**
- Installable as standalone app (Android/iOS)
- Install prompt with platform-specific instructions
- Offline support via service worker
- Asset caching (JS, CSS, images, fonts)
- Airtable API caching (1-hour max)
- Pull-to-refresh on home page
- Proper app manifest with icons
- Theme color and splash screen

**Known Issues:** None critical

**Limitations:**
- No background sync
- No push notifications
- No offline-first data strategy (requires network for initial load)
- No offline media downloads

---

## Core User Journeys (Functional Today)

### Journey 1: First-Time User Onboarding
1. User receives email with app link
2. Opens app, sees magic link login page
3. Enters email address
4. Receives email with magic link + 6-digit code
5. User clicks link OR enters code → logged in immediately
6. Home page shows onboarding wizard (no programs yet)
7. User creates first AI-generated program via wizard
8. Home page shows new program with today's activity

**Alternative Flow (Password):**
- User can click "Inloggen met wachtwoord" for password-based login
- If no password exists, system redirects to password setup

**Status:** FULLY FUNCTIONAL

---

### Journey 2: Returning User Daily Practice
1. User opens installed PWA
2. Auto-login via refresh token
3. Home page shows:
   - Current running program
   - Today's scheduled methods
   - Good habits section
4. User checks off a good habit → sees +5pts toast
5. User clicks on a scheduled method
6. Watches/listens to media to completion
7. Feedback modal appears → user adds remark
8. System awards 10pts, checks for milestones
9. User sees reward toast (points, possibly badge/level-up)
10. Returns to home → sees checkmark on completed method

**Status:** FULLY FUNCTIONAL

---

### Journey 3: Program Creation (AI-Assisted)
1. User navigates to Programs tab
2. Clicks "Nieuw Programma"
3. Chooses "AI Programma (Aanbevolen)"
4. Selects goals (e.g., "Verbeteren van focus")
5. Sets start date and duration (e.g., 4 weeks)
6. Selects available days (e.g., Mon/Wed/Fri)
7. Clicks "Genereer Mijn Programma"
8. AI generates schedule with specific methods per day
9. User reviews preview with weekly schedule
10. Confirms → program created in Airtable
11. Navigates to program detail page

**Status:** FULLY FUNCTIONAL

---

### Journey 4: Viewing Progress & Rewards
1. User navigates to Account tab
2. Sees level progress circle
3. Sees current streak counter
4. Sees total points
5. Sees earned badges (colored) vs locked badges (greyed)
6. Can change password if needed
7. Can logout

**Status:** FULLY FUNCTIONAL

---

## Out of Scope (Prevents Scope Creep)

This application explicitly does NOT include:

### User Management
- User registration (users created by admin in Airtable)
- Multi-tenant/company-level admin dashboards
- User roles/permissions beyond basic auth

### Social Features
- Leaderboards or user comparison
- Team challenges
- Sharing achievements to social media
- In-app messaging or community

### Content Creation
- User-generated methods or programs (admin-created only)
- Custom method media uploads
- Method ratings/reviews

### Advanced Scheduling
- Calendar integration (export)
- Automatic reminders/notifications
- Rescheduling sessions

### Payment/Commerce
- Reward redemption shop
- Paid programs or premium features
- Subscription management

### Advanced Analytics
- Detailed usage analytics dashboards
- Export usage data
- Comparative reports

### Email Notifications (beyond magic link)
- Welcome emails
- Streak risk alerts
- Achievement emails
- Weekly summary emails
(Magic link emails ARE implemented; other notifications planned future)

---

## Technical Architecture Summary

### Frontend
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Routing:** React Router v7
- **State Management:** React Query (TanStack Query) for server state, Context API for auth
- **PWA:** vite-plugin-pwa with Workbox

### Backend
- **Platform:** Vercel Serverless Functions
- **Database:** Airtable (no traditional backend DB)
- **Auth:** JWT (jose library) with httpOnly cookies
- **AI:** OpenAI GPT-4o for program generation
- **Caching:** React Query client-side, optional Vercel KV

### Key Airtable Tables
- **Gebruikers (Users):** User accounts with Dutch field names
- **Mentale Fitnessprogramma's (Programs):** User programs
- **Programmaplanning:** Scheduled sessions with dates and methods
- **Methodes (Methods):** Mental fitness exercises/content
- **Doelstellingen (Goals):** Program goals
- **Dagen (Days):** Days of the week
- **Methodegebruik (Method Usage):** Completion tracking
- **Gewoontegebruik (Habit Usage):** Daily habit tracking
- **Media:** Linked audio/video files

---

## Known Issues & Technical Debt

### High Priority
1. **Progress Calculation Mismatch**
   - Current: Method-based progress (completedMethods / totalMethods)
   - Spec calls for: Session-based (completedSessions / totalSessions)
   - Impact: Progress may inflate if users complete extra methods

2. **Rewards Scoring Logic** (TODO.md)
   - Current: Calculated in API endpoint
   - Desired: Move to Airtable with point logs per activity
   - Impact: Harder to audit point history, potential calculation drift

### Medium Priority
3. **Testing Coverage**
   - 158 unit tests passing (good baseline)
   - E2E tests exist for auth and programs flows
   - Remaining: CI/CD integration, additional integration tests

4. **Error Handling**
   - Generic error messages in some flows
   - No retry logic for failed API calls
   - No offline queue for actions

5. **Accessibility**
   - No ARIA labels on interactive elements
   - Keyboard navigation not fully tested
   - Screen reader support unknown

### Low Priority
6. **Performance Optimization**
   - No lazy loading for components
   - No image optimization pipeline
   - No bundle size analysis

7. **SEO/Metadata**
   - No dynamic meta tags for pages
   - No Open Graph tags

---

## Recommended Priority Roadmap

### Immediate (Pre-Launch QA)
1. **Verify onboarding flow end-to-end** (TODO.md item)
   - Test with fresh user account
   - Verify magic link email → login → program creation → first session
   - Test both magic link click and 6-digit code entry
   - Document any friction points

2. **Testing refinement**
   - 158 unit tests now passing
   - Verify E2E tests cover critical journeys
   - Test PWA installation on iOS and Android

3. **Error handling audit**
   - Add user-friendly error messages
   - Handle offline scenarios gracefully
   - Add retry logic for critical APIs

### Phase 2 (Post-Launch Enhancements)
4. **Align progress calculation**
   - Implement session-based progress per spec
   - Migrate existing programs if needed

5. **Refactor rewards scoring** (TODO.md)
   - Move calculation to Airtable
   - Create point log per activity
   - Add audit trail

### Phase 3 (User Value Adds)
6. **Custom habits selection** (WISHLIST.md)
   - Let users pick from habit library
   - Store preferences at user level

7. **Calendar integration** (WISHLIST.md)
   - One-click export to Google Calendar/iCal
   - Automatic scheduling

8. **Enhanced analytics**
   - Weekly summary view
   - Completion trends
   - Time invested tracking

### Future/Exploratory
9. **Custom methods/goals** (WISHLIST.md)
10. **Tamagotchi gamification** (WISHLIST.md)
11. **Baseline assessment onboarding** (WISHLIST.md)

---

## Quality Gates & Definition of Done

For any feature to be considered "Done":

1. **Functionality**
   - Works on mobile (iOS Safari, Android Chrome)
   - Works in PWA installed mode
   - Handles errors gracefully
   - Works offline (where applicable)

2. **User Experience**
   - Matches design system (shadcn/ui + Tailwind)
   - Responsive across screen sizes
   - Accessible (keyboard, screen reader basics)
   - Loading states and optimistic UI

3. **Code Quality**
   - TypeScript types defined
   - React Query used for server state
   - No console errors in production
   - Follows project structure conventions

4. **Testing**
   - Critical path covered by E2E test
   - API endpoints have basic validation
   - No regressions in existing features

5. **Documentation**
   - Feature documented in this SCOPE.md
   - API endpoints documented (if new)
   - Any Airtable schema changes noted

---

## Conclusion

The Corporate Mental Fitness PWA has achieved a strong MVP state with all core user journeys functional. The authentication, program management, method tracking, habits, and rewards systems work cohesively to deliver a compelling user experience.

**Strengths:**
- Solid technical foundation (React 19, Vercel, Airtable)
- PWA capabilities for mobile installation
- AI-powered program generation
- Engaging gamification system
- Clean, modern UI

**Areas for Improvement:**
- Progress calculation alignment with spec
- Error handling and offline resilience
- Accessibility enhancements
- Rate limiting for magic link requests

**Scope Discipline Recommendations:**
1. Do NOT add social features (leaderboards, sharing) until core experience is polished
2. Do NOT add user-generated content until admin workflows are proven
3. Do NOT add payment/commerce until user retention metrics justify it
4. Do focus on reliability, error handling, and testing
5. Do focus on performance and perceived speed

**Recent Accomplishments:**
- Magic Link Login implemented (passwordless authentication)
- Testing infrastructure expanded to 158 passing tests
- Auth component tests added
- Cache invalidation tests for React Query mutations

The application is ready for beta testing with corporate users. The passwordless login simplifies onboarding significantly.

---

**Document Maintainer:** Product Owner
**Next Review:** After beta testing feedback
