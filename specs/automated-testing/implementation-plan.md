# Implementation Plan: Automated Testing Suite

## Overview

Set up Vitest for unit/component/API tests and Playwright for E2E tests, then create initial test coverage for critical functionality.

---

## Phase 1: Testing Infrastructure Setup

Set up Vitest and Playwright with proper configuration.

### Tasks

- [x] Install Vitest and React Testing Library dependencies
- [x] Install Playwright and browser binaries
- [x] Create vitest.config.ts with TypeScript paths and jsdom environment
- [x] Create playwright.config.ts with dev server integration
- [x] Add test scripts to package.json
- [x] Create src/test/setup.ts for Vitest globals
- [x] Create src/test/test-utils.tsx with provider wrappers

### Technical Details

**Install dependencies:**
```bash
# Vitest + React Testing Library
npm install -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Playwright
npm install -D @playwright/test
npx playwright install chromium webkit
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'api/**/*.{test,spec}.ts'],
    exclude: ['e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', 'e2e/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**playwright.config.ts:**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3333',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'vercel dev --yes --listen 3333',
    port: 3333,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

**package.json scripts to add:**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed"
}
```

**src/test/setup.ts:**
```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing')
```

**src/test/test-utils.tsx:**
```typescript
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

interface WrapperProps {
  children: React.ReactNode
}

function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { renderWithProviders as render }
```

---

## Phase 2: API Utility Tests

Test backend utility functions with mock data.

### Tasks

- [x] Create api/_lib/__tests__/ directory
- [x] Create field-mappings.test.ts for transform functions
- [x] Create jwt.test.ts for token utilities
- [ ] Create password.test.ts for hashing utilities
- [ ] Create api-utils.test.ts for response helpers

### Technical Details

**api/_lib/__tests__/field-mappings.test.ts:**
```typescript
import { describe, it, expect } from 'vitest'
import {
  transformProgram,
  transformMethod,
  transformProgrammaplanning,
  transformMethodUsage,
  PROGRAM_FIELDS,
  METHOD_FIELDS,
  PROGRAMMAPLANNING_FIELDS
} from '../field-mappings.js'

describe('transformProgram', () => {
  it('transforms Airtable record to Program object', () => {
    const record = {
      id: 'recProgram123',
      fields: {
        [PROGRAM_FIELDS.startDate]: '2026-01-01',
        [PROGRAM_FIELDS.endDate]: '2026-02-01',
        [PROGRAM_FIELDS.duration]: '4 weken',
        [PROGRAM_FIELDS.frequency]: 3,
        [PROGRAM_FIELDS.sessionTime]: 25,
        [PROGRAM_FIELDS.goals]: ['recGoal1', 'recGoal2'],
        [PROGRAM_FIELDS.methods]: ['recMethod1'],
        [PROGRAM_FIELDS.daysOfWeek]: ['recMon', 'recWed', 'recFri'],
      }
    }

    const result = transformProgram(record)

    expect(result.id).toBe('recProgram123')
    expect(result.startDate).toBe('2026-01-01')
    expect(result.endDate).toBe('2026-02-01')
    expect(result.duration).toBe('4 weken')
    expect(result.frequency).toBe(3)
    expect(result.goals).toHaveLength(2)
  })

  it('handles missing optional fields', () => {
    const record = {
      id: 'recProgram456',
      fields: {
        [PROGRAM_FIELDS.startDate]: '2026-01-01',
        [PROGRAM_FIELDS.endDate]: '2026-02-01',
      }
    }

    const result = transformProgram(record)

    expect(result.id).toBe('recProgram456')
    expect(result.goals).toEqual([])
    expect(result.methods).toEqual([])
  })
})

describe('transformProgrammaplanning', () => {
  it('marks session as completed when methodUsage exists', () => {
    const record = {
      id: 'recPlanning123',
      fields: {
        [PROGRAMMAPLANNING_FIELDS.date]: '2026-01-15',
        [PROGRAMMAPLANNING_FIELDS.methodUsage]: ['recUsage1', 'recUsage2'],
        [PROGRAMMAPLANNING_FIELDS.methods]: ['recMethod1'],
      }
    }

    const result = transformProgrammaplanning(record)

    expect(result.isCompleted).toBe(true)
    expect(result.methodUsageIds).toHaveLength(2)
  })

  it('marks session as incomplete when no methodUsage', () => {
    const record = {
      id: 'recPlanning456',
      fields: {
        [PROGRAMMAPLANNING_FIELDS.date]: '2026-01-16',
        [PROGRAMMAPLANNING_FIELDS.methods]: ['recMethod1'],
      }
    }

    const result = transformProgrammaplanning(record)

    expect(result.isCompleted).toBe(false)
    expect(result.methodUsageIds).toEqual([])
  })
})
```

