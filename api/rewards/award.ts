import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PROGRAM_FIELDS } from "../_lib/field-mappings.js"
import { awardRewardActivity, type RewardActivityType } from "../_lib/rewards/engine.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getProgramByAnyId } from "../_lib/repos/program-repo.js"

const awardSchema = z.object({
  activityType: z.enum([
    "method",
    "habit",
    "program",
    "sessionBonus",
    "habitDayBonus",
    "programMilestone",
    "overtuiging",
    "personalGoal"
  ]),
  activityId: z.string().optional(),
  programId: z.string().optional(),
  milestone: z.number().optional(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

async function assertProgramOwnership(programId: string, userId: string): Promise<boolean> {
  if (isPostgresConfigured()) {
    const program = await getProgramByAnyId(programId, userId)
    if (program) return true
  }

  const records = await base(tables.programs)
    .select({
      filterByFormula: `RECORD_ID() = "${programId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) {
    return false
  }
  const owner = (records[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
  return owner === userId
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    const body = awardSchema.parse(parseBody(req))

    if (body.activityType === "programMilestone" && body.programId) {
      const ownsProgram = await assertProgramOwnership(body.programId, auth.userId)
      if (!ownsProgram) {
        return sendError(res, "Forbidden: You don't own this program", 403)
      }
    }

    const result = await awardRewardActivity({
      userId: auth.userId,
      activityType: body.activityType as RewardActivityType,
      activityDate: body.activityDate,
      milestone: body.milestone,
      programId: body.programId
    })

    return sendSuccess(res, result)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
