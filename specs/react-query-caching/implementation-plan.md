# Implementation Plan: React Query Client-Side Caching

## Overview

Add TanStack Query (React Query) v5 for client-side data caching to eliminate unnecessary network requests and provide instant navigation between pages.

## Phase 1: Setup & Configuration

Install React Query and configure the QueryClient with appropriate defaults.

### Tasks

- [x] Install @tanstack/react-query and devtools packages
- [x] Create QueryClient configuration with cache settings
- [x] Add QueryClientProvider to app root
- [x] Add ReactQueryDevtools for development

### Technical Details

**Package Installation:**
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**QueryClient Configuration (src/lib/query-client.ts):**
```typescript
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Retry failed requests once
      retry: 1
    }
  }
})
```

**App Root Update (src/App.tsx):**
```typescript
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { queryClient } from "@/lib/query-client"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* existing app content */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

## Phase 2: Query Keys & Hooks

Create typed query keys and custom hooks for each API endpoint.

### Tasks

- [x] Create query keys factory for consistent key management
- [x] Create useGoals hook for goals data
- [x] Create useMethods hook for methods list
- [x] Create useMethod hook for single method detail
- [x] Create useDays hook for days of week
- [x] Create usePrograms hook for user programs
- [x] Create useProgram hook for single program detail

### Technical Details

**Query Keys (src/lib/query-keys.ts):**
```typescript
export const queryKeys = {
  // Reference data - long cache
  goals: ["goals"] as const,
  methods: ["methods"] as const,
  method: (id: string) => ["methods", id] as const,
  days: ["days"] as const,

  // User data - medium cache
  programs: (userId: string) => ["programs", userId] as const,
  program: (id: string) => ["program", id] as const,

  // Dynamic data - short cache
  methodUsage: (programId: string) => ["methodUsage", programId] as const
}
```

**Hooks File (src/hooks/queries.ts):**
```typescript
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

// Cache times matching server TTLs
const CACHE_LONG = 30 * 60 * 1000   // 30 minutes
const CACHE_MEDIUM = 5 * 60 * 1000  // 5 minutes
const CACHE_SHORT = 60 * 1000       // 1 minute

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => api.goals.list(),
    staleTime: CACHE_LONG
  })
}

export function useMethods() {
  return useQuery({
    queryKey: queryKeys.methods,
    queryFn: () => api.methods.list(),
    staleTime: CACHE_LONG
  })
}

export function useMethod(id: string) {
  return useQuery({
    queryKey: queryKeys.method(id),
    queryFn: () => api.methods.get(id),
    enabled: !!id
  })
}

export function useDays() {
  return useQuery({
    queryKey: queryKeys.days,
    queryFn: () => api.days.list(),
    staleTime: CACHE_LONG
  })
}

export function usePrograms(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.programs(userId!),
    queryFn: () => api.programs.list(userId!),
    enabled: !!userId,
    staleTime: CACHE_MEDIUM
  })
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => api.programs.get(id),
    enabled: !!id,
    staleTime: CACHE_MEDIUM
  })
}

export function useMethodUsage(programId: string, limit = 2) {
  return useQuery({
    queryKey: queryKeys.methodUsage(programId),
    queryFn: () => api.methodUsage.byProgram(programId, limit),
    enabled: !!programId,
    staleTime: CACHE_SHORT
  })
}
```

## Phase 3: Update Components

Migrate existing components from direct API calls to React Query hooks.

### Tasks

- [x] Update ProgramWizard to use useGoals, useMethods, useDays hooks
- [x] Update HomePage to use usePrograms hook
- [x] Update ProgramDetailPage to use useProgram hook
- [x] Update MethodDetailPage to use useMethod hook
- [x] Remove manual loading/error state management where React Query handles it

### Technical Details

**Example: ProgramWizard Update:**

Before:
```typescript
const [goalsData, setGoalsData] = useState<Goal[]>([])
const [isLoading, setIsLoading] = useState(true)

useEffect(() => {
  async function fetchData() {
    const [goals, days, methods] = await Promise.all([
      api.goals.list(),
      api.days.list(),
      api.methods.list()
    ])
    setGoalsData(goals)
    // ...
    setIsLoading(false)
  }
  fetchData()
}, [])
```

After:
```typescript
import { useGoals, useDays, useMethods } from "@/hooks/queries"

const { data: goalsData = [], isLoading: goalsLoading } = useGoals()
const { data: daysData = [], isLoading: daysLoading } = useDays()
const { data: methodsData = [], isLoading: methodsLoading } = useMethods()

const isLoading = goalsLoading || daysLoading || methodsLoading
```

**Example: HomePage Update:**
```typescript
import { usePrograms } from "@/hooks/queries"

function HomePage() {
  const { user } = useAuth()
  const { data: programs = [], isLoading, error } = usePrograms(user?.id)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />

  return <ProgramList programs={programs} />
}
```

## Phase 4: Mutations & Cache Invalidation

Add mutation hooks for write operations that invalidate relevant queries.

### Tasks

- [x] Create useCreateProgram mutation hook
- [x] Create useUpdateProgram mutation hook
- [x] Create useRecordMethodUsage mutation hook
- [x] Add cache invalidation after successful mutations

### Technical Details

**Mutations (src/hooks/mutations.ts):**
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { CreateProgramData } from "@/types/program"

export function useCreateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ data, accessToken }: { data: CreateProgramData; accessToken: string }) =>
      api.programs.create(data, accessToken),
    onSuccess: (_, variables) => {
      // Invalidate programs list for this user
      queryClient.invalidateQueries({
        queryKey: queryKeys.programs(variables.data.userId)
      })
    }
  })
}

export function useUpdateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
      accessToken
    }: {
      id: string
      data: Parameters<typeof api.programs.update>[1]
      accessToken: string
    }) => api.programs.update(id, data, accessToken),
    onSuccess: (_, variables) => {
      // Invalidate specific program
      queryClient.invalidateQueries({
        queryKey: queryKeys.program(variables.id)
      })
    }
  })
}

export function useRecordMethodUsage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      data,
      accessToken
    }: {
      data: Parameters<typeof api.methodUsage.create>[0]
      accessToken: string
    }) => api.methodUsage.create(data, accessToken),
    onSuccess: (_, variables) => {
      if (variables.data.programId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.methodUsage(variables.data.programId)
        })
      }
    }
  })
}
```

## Verification

1. **Cache Behavior:**
   - Navigate to home page (should load programs)
   - Go to program detail page
   - Go back to home page → should show data instantly (no spinner)

2. **DevTools:**
   - Open React Query DevTools
   - Verify queries are cached with correct stale times
   - Check that navigating doesn't trigger new requests for fresh data

3. **Mutations:**
   - Create a new program
   - Verify programs list refreshes automatically
   - Record method usage, verify it appears in the list