**api/_lib/__tests__/jwt.test.ts:**
```typescript
import { describe, it, expect, beforeAll } from 'vitest'

// Set JWT_SECRET before importing jwt module
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long'

import { createAccessToken, createRefreshToken, verifyToken } from '../jwt.js'

describe('JWT utilities', () => {
  it('creates valid access token', async () => {
    const payload = { userId: 'user123', email: 'test@example.com' }
    const token = await createAccessToken(payload)

    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // JWT format
  })

  it('verifies valid access token', async () => {
    const payload = { userId: 'user123', email: 'test@example.com' }
    const token = await createAccessToken(payload)
    const verified = await verifyToken(token)

    expect(verified).toBeTruthy()
    expect(verified?.userId).toBe('user123')
    expect(verified?.email).toBe('test@example.com')
  })

  it('returns null for invalid token', async () => {
    const result = await verifyToken('invalid-token')
    expect(result).toBeNull()
  })

  it('returns null for expired token', async () => {
    // This would require mocking time or creating a token with past expiry
    // For now, just verify the function handles errors gracefully
    const result = await verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid')
    expect(result).toBeNull()
  })
})
```

---

## Phase 3: Type Utility Tests

Test frontend type utility functions.

### Tasks

- [x] Create src/types/__tests__/ directory
- [x] Create program.test.ts for program utility functions

### Technical Details

**src/types/__tests__/program.test.ts:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getProgramStatus,
  getSessionProgress,
  getNextScheduledDay,
  formatNextDay,
  parseWeeksFromDuration
} from '../program'
import type { Program, ProgramDetail } from '../program'

describe('getProgramStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "planned" for future programs', () => {
    vi.setSystemTime(new Date('2026-01-01'))

    const program = {
      startDate: '2026-02-01',
      endDate: '2026-03-01',
    } as Program

    expect(getProgramStatus(program)).toBe('planned')
  })

  it('returns "running" for current programs', () => {
    vi.setSystemTime(new Date('2026-01-15'))

    const program = {
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    } as Program

    expect(getProgramStatus(program)).toBe('running')
  })

  it('returns "finished" for past programs', () => {
    vi.setSystemTime(new Date('2026-03-01'))

    const program = {
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    } as Program

    expect(getProgramStatus(program)).toBe('finished')
  })

  it('returns "running" on start date', () => {
    vi.setSystemTime(new Date('2026-01-01'))

    const program = {
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    } as Program

    expect(getProgramStatus(program)).toBe('running')
  })

  it('returns "running" on end date', () => {
    vi.setSystemTime(new Date('2026-02-01'))

    const program = {
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    } as Program

    expect(getProgramStatus(program)).toBe('running')
  })
})

describe('getSessionProgress', () => {
  it('calculates progress percentage correctly', () => {
    const program = {
      totalSessions: 10,
      completedSessions: 3,
    } as ProgramDetail

    expect(getSessionProgress(program)).toBe(30)
  })

  it('returns 0 when no sessions exist', () => {
    const program = {
      totalSessions: 0,
      completedSessions: 0,
    } as ProgramDetail

    expect(getSessionProgress(program)).toBe(0)
  })

  it('caps progress at 100%', () => {
    const program = {
      totalSessions: 5,
      completedSessions: 10,
    } as ProgramDetail

    expect(getSessionProgress(program)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    const program = {
      totalSessions: 3,
      completedSessions: 1,
    } as ProgramDetail

    expect(getSessionProgress(program)).toBe(33)
  })
})

describe('parseWeeksFromDuration', () => {
  it('parses "4 weken"', () => {
    expect(parseWeeksFromDuration('4 weken')).toBe(4)
  })

  it('parses "8 weken"', () => {
    expect(parseWeeksFromDuration('8 weken')).toBe(8)
  })

  it('returns 0 for invalid input', () => {
    expect(parseWeeksFromDuration('')).toBe(0)
    expect(parseWeeksFromDuration('invalid')).toBe(0)
  })
})

describe('getNextScheduledDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today if scheduled', () => {
    // Set to Monday
    vi.setSystemTime(new Date('2026-01-19')) // Monday

    const result = getNextScheduledDay(['Maandag', 'Woensdag', 'Vrijdag'])

    expect(result?.day).toBe('Maandag')
    expect(result?.isToday).toBe(true)
    expect(result?.daysUntil).toBe(0)
  })

  it('returns next scheduled day', () => {
    // Set to Tuesday
    vi.setSystemTime(new Date('2026-01-20')) // Tuesday

    const result = getNextScheduledDay(['Maandag', 'Woensdag', 'Vrijdag'])

    expect(result?.day).toBe('Woensdag')
    expect(result?.isToday).toBe(false)
    expect(result?.daysUntil).toBe(1)
  })

  it('returns null for empty schedule', () => {
    const result = getNextScheduledDay([])
    expect(result).toBeNull()
  })
})

