import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  computeProgramProgress,
  createProgram,
  listProgramsByUser,
  toApiProgram
} from "../_lib/repos/program-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { getUserByIdWithReadThrough } from "../_lib/sync/user-readthrough.js"

/**
 * GET /api/programs - Returns all programs for the authenticated user
 * POST /api/programs - Creates a new program
 */
export default async function handler(req: Request, res: Response) {
  if (req.method === "POST") {
    return handlePost(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  return handleGet(req, res)
}

async function handleGet(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const programs = await listProgramsByUser(auth.userId)
    const progressByProgram = await computeProgramProgress(programs)

    const data = programs.map((program) => {
      const baseData = toApiProgram(program)
      const progress = progressByProgram.get(program.id)
      return {
        ...baseData,
        totalMethods: progress?.totalMethods || 0,
        completedMethods: progress?.completedMethods || 0,
        methodUsageCount: progress?.completedMethods || 0,
        frequency: Array.isArray(baseData.daysOfWeek) ? (baseData.daysOfWeek as string[]).length : 0
      }
    })

    return sendSuccess(res, data)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handlePost(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const body = parseBody(req)

    body.userId = auth.userId
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }

    const user = await getUserByIdWithReadThrough(auth.userId)
    if (!user) {
      return sendError(res, "User not found", 404)
    }

    let program
    try {
      program = await createProgram({
        userId: auth.userId,
        startDate: body.startDate,
        duration: body.duration,
        goals: Array.isArray(body.goals) ? body.goals : [],
        methods: Array.isArray(body.methods) ? body.methods : [],
        daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [],
        notes: body.notes,
        overtuigingen: Array.isArray(body.overtuigingen) ? body.overtuigingen : [],
        creationType: "Manueel"
      })
    } catch (error) {
      if (error instanceof Error && error.message === "PROGRAM_OVERLAP") {
        return sendError(res, "Dit programma overlapt met een bestaand programma. Kies andere datums.", 409)
      }
      throw error
    }

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: program.id,
      payload: {
        userId: program.userId,
        startDate: program.startDate,
        duration: program.duration,
        status: program.status,
        creationType: program.creationType || "Manueel",
        notes: program.notes,
        goals: program.goals,
        methods: program.methods,
        daysOfWeek: program.daysOfWeek,
        overtuigingen: program.overtuigingen
      },
      priority: 30
    })

    return sendSuccess(res, toApiProgram(program), 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
