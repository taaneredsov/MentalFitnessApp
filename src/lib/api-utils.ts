import type { VercelResponse } from "@vercel/node"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export function sendSuccess<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data
  })
}

export function sendError(res: VercelResponse, error: string, status = 400) {
  return res.status(status).json({
    success: false,
    error
  })
}

export function handleApiError(res: VercelResponse, error: unknown) {
  console.error("API Error:", error)

  if (error instanceof Error) {
    return sendError(res, error.message, 500)
  }

  return sendError(res, "An unexpected error occurred", 500)
}
