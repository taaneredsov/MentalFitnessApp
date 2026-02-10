import type { Request, Response } from "express"
import { sendSuccess, sendError, parseBody } from "../_lib/api-utils.js"
import { cache } from "../_lib/cache.js"
import { tables } from "../_lib/airtable.js"

/**
 * POST /api/cache/invalidate
 * Invalidates cache entries for specified table
 *
 * Body: { table: string, recordId?: string }
 * Headers: x-cache-secret: <CACHE_INVALIDATION_SECRET>
 *
 * Used by Airtable Automations to clear cache when data changes
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  // Verify secret token
  const secret = req.headers["x-cache-secret"]
  if (!secret || secret !== process.env.CACHE_INVALIDATION_SECRET) {
    return sendError(res, "Unauthorized", 401)
  }

  const body = parseBody(req)
  const { table } = body

  if (!table) {
    return sendError(res, "Table name is required", 400)
  }

  // Get table ID from name
  const tableId = tables[table as keyof typeof tables]
  if (!tableId) {
    return sendError(res, `Invalid table name: ${table}`, 400)
  }

  try {
    // Invalidate all cache entries for this table
    const pattern = `airtable:${tableId}:*`
    const count = await cache.invalidate(pattern)

    console.log(`Cache invalidated: ${table} (${tableId}), ${count} keys removed`)

    return sendSuccess(res, {
      invalidated: count,
      table,
      tableId
    })
  } catch (error) {
    console.error("Cache invalidation error:", error)
    return sendError(res, "Failed to invalidate cache", 500)
  }
}
