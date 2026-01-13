export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data
  })
}

/**
 * Parse request body - handles both string and object bodies
 * (vercel dev doesn't always auto-parse JSON bodies)
 */
export function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body || {}
}

export function sendError(res, error, status = 400) {
  return res.status(status).json({
    success: false,
    error
  })
}

export function handleApiError(res, error) {
  console.error("API Error:", error)

  if (error instanceof Error) {
    return sendError(res, error.message, 500)
  }

  return sendError(res, "An unexpected error occurred", 500)
}
