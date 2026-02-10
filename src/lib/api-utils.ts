import type { Response } from "express"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data
  })
}

export function sendError(res: Response, error: string, status = 400) {
  return res.status(status).json({
    success: false,
    error
  })
}

export function handleApiError(res: Response, error: unknown) {
  console.error("API Error:", error)

  if (error instanceof Error) {
    return sendError(res, error.message, 500)
  }

  return sendError(res, "An unexpected error occurred", 500)
}
