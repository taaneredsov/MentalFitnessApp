import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { CreateProgramData, CreatePersonalGoalData, UpdatePersonalGoalData, UpdateProgrammaplanningData, CreatePersoonlijkeOvertuigingData, UpdatePersoonlijkeOvertuigingData } from "@/types/program"
import type { AwardRequest } from "@/types/rewards"
import type { ReminderMode } from "@/types/notifications"
import { useAuth } from "@/contexts/AuthContext"

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

export function useGoodHabits() {
  return useQuery({
    queryKey: queryKeys.habits,
    queryFn: () => api.methods.getHabits(),
    staleTime: CACHE_LONG
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
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.companies(ids || []),
    queryFn: () => api.companies.lookup(ids!, accessToken!),
    enabled: !!ids?.length && !!accessToken,
    staleTime: CACHE_LONG
  })
}

export function useNotificationPreferences() {
  const { user, accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.notificationPreferences(user?.id || ""),
    queryFn: () => api.notifications.getPreferences(accessToken!),
    enabled: !!user?.id && !!accessToken,
    staleTime: CACHE_SHORT
  })
}

export function usePrograms(userId: string | undefined) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.programs(userId!),
    queryFn: () => api.programs.list(accessToken!),
    enabled: !!userId && !!accessToken,
    staleTime: CACHE_MEDIUM
  })
}

export function useProgram(id: string) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => api.programs.get(id, accessToken!),
    enabled: !!id && !!accessToken,
    staleTime: CACHE_MEDIUM
  })
}

export function useMethodUsage(programId: string, limit = 2) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.methodUsage(programId),
    queryFn: () => api.methodUsage.byProgram(programId, limit, accessToken!),
    enabled: !!programId && !!accessToken,
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
      data: { goals?: string[]; daysOfWeek?: string[]; methods?: string[]; notes?: string; overtuigingen?: string[] }
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

export function useUpdateProgrammaplanning(programId: string) {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: ({ planningId, data }: { planningId: string; data: UpdateProgrammaplanningData }) =>
      api.programs.updateSchedule(programId, planningId, data, accessToken!),
    onSuccess: () => {
      // Invalidate program detail to refresh schedule
      queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
      // Also invalidate programs list
      queryClient.invalidateQueries({ queryKey: ["programs"] })
    }
  })
}

export function useRegenerateSchedule(programId: string) {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: (data: { daysOfWeek: string[]; goals?: string[]; regenerateMethod: "ai" | "simple"; force?: boolean }) =>
      api.programs.regenerateSchedule(programId, data, accessToken!),
    onSuccess: () => {
      // Invalidate program detail to refresh schedule
      queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
      // Also invalidate programs list
      queryClient.invalidateQueries({ queryKey: ["programs"] })
    }
  })
}

export function useExtendProgram(programId: string) {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: (data: { weeks?: number }) =>
      api.programs.extend(programId, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
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

// Rewards hooks

export function useUserRewards() {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.rewards,
    queryFn: () => api.rewards.get(accessToken!),
    enabled: !!accessToken,
    staleTime: CACHE_SHORT
  })
}

export function useAwardPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ data, accessToken }: { data: AwardRequest; accessToken: string }) =>
      api.rewards.award(data, accessToken),
    onSuccess: () => {
      // Invalidate rewards cache to reflect new points
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards })
    }
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      accessToken,
      data
    }: {
      accessToken: string
      data: {
        enabled?: boolean
        reminderMode?: ReminderMode
        leadMinutes?: number
        preferredTimeLocal?: string
        timezone?: string
        quietHoursStart?: string
        quietHoursEnd?: string
      }
    }) => api.notifications.updatePreferences(data, accessToken),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences(user.id) })
      }
    }
  })
}

// Habit usage hooks

export function useHabitUsage(userId: string | undefined, date: string) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.habitUsage(userId || "", date),
    queryFn: () => api.habitUsage.get(userId!, date, accessToken!),
    enabled: !!userId && !!accessToken && !!date,
    staleTime: CACHE_SHORT
  })
}

