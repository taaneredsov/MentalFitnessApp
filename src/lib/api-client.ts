import type { User } from "@/types/user"
import type { Program, ProgramDetail, Method, MethodDetail, MethodUsage, Goal, Day, CreateProgramData, AIGenerateRequest, AIGenerateResponse, AIPreviewRequest, AIPreviewResponse, AIConfirmRequest, PersonalGoal, CreatePersonalGoalData, UpdatePersonalGoalData, Programmaplanning, UpdateProgrammaplanningData, Overtuiging, MindsetCategory, PersoonlijkeOvertuiging, CreatePersoonlijkeOvertuigingData, UpdatePersoonlijkeOvertuigingData, OvertuigingUsageMap } from "@/types/program"
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
  email?: string
}

export interface MagicLinkResponse {
  message: string
}

export interface VerifyResponse {
  user: User
  accessToken: string
}

export const api = {
  auth: {
    setPassword: (email: string, code: string, password: string) =>
      request<SetPasswordResponse>("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ email, code, password })
      }),

    requestMagicLink: (email: string) =>
      request<MagicLinkResponse>("/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email })
      }),

    verifyToken: (token: string) =>
      request<VerifyResponse>(`/auth/verify?token=${encodeURIComponent(token)}`),

    verifyCode: (email: string, code: string) =>
      request<VerifyResponse>("/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code })
      })
  },

  users: {
    lookup: (email: string, accessToken: string) =>
      request<User>(`/users/lookup?email=${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: {
      name: string
      email: string
      password: string
      role?: string
      languageCode?: string
    }, accessToken: string) =>
      request<User>("/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
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
    lookup: (ids: string[], accessToken: string) =>
      request<Record<string, string>>(`/companies/lookup?ids=${ids.join(",")}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
  },

  goals: {
    list: () => request<Goal[]>("/goals")
  },

  days: {
    list: () => request<Day[]>("/days")
  },

  programs: {
    list: (accessToken: string) =>
      request<Program[]>("/programs", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    get: (id: string, accessToken: string) =>
      request<ProgramDetail>(`/programs/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: CreateProgramData, accessToken: string) =>
      request<Program>("/programs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    getMethods: (id: string, accessToken: string) =>
      request<string[]>(`/programs/${encodeURIComponent(id)}/methods`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    update: (id: string, data: { goals?: string[]; daysOfWeek?: string[]; methods?: string[]; notes?: string; overtuigingen?: string[] }, accessToken: string) =>
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
      }),

    updateSchedule: (programId: string, planningId: string, data: UpdateProgrammaplanningData, accessToken: string) =>
      request<Programmaplanning>(`/programs/${encodeURIComponent(programId)}/schedule/${encodeURIComponent(planningId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    regenerateSchedule: (
      programId: string,
      data: { daysOfWeek: string[]; goals?: string[]; regenerateMethod: "ai" | "simple"; force?: boolean },
      accessToken: string
    ) =>
      request<{
        program: Program
        preservedSessions: number
        regeneratedSessions: number
        deletedSessions: number
      }>(`/programs/${encodeURIComponent(programId)}/regenerate-schedule`, {
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
      request<MethodUsage>("/method-usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    updateRemark: (id: string, remark: string, accessToken: string) =>
      request<MethodUsage>(`/method-usage/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ remark })
      }),

    byProgram: (programId: string, limit = 2, accessToken?: string) =>
      request<MethodUsage[]>(`/method-usage/by-program?programId=${encodeURIComponent(programId)}&limit=${limit}`, {
        ...(accessToken && {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
      })
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
  },

  personalGoals: {
    list: (accessToken: string) =>
      request<PersonalGoal[]>("/personal-goals", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: CreatePersonalGoalData, accessToken: string) =>
      request<PersonalGoal>("/personal-goals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    update: (id: string, data: UpdatePersonalGoalData, accessToken: string) =>
      request<PersonalGoal>(`/personal-goals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    delete: (id: string, accessToken: string) =>
      request<void>(`/personal-goals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
  },

  personalGoalUsage: {
    get: (userId: string, date: string, accessToken: string) =>
      request<Record<string, { today: number; total: number }>>(`/personal-goal-usage?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: { userId: string; personalGoalId: string; date: string }, accessToken: string) =>
      request<{ id: string; pointsAwarded: number; todayCount: number; totalCount: number }>("/personal-goal-usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      })
  },

  overtuigingen: {
    list: () => request<Overtuiging[]>("/overtuigingen"),

    byGoals: (goalIds: string[], accessToken: string) =>
      request<Overtuiging[]>(`/overtuigingen/by-goals?goalIds=${goalIds.map(id => encodeURIComponent(id)).join(",")}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
  },

  mindsetCategories: {
    list: () => request<MindsetCategory[]>("/mindset-categories")
  },

  overtuigingUsage: {
    get: (programId: string, accessToken: string) =>
      request<OvertuigingUsageMap>(`/overtuiging-usage?programId=${encodeURIComponent(programId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    getAll: (accessToken: string) =>
      request<OvertuigingUsageMap>(`/overtuiging-usage?all=true`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: { userId: string; overtuigingId: string; programId?: string; date: string }, accessToken: string) =>
      request<{ id: string; pointsAwarded: number }>("/overtuiging-usage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      })
  },

  persoonlijkeOvertuigingen: {
    list: (accessToken: string) =>
      request<PersoonlijkeOvertuiging[]>("/persoonlijke-overtuigingen", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),

    create: (data: CreatePersoonlijkeOvertuigingData, accessToken: string) =>
      request<PersoonlijkeOvertuiging>("/persoonlijke-overtuigingen", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    update: (id: string, data: UpdatePersoonlijkeOvertuigingData, accessToken: string) =>
      request<PersoonlijkeOvertuiging>(`/persoonlijke-overtuigingen/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      }),

    delete: (id: string, accessToken: string) =>
      request<void>(`/persoonlijke-overtuigingen/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
  }
}

export { ApiError }
