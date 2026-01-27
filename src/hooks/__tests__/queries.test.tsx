import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import {
  useRecordMethodUsage,
  useRecordHabitUsage,
  useDeleteHabitUsage,
  useAwardPoints,
} from "../queries"
import { queryKeys } from "@/lib/query-keys"

// Mock the api-client
vi.mock("@/lib/api-client", () => ({
  api: {
    methodUsage: {
      create: vi.fn(),
    },
    habitUsage: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    rewards: {
      award: vi.fn(),
    },
  },
}))

// Mock useAuth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    accessToken: "test-token",
  }),
}))

import { api } from "@/lib/api-client"

// Helper to create a test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

// Helper wrapper with query client
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe("useRecordMethodUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls methodUsage.create with correct params", async () => {
    vi.mocked(api.methodUsage.create).mockResolvedValueOnce({ id: "usage123" })

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useRecordMethodUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", programId: "prog1" },
      accessToken: "test-token",
    })

    expect(api.methodUsage.create).toHaveBeenCalledWith(
      { userId: "user1", methodId: "method1", programId: "prog1" },
      "test-token"
    )
  })

  it("invalidates methodUsage cache for program on success", async () => {
    vi.mocked(api.methodUsage.create).mockResolvedValueOnce({ id: "usage123" })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useRecordMethodUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", programId: "prog1" },
      accessToken: "test-token",
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.methodUsage("prog1"),
      })
    })
  })

  it("invalidates program cache on success", async () => {
    vi.mocked(api.methodUsage.create).mockResolvedValueOnce({ id: "usage123" })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useRecordMethodUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", programId: "prog1" },
      accessToken: "test-token",
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.program("prog1"),
      })
    })
  })

  it("invalidates programs list on success", async () => {
    vi.mocked(api.methodUsage.create).mockResolvedValueOnce({ id: "usage123" })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useRecordMethodUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", programId: "prog1" },
      accessToken: "test-token",
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["programs"],
      })
    })
  })
})

describe("useRecordHabitUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls habitUsage.create with correct params", async () => {
    vi.mocked(api.habitUsage.create).mockResolvedValueOnce({ id: "habit123" })

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useRecordHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", date: "2024-01-15" },
      accessToken: "test-token",
    })

    expect(api.habitUsage.create).toHaveBeenCalledWith(
      { userId: "user1", methodId: "method1", date: "2024-01-15" },
      "test-token"
    )
  })

  it("performs optimistic update on mutate", async () => {
    // Make the API call hang so we can check optimistic state
    let resolvePromise: () => void
    vi.mocked(api.habitUsage.create).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePromise = () => resolve({ id: "habit123" })
      })
    )

    const queryClient = createTestQueryClient()
    // Seed initial data
    queryClient.setQueryData(queryKeys.habitUsage("user1", "2024-01-15"), ["existing"])

    const { result } = renderHook(() => useRecordHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    // Start mutation
    result.current.mutate({
      data: { userId: "user1", methodId: "newMethod", date: "2024-01-15" },
      accessToken: "test-token",
    })

    // Check optimistic update happened
    await waitFor(() => {
      const data = queryClient.getQueryData<string[]>(
        queryKeys.habitUsage("user1", "2024-01-15")
      )
      expect(data).toContain("newMethod")
      expect(data).toContain("existing")
    })

    // Resolve the promise
    resolvePromise!()
  })

  it("rolls back optimistic update on error", async () => {
    vi.mocked(api.habitUsage.create).mockRejectedValueOnce(new Error("Failed"))

    const queryClient = createTestQueryClient()
    // Seed initial data
    queryClient.setQueryData(queryKeys.habitUsage("user1", "2024-01-15"), ["existing"])

    const { result } = renderHook(() => useRecordHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    try {
      await result.current.mutateAsync({
        data: { userId: "user1", methodId: "newMethod", date: "2024-01-15" },
        accessToken: "test-token",
      })
    } catch {
      // Expected error
    }

    // Should roll back to original data
    await waitFor(() => {
      const data = queryClient.getQueryData<string[]>(
        queryKeys.habitUsage("user1", "2024-01-15")
      )
      expect(data).toEqual(["existing"])
    })
  })

  it("invalidates rewards cache on success", async () => {
    vi.mocked(api.habitUsage.create).mockResolvedValueOnce({ id: "habit123" })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useRecordHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "method1", date: "2024-01-15" },
      accessToken: "test-token",
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.rewards,
      })
    })
  })

  it("handles optimistic update when cache is initially empty", async () => {
    vi.mocked(api.habitUsage.create).mockResolvedValueOnce({ id: "habit123" })

    const queryClient = createTestQueryClient()
    // Do NOT seed initial data - cache is empty

    const { result } = renderHook(() => useRecordHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { userId: "user1", methodId: "newMethod", date: "2024-01-15" },
      accessToken: "test-token",
    })

    // Should not throw and should have the new method
    const data = queryClient.getQueryData<string[]>(
      queryKeys.habitUsage("user1", "2024-01-15")
    )
    expect(data).toContain("newMethod")
  })
})