export function useRecordHabitUsage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      data,
      accessToken
    }: {
      data: { userId: string; methodId: string; date: string }
      accessToken: string
    }) => api.habitUsage.create(data, accessToken),
    // Optimistic update: immediately add to cache
    onMutate: async (variables) => {
      const queryKey = queryKeys.habitUsage(variables.data.userId, variables.data.date)

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<string[]>(queryKey)

      // Optimistically update cache - add methodId to completed list
      queryClient.setQueryData<string[]>(queryKey, (old = []) => {
        if (old.includes(variables.data.methodId)) return old
        return [...old, variables.data.methodId]
      })

      return { previousData, queryKey }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    },
    onSuccess: () => {
      // Don't invalidate habitUsage - optimistic update is correct and API GET has issues
      // Only invalidate rewards cache to reflect point changes
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards })
    }
  })
}

export function useDeleteHabitUsage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      methodId,
      date,
      accessToken
    }: {
      userId: string
      methodId: string
      date: string
      accessToken: string
    }) => api.habitUsage.delete(userId, methodId, date, accessToken),
    // Optimistic update: immediately remove from cache
    onMutate: async (variables) => {
      const queryKey = queryKeys.habitUsage(variables.userId, variables.date)

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<string[]>(queryKey)

      // Optimistically update cache - remove methodId from completed list
      queryClient.setQueryData<string[]>(queryKey, (old = []) => {
        return old.filter(id => id !== variables.methodId)
      })

      return { previousData, queryKey }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    }
    // Don't invalidate habitUsage on success - optimistic update is correct
  })
}

// Personal Goals hooks

export function usePersonalGoals() {
  const { user, accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.personalGoals(user?.id || ""),
    queryFn: () => api.personalGoals.list(accessToken!),
    enabled: !!user?.id && !!accessToken,
    staleTime: CACHE_MEDIUM
  })
}

export function useCompletedPersonalGoals() {
  const { user, accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.completedPersonalGoals(user?.id || ""),
    queryFn: () => api.personalGoals.list(accessToken!, { include: "voltooid" }),
    enabled: !!user?.id && !!accessToken,
    staleTime: CACHE_MEDIUM
  })
}

export function usePersonalGoalUsage(userId: string | undefined, date: string) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.personalGoalUsage(userId || "", date),
    queryFn: () => api.personalGoalUsage.get(userId!, date, accessToken!),
    enabled: !!userId && !!accessToken && !!date,
    staleTime: CACHE_SHORT
  })
}

export function useCreatePersonalGoal() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ data, accessToken }: { data: CreatePersonalGoalData; accessToken: string }) =>
      api.personalGoals.create(data, accessToken),
    onSuccess: () => {
      // Invalidate personal goals list
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.personalGoals(user.id) })
      }
    }
  })
}

export function useUpdatePersonalGoal() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      id,
      data,
      accessToken
    }: {
      id: string
      data: UpdatePersonalGoalData
      accessToken: string
    }) => api.personalGoals.update(id, data, accessToken),
    onSuccess: () => {
      // Invalidate personal goals list
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.personalGoals(user.id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.completedPersonalGoals(user.id) })
      }
    }
  })
}

export function useDeletePersonalGoal() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ id, accessToken }: { id: string; accessToken: string }) =>
      api.personalGoals.delete(id, accessToken),
    onSuccess: () => {
      // Invalidate personal goals list
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.personalGoals(user.id) })
      }
    }
  })
}

type GoalCounts = Record<string, { today: number; total: number }>

