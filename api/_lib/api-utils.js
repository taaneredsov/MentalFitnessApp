export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data
  })
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