describe("useDeleteHabitUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls habitUsage.delete with correct params", async () => {
    vi.mocked(api.habitUsage.delete).mockResolvedValueOnce({})

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useDeleteHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      userId: "user1",
      methodId: "method1",
      date: "2024-01-15",
      accessToken: "test-token",
    })

    expect(api.habitUsage.delete).toHaveBeenCalledWith(
      "user1",
      "method1",
      "2024-01-15",
      "test-token"
    )
  })

  it("performs optimistic delete on mutate", async () => {
    let resolvePromise: () => void
    vi.mocked(api.habitUsage.delete).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePromise = () => resolve({})
      })
    )

    const queryClient = createTestQueryClient()
    // Seed initial data
    queryClient.setQueryData(
      queryKeys.habitUsage("user1", "2024-01-15"),
      ["method1", "method2"]
    )

    const { result } = renderHook(() => useDeleteHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    // Start deletion
    result.current.mutate({
      userId: "user1",
      methodId: "method1",
      date: "2024-01-15",
      accessToken: "test-token",
    })

    // Check optimistic delete happened
    await waitFor(() => {
      const data = queryClient.getQueryData<string[]>(
        queryKeys.habitUsage("user1", "2024-01-15")
      )
      expect(data).not.toContain("method1")
      expect(data).toContain("method2")
    })

    resolvePromise!()
  })

  it("rolls back optimistic delete on error", async () => {
    vi.mocked(api.habitUsage.delete).mockRejectedValueOnce(new Error("Failed"))

    const queryClient = createTestQueryClient()
    // Seed initial data
    queryClient.setQueryData(
      queryKeys.habitUsage("user1", "2024-01-15"),
      ["method1", "method2"]
    )

    const { result } = renderHook(() => useDeleteHabitUsage(), {
      wrapper: createWrapper(queryClient),
    })

    try {
      await result.current.mutateAsync({
        userId: "user1",
        methodId: "method1",
        date: "2024-01-15",
        accessToken: "test-token",
      })
    } catch {
      // Expected error
    }

    // Should roll back - method1 should be back
    await waitFor(() => {
      const data = queryClient.getQueryData<string[]>(
        queryKeys.habitUsage("user1", "2024-01-15")
      )
      expect(data).toContain("method1")
      expect(data).toContain("method2")
    })
  })
})

describe("useAwardPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls rewards.award with correct params", async () => {
    vi.mocked(api.rewards.award).mockResolvedValueOnce({
      pointsAwarded: 10,
      newTotal: 100,
      newBadges: [],
      levelUp: false,
      newLevel: 2,
      currentStreak: 1,
      longestStreak: 5,
    })

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useAwardPoints(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { activityType: "method", activityId: "method1" },
      accessToken: "test-token",
    })

    expect(api.rewards.award).toHaveBeenCalledWith(
      { activityType: "method", activityId: "method1" },
      "test-token"
    )
  })

  it("invalidates rewards cache on success", async () => {
    vi.mocked(api.rewards.award).mockResolvedValueOnce({
      pointsAwarded: 10,
      newTotal: 100,
      newBadges: [],
      levelUp: false,
      newLevel: 2,
      currentStreak: 1,
      longestStreak: 5,
    })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useAwardPoints(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({
      data: { activityType: "method" },
      accessToken: "test-token",
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.rewards,
      })
    })
  })
})