export function useCompletePersonalGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      data,
      accessToken
    }: {
      data: { userId: string; personalGoalId: string; date: string }
      accessToken: string
    }) => api.personalGoalUsage.create(data, accessToken),
    // Optimistic update: immediately increment counts
    onMutate: async (variables) => {
      const queryKey = queryKeys.personalGoalUsage(variables.data.userId, variables.data.date)

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<GoalCounts>(queryKey)

      // Optimistically update cache - increment counts
      queryClient.setQueryData<GoalCounts>(queryKey, (old = {}) => {
        const goalId = variables.data.personalGoalId
        const current = old[goalId] || { today: 0, total: 0 }
        return {
          ...old,
          [goalId]: {
            today: current.today + 1,
            total: current.total + 1
          }
        }
      })

      return { previousData, queryKey }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    },
    onSuccess: () => {
      // Invalidate rewards cache to reflect point changes
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards })
      queryClient.invalidateQueries({ queryKey: ["completedPersonalGoals"] })
    }
  })
}

// Overtuigingen hooks

export function useOvertuigingen() {
  return useQuery({
    queryKey: queryKeys.overtuigingen,
    queryFn: () => api.overtuigingen.list(),
    staleTime: CACHE_LONG
  })
}

export function useMindsetCategories() {
  return useQuery({
    queryKey: queryKeys.mindsetCategories,
    queryFn: () => api.mindsetCategories.list(),
    staleTime: CACHE_LONG
  })
}

export function useOvertuigingsByGoals(goalIds: string[]) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.overtuigingenByGoals(goalIds),
    queryFn: () => api.overtuigingen.byGoals(goalIds, accessToken!),
    enabled: goalIds.length > 0 && !!accessToken,
    staleTime: CACHE_LONG
  })
}

export function useOvertuigingUsage(programId: string) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.overtuigingUsage(programId),
    queryFn: () => api.overtuigingUsage.get(programId, accessToken!),
    enabled: !!programId && !!accessToken,
    staleTime: CACHE_SHORT
  })
}

export function useAllOvertuigingUsage() {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.allOvertuigingUsage,
    queryFn: () => api.overtuigingUsage.getAll(accessToken!),
    enabled: !!accessToken,
    staleTime: CACHE_SHORT
  })
}

export function usePersoonlijkeOvertuigingen() {
  const { user, accessToken } = useAuth()

  return useQuery({
    queryKey: queryKeys.persoonlijkeOvertuigingen(user?.id || ""),
    queryFn: () => api.persoonlijkeOvertuigingen.list(accessToken!),
    enabled: !!user?.id && !!accessToken,
    staleTime: CACHE_MEDIUM
  })
}

export function useCreatePersoonlijkeOvertuiging() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ data, accessToken }: { data: CreatePersoonlijkeOvertuigingData; accessToken: string }) =>
      api.persoonlijkeOvertuigingen.create(data, accessToken),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.persoonlijkeOvertuigingen(user.id) })
      }
    }
  })
}

export function useUpdatePersoonlijkeOvertuiging() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      id,
      data,
      accessToken
    }: {
      id: string
      data: UpdatePersoonlijkeOvertuigingData
      accessToken: string
    }) => api.persoonlijkeOvertuigingen.update(id, data, accessToken),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.persoonlijkeOvertuigingen(user.id) })
      }
    }
  })
}

export function useDeletePersoonlijkeOvertuiging() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ id, accessToken }: { id: string; accessToken: string }) =>
      api.persoonlijkeOvertuigingen.delete(id, accessToken),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.persoonlijkeOvertuigingen(user.id) })
      }
    }
  })
}

export function useCompleteOvertuiging() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      data,
      accessToken
    }: {
      data: { userId: string; overtuigingId: string; programId?: string; date: string }
      accessToken: string
    }) => api.overtuigingUsage.create(data, accessToken),
    onSuccess: (_data, variables) => {
      // Invalidate overtuiging usage for the program (if applicable)
      if (variables.data.programId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.overtuigingUsage(variables.data.programId) })
      }
      // Invalidate all overtuiging usage (for mindset page)
      queryClient.invalidateQueries({ queryKey: queryKeys.allOvertuigingUsage })
      // Invalidate rewards cache to reflect point changes
      queryClient.invalidateQueries({ queryKey: queryKeys.rewards })
    }
  })
}
