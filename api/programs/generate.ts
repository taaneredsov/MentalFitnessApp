import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import {
  transformGoal,
  transformMethod,
  transformDay,
  transformProgram,
  transformProgramPrompt,
  PROGRAM_FIELDS
} from "../_lib/field-mappings.js"
import { getOpenAI, buildSystemPrompt, type AIProgramResponse } from "../_lib/openai.js"

/**
 * POST /api/programs/generate - Generate AI program and create in Airtable
 * Body: { userId, goals[], startDate, duration, daysOfWeek[] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    // Parse and validate request body
    const body = parseBody(req)

    if (!body?.userId) {
      return sendError(res, "userId is required", 400)
    }
    if (!body.goals || !Array.isArray(body.goals) || body.goals.length === 0) {
      return sendError(res, "goals array is required", 400)
    }
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }
    if (!body.daysOfWeek || !Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0) {
      return sendError(res, "daysOfWeek array is required", 400)
    }

    // Fetch goal details
    const goalRecords = await base(tables.goals)
      .select({
        filterByFormula: `OR(${body.goals.map((id: string) => `RECORD_ID() = "${id}"`).join(",")})`,
        returnFieldsByFieldId: true
      })
      .all()

    const goals = goalRecords.map(record => transformGoal(record as any))

    // Fetch program prompts linked to selected goals
    const promptRecords = await base(tables.programPrompts)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Filter prompts that have at least one matching goal
    const prompts = promptRecords
      .map(record => transformProgramPrompt(record as any))
      .filter(prompt => prompt.goals.some((goalId: string) => body.goals.includes(goalId)))
      .map(prompt => ({
        goalIds: prompt.goals.filter((goalId: string) => body.goals.includes(goalId)),
        prompt: prompt.prompt
      }))

    // Fetch all methods
    const methodRecords = await base(tables.methods)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const methods = methodRecords.map(record => transformMethod(record as any))

    // Fetch selected days
    const dayRecords = await base(tables.daysOfWeek)
      .select({
        filterByFormula: `OR(${body.daysOfWeek.map((id: string) => `RECORD_ID() = "${id}"`).join(",")})`,
        returnFieldsByFieldId: true
      })
      .all()

    const days = dayRecords.map(record => transformDay(record as any))

    // Sort days in week order
    const dayOrder = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
    days.sort((a, b) => dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name))

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      goals,
      prompts,
      methods,
      days,
      duration: body.duration
    })

    // Call OpenAI GPT-4o
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Genereer een mentaal fitnessprogramma op basis van de bovenstaande informatie. Retourneer alleen het JSON object, geen andere tekst." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    })

    // Parse AI response
    const aiResponseText = completion.choices[0]?.message?.content
    if (!aiResponseText) {
      return sendError(res, "AI failed to generate program", 500)
    }

    let aiResponse: AIProgramResponse
    try {
      aiResponse = JSON.parse(aiResponseText)
    } catch {
      return sendError(res, "AI returned invalid JSON", 500)
    }

    // Validate AI response structure
    if (!aiResponse.schedule || !Array.isArray(aiResponse.schedule)) {
      return sendError(res, "AI response missing schedule", 500)
    }

    // Extract unique method IDs from schedule
    const methodIds = new Set<string>()
    for (const day of aiResponse.schedule) {
      for (const method of day.methods) {
        methodIds.add(method.methodId)
      }
    }

    // Create program in Airtable
    const programFields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek,
      [PROGRAM_FIELDS.goals]: body.goals,
      [PROGRAM_FIELDS.methods]: Array.from(methodIds)
    }

    // Add AI notes if provided
    if (aiResponse.notes) {
      programFields[PROGRAM_FIELDS.notes] = aiResponse.notes
    }

    const programRecord = await base(tables.programs).create(programFields, { typecast: true })

    // Fetch created program with computed fields
    const createdRecord = await base(tables.programs).find(programRecord.id)
    const program = transformProgram(createdRecord as any)

    // Return response
    return sendSuccess(res, {
      program,
      aiSchedule: aiResponse.schedule,
      totalSessionTime: aiResponse.totalSessionTime,
      weeklySessionTime: aiResponse.weeklySessionTime,
      recommendations: aiResponse.recommendations || []
    }, 201)
  } catch (error) {
    return handleApiError(res, error)
  }
}
