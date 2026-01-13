import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { CreateProgramData } from "@/types/program"

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

export function useCompanies(ids: string[] | undefined) {
  return useQuery({
    queryKey: queryKeys.companies(ids || []),
    queryFn: () => api.companies.lookup(ids!),
    enabled: !!ids?.length,
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

// Mutation hooks

export function useCreateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ data, accessToken }: { data: CreateProgramData; accessToken: string }) =>
      api.programs.create(data, accessToken),
    onSuccess: (_data, variables) => {
      // Invalidate programs list for the user
      queryClient.invalidateQueries({ queryKey: queryKeys.programs(variables.data.userId) })
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
      data: { goals?: string[]; daysOfWeek?: string[]; methods?: string[]; notes?: string }
      accessToken: string
    }) => api.programs.update(id, data, accessToken),
    onSuccess: (_data, variables) => {
      // Invalidate the specific program
      queryClient.invalidateQueries({ queryKey: queryKeys.program(variables.id) })
      // Also invalidate all programs lists so homepage updates
      queryClient.invalidateQueries({ queryKey: ["programs"] })
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
      data: { userId: string; methodId: string; programId?: string; remark?: string }
      accessToken: string
    }) => api.methodUsage.create(data, accessToken),
    onSuccess: (_data, variables) => {
      // Invalidate method usage for the program (if provided)
      if (variables.data.programId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.methodUsage(variables.data.programId) })
        // Also invalidate the program to update methodUsageCount
        queryClient.invalidateQueries({ queryKey: queryKeys.program(variables.data.programId) })
      }
      // Invalidate programs list so homepage shows updated progress
      queryClient.invalidateQueries({ queryKey: ["programs"] })
    }
  })
}
