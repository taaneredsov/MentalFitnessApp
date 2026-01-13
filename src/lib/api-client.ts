import type { User } from "@/types/user"
import type { Program, ProgramDetail } from "@/types/program"

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
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  })

  const json: ApiResponse<T> = await response.json()

  if (!json.success) {
    throw new ApiError(json.error || "Unknown error", response.status)
  }

  return json.data as T
}

export const api = {
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
      })
  },

  companies: {
    lookup: (ids: string[]) =>
      request<Record<string, string>>(`/companies/lookup?ids=${ids.join(",")}`)
  },

  programs: {
    list: (userId: string) =>
      request<Program[]>(`/programs?userId=${encodeURIComponent(userId)}`),

    get: (id: string) => request<ProgramDetail>(`/programs/${encodeURIComponent(id)}`)
  }
}

export { ApiError }