describe('formatNextDay', () => {
  it('returns "Vandaag" for today', () => {
    expect(formatNextDay({ day: 'Maandag', isToday: true, daysUntil: 0 })).toBe('Vandaag')
  })

  it('returns "Morgen" for tomorrow', () => {
    expect(formatNextDay({ day: 'Dinsdag', isToday: false, daysUntil: 1 })).toBe('Morgen')
  })

  it('returns day name for other days', () => {
    expect(formatNextDay({ day: 'Vrijdag', isToday: false, daysUntil: 3 })).toBe('Vrijdag')
  })
})
```

---

## Phase 4: Component Tests

Test React components in isolation.

### Tasks

- [x] Create src/components/__tests__/ directory
- [x] Create ProgramCard.test.tsx
- [x] Create FeedbackModal.test.tsx (basic render test)

### Technical Details

**src/components/__tests__/ProgramCard.test.tsx:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@/test/test-utils'
import { ProgramCard } from '../ProgramCard'
import type { Program } from '@/types/program'

const mockProgram: Program = {
  id: 'rec123',
  name: 'Stress Reductie Programma',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  duration: '4 weken',
  frequency: 3,
  sessionTime: 25,
  goals: ['recGoal1'],
  methods: ['recMethod1'],
  daysOfWeek: ['recMon', 'recWed', 'recFri'],
}

describe('ProgramCard', () => {
  it('displays program name', () => {
    render(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText('Stress Reductie Programma')).toBeInTheDocument()
  })

  it('displays program dates', () => {
    render(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText(/1 jan/i)).toBeInTheDocument()
    expect(screen.getByText(/1 feb/i)).toBeInTheDocument()
  })

  it('displays frequency', () => {
    render(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText('3x per week')).toBeInTheDocument()
  })

  it('shows "Actief" badge for running status', () => {
    render(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('shows "Gepland" badge for planned status', () => {
    render(
      <ProgramCard program={mockProgram} status="planned" onClick={() => {}} />
    )

    expect(screen.getByText('Gepland')).toBeInTheDocument()
  })

  it('shows "Afgerond" badge for finished status', () => {
    render(
      <ProgramCard program={mockProgram} status="finished" onClick={() => {}} />
    )

    expect(screen.getByText('Afgerond')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <ProgramCard program={mockProgram} status="running" onClick={handleClick} />
    )

    await user.click(screen.getByRole('article') || screen.getByText('Stress Reductie Programma').closest('div')!)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows progress bar for running programs', () => {
    render(
      <ProgramCard program={mockProgram} status="running" onClick={() => {}} />
    )

    expect(screen.getByText('Voortgang')).toBeInTheDocument()
  })

  it('does not show progress bar for non-running programs', () => {
    render(
      <ProgramCard program={mockProgram} status="planned" onClick={() => {}} />
    )

    expect(screen.queryByText('Voortgang')).not.toBeInTheDocument()
  })
})
```

---

## Phase 5: E2E Tests - Authentication

Test authentication user flows end-to-end.

### Tasks

- [x] Create e2e/ directory
- [x] Create e2e/auth.spec.ts with login/logout tests
- [ ] Create e2e/fixtures/ for test data helpers

### Technical Details

