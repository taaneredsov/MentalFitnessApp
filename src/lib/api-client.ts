import type { User } from "@/types/user"
import type { Program, ProgramDetail, Method, MethodDetail, MethodUsage, Goal, Day, CreateProgramData, AIGenerateRequest, AIGenerateResponse, AIPreviewRequest, AIPreviewResponse, AIConfirmRequest } from "@/types/program"
import type { UserRewards, AwardRequest, AwardResponse } from "@/types/rewards"

const API_BASE = "/api"

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { headers, ...restOptions } = options
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>)
    }
  })

  const json: ApiResponse<T> = await response.json()

  if (!json.success) {
    throw new ApiError(json.error || "Unknown error", response.status)
  }

  return json.data as T
}

export interface SetPasswordResponse {
  user: User
  accessToken: string
}

export interface LoginResponse {
  user?: User
  accessToken?: string
  needsPasswordSetup?: boolean
  userId?: string
  email?: string
}

export const api = {
  auth: {
    setPassword: (userId: string, email: string, password: string) =>
      request<SetPasswordResponse>("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ userId, email, password })
      })
  },

  users: {
    lookup: (email: string) =>
      request<User>(`/users/lookup?email=${encodeURIComponent(email)}`),

    create: (data: {
      name: string
      email: string
      password: string
      role?: string
      languageCode?: string
    }) =>
      request<User>("/users", {
        method: "POST",
        body: JSON.stringify(data)
      }),

    update: (
      id: string,
      data: {
        name?: string
        role?: string
        languageCode?: string
        lastLogin?: string
      }
    ) =>
      request<User>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      }),

    changePassword: (password: string, accessToken: string) =>
      request<{ success: boolean }>("/users/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ password })
      })
  },

  companies: {
    lookup: (ids: string[]) =>
      request<Record<string, string>>(`/companies/lookup?ids=${ids.join(",")}`)
  },

  goals: {
    list: () => request<Goal[]>("/goals")
  },

  days: {
    list: () => request<Day[]>("/days")
  },

  programs: {
    list: (userId: string) =>
      request<Program[]>(`/programs?userId=${encodeURIComponent(userId)}`),

    get: (id: string) => request<ProgramDetail>(`/programs/${encodeURIComponent(id)}`),

    create: (data: CreateProgramData, accessToken: string) =>
      request<Program>("/programs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    getMethods: (id: string) =>
      request<string[]>(`/programs/${encodeURIComponent(id)}/methods`),

    update: (id: string, data: { goals?: string[]; daysOfWeek?: string[]; methods?: string[]; notes?: string }, accessToken: string) =>
      request<Program>(`/programs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    generate: (data: AIGenerateRequest, accessToken: string) =>
      request<AIGenerateResponse>("/programs/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    preview: (data: AIPreviewRequest, accessToken: string) =>
      request<AIPreviewResponse>("/programs/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    confirm: (data: AIConfirmRequest, accessToken: string) =>
      request<AIGenerateResponse>("/programs/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      })
  },

  methods: {
    list: () => request<Method[]>("/methods"),

    get: (id: string) => request<MethodDetail>(`/methods/${encodeURIComponent(id)}`),

    getHabits: () => request<{ id: string; name: string; description?: string }[]>("/methods/habits")
  },

  methodUsage: {
    create: (data: { userId: string; methodId: string; programId?: string; programmaplanningId?: string; remark?: string }, accessToken: string) =>
      request<{ id: string }>("/method-usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    byProgram: (programId: string, limit = 2) =>
      request<MethodUsage[]>(`/method-usage/by-program?programId=${encodeURIComponent(programId)}&limit=${limit}`)
  },

  rewards: {
    get: (accessToken: string) =>
      request<UserRewards>("/rewards", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    award: (data: AwardRequest, accessToken: string) =>
      request<AwardResponse>("/rewards/award", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      })
  },

  habitUsage: {
    get: (userId: string, date: string, accessToken: string) =>
      request<string[]>(`/habit-usage?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: { userId: string; methodId: string; date: string }, accessToken: string) =>
      request<{ id: string; pointsAwarded?: number }>("/habit-usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    delete: (userId: string, methodId: string, date: string, accessToken: string) =>
      request<void>(`/habit-usage?userId=${encodeURIComponent(userId)}&methodId=${encodeURIComponent(methodId)}&date=${encodeURIComponent(date)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
  }
}

export { ApiError }
