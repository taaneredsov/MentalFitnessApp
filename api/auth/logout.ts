import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, sendError } from "../_lib/api-utils.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  // Clear refresh token cookie
  res.setHeader("Set-Cookie", [
    `refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  ])

  return sendSuccess(res, { message: "Logged out successfully" })
}