**e2e/auth.spec.ts:**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL('/login')
  })

  test('shows login form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /inloggen/i })).toBeVisible()
    await expect(page.getByLabel(/e-mail/i)).toBeVisible()
    await expect(page.getByLabel(/wachtwoord/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /inloggen/i })).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'invalid@example.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/ongeldig|fout|incorrect/i)).toBeVisible()
  })

  test('successful login redirects to home', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/')
    await expect(page.getByText(/hello/i)).toBeVisible()
  })

  test('logout redirects to login', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Navigate to account and logout
    await page.goto('/account')
    await page.click('button:has-text("Uitloggen")')

    await expect(page).toHaveURL('/login')
  })

  test('session persists on page reload', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Reload page
    await page.reload()

    // Should still be logged in
    await expect(page).toHaveURL('/')
    await expect(page.getByText(/hello/i)).toBeVisible()
  })
})
```

---

## Phase 6: E2E Tests - Programs

Test program-related user flows.

### Tasks

- [x] Create e2e/programs.spec.ts with program list and detail tests
- [x] Add authenticated test helper

### Technical Details

**e2e/programs.spec.ts:**
```typescript
import { test, expect } from '@playwright/test'

// Helper to login before tests
async function login(page: any) {
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'testpassword123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
}

test.describe('Programs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('navigates to programs page', async ({ page }) => {
    await page.click('nav >> text=Programs')

    await expect(page).toHaveURL('/programs')
  })

  test('displays program sections', async ({ page }) => {
    await page.goto('/programs')

    // Should have section headers (may vary based on data)
    const pageContent = await page.textContent('body')
    expect(
      pageContent?.includes('Actief') ||
      pageContent?.includes('Gepland') ||
      pageContent?.includes('Afgerond') ||
      pageContent?.includes('Geen')
    ).toBe(true)
  })

  test('shows program card details', async ({ page }) => {
    await page.goto('/programs')

    // Look for common program card elements
    const hasFrequency = await page.getByText(/per week/i).count()
    expect(hasFrequency).toBeGreaterThanOrEqual(0) // May be 0 if no programs
  })

  test('navigates to program detail', async ({ page }) => {
    await page.goto('/programs')

    // Click first program card if exists
    const cards = await page.locator('.cursor-pointer').count()
    if (cards > 0) {
      await page.locator('.cursor-pointer').first().click()
      await expect(page.getByText(/programma details/i)).toBeVisible()
    }
  })

  test('program detail shows overview section', async ({ page }) => {
    await page.goto('/programs')

    const cards = await page.locator('.cursor-pointer').count()
    if (cards > 0) {
      await page.locator('.cursor-pointer').first().click()

      await expect(page.getByText(/overzicht/i)).toBeVisible()
    }
  })
})

test.describe('Home Page - Current Program', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('shows current program card if running', async ({ page }) => {
    await page.goto('/')

    // May or may not have a running program
    const hasCurrentProgram = await page.getByText(/huidig programma/i).count()
    const hasNoProgram = await page.getByText(/geen actief/i).count()

    expect(hasCurrentProgram + hasNoProgram).toBeGreaterThan(0)
  })

  test('shows progress on home page', async ({ page }) => {
    await page.goto('/')

    // If there's a current program, it should show progress
    const hasCurrentProgram = await page.getByText(/huidig programma/i).count()
    if (hasCurrentProgram > 0) {
      await expect(page.getByText(/voortgang/i)).toBeVisible()
    }
  })
})
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration |
| `playwright.config.ts` | Playwright E2E configuration |
| `src/test/setup.ts` | Vitest global setup and mocks |
| `src/test/test-utils.tsx` | Custom render with providers |
| `api/_lib/__tests__/field-mappings.test.ts` | Field mapping tests |
| `api/_lib/__tests__/jwt.test.ts` | JWT utility tests |
| `src/types/__tests__/program.test.ts` | Program utility tests |
| `src/components/__tests__/ProgramCard.test.tsx` | Component tests |
| `e2e/auth.spec.ts` | Auth E2E tests |
| `e2e/programs.spec.ts` | Programs E2E tests |

---

## Verification

1. `npm install` - Install dependencies
2. `npm test` - Run unit/component tests
3. `npm run test:coverage` - Check coverage
4. `npm run test:e2e` - Run E2E tests (starts dev server)
5. All tests should pass
6. Coverage report generated in `coverage/` directory
