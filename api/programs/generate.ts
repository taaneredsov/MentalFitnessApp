import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  transformGoal,
  transformMethod,
  transformDay,
  transformProgram,
  transformProgramPrompt,
  transformExperienceLevel,
  transformOvertuiging,
  transformMindsetCategory,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS
} from "../_lib/field-mappings.js"
import {
  getOpenAI,
  buildSystemPrompt,
  AI_PROGRAM_SCHEMA,
  type AIProgramResponse,
  type TrainingDate,
  type AIMethod,
  type AIOvertuiging
} from "../_lib/openai.js"

// Day name to JS weekday mapping (0 = Sunday, 1 = Monday, etc.)
const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  "Zondag": 0,
  "Maandag": 1,
  "Dinsdag": 2,
  "Woensdag": 3,
  "Donderdag": 4,
  "Vrijdag": 5,
  "Zaterdag": 6
}

const WEEKDAY_TO_DAY_NAME = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"]

/**
 * Parse duration string to number of weeks (e.g., "4 weken" -> 4)
 */
function parseWeeks(duration: string): number {
  const match = duration.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 4
}

/**
 * Calculate all training dates based on start date, duration, and selected days
 */
function calculateTrainingDates(
  startDate: string,
  duration: string,
  days: Array<{ id: string; name: string }>
): TrainingDate[] {
  const weeks = parseWeeks(duration)
  const start = new Date(startDate)
  const trainingDates: TrainingDate[] = []

  // Create a map of weekday to day record for quick lookup
  const dayMap = new Map<number, { id: string; name: string }>()
  for (const day of days) {
    const weekday = DAY_NAME_TO_WEEKDAY[day.name]
    if (weekday !== undefined) {
      dayMap.set(weekday, day)
    }
  }

  // Calculate end date (exclusive)
  const endDate = new Date(start)
  endDate.setDate(endDate.getDate() + weeks * 7)

  // Iterate through each day from start to end
  const current = new Date(start)
  while (current < endDate) {
    const weekday = current.getDay()
    const dayRecord = dayMap.get(weekday)

    if (dayRecord) {
      // Format date as YYYY-MM-DD
      const dateStr = current.toISOString().split("T")[0]
      trainingDates.push({
        date: dateStr,
        dayOfWeek: WEEKDAY_TO_DAY_NAME[weekday],
        dayId: dayRecord.id
      })
    }

    // Move to next day
    current.setDate(current.getDate() + 1)
  }

  return trainingDates
}

/**
 * Create Programmaplanning records in Airtable in batches
 * Airtable allows max 10 records per batch
 */
async function createProgramplanningRecords(
  programId: string,
  goalIds: string[],
  schedule: AIProgramResponse["schedule"]
): Promise<void> {
  const records: Array<{ fields: Record<string, unknown> }> = []

  for (const day of schedule) {
    // Extract method IDs for this day
    const methodIds = day.methods.map(m => m.methodId)

    // Build session description
    const sessionDescription = day.methods
      .map(m => `${m.methodName} (${m.duration} min)`)
      .join("\n")

    records.push({
      fields: {
        [PROGRAMMAPLANNING_FIELDS.program]: [programId],
        [PROGRAMMAPLANNING_FIELDS.date]: day.date,
        [PROGRAMMAPLANNING_FIELDS.dayOfWeek]: [day.dayId],
        [PROGRAMMAPLANNING_FIELDS.methods]: methodIds,
        [PROGRAMMAPLANNING_FIELDS.goals]: goalIds,
        [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription
      }
    })
  }

  // Create in batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await base(tables.programmaplanning).create(batch, { typecast: true })
  }
}

/**
 * POST /api/programs/generate - Generate AI program and create in Airtable
 * Body: { userId, goals[], startDate, duration, daysOfWeek[] }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)

    // Parse and validate request body
    const body = parseBody(req)

    // Override userId with authenticated user
    body.userId = auth.userId
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

    // Fetch all program prompts (both Systeem and Programmaopbouw types)
    const promptRecords = await base(tables.programPrompts)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Transform and separate prompts by type
    const allPrompts = promptRecords.map(record => transformProgramPrompt(record as any))

    // Extract system prompts (Type: Systeem) into a Map keyed by name
    const systemPromptRecords = allPrompts.filter(p => p.promptType === "Systeem")
    const systemPrompts = new Map<string, string>()
    for (const sp of systemPromptRecords) {
      if (sp.name && sp.prompt) {
        systemPrompts.set(sp.name, sp.prompt)
      }
    }

    // Filter goal-specific prompts (Type: Programmaopbouw or no type for backward compatibility)
    const programPrompts = allPrompts
      .filter(p => p.promptType === "Programmaopbouw" || !p.promptType)
      .filter(prompt => prompt.goals.some((goalId: string) => body.goals.includes(goalId)))
      .map(prompt => ({
        goalIds: prompt.goals.filter((goalId: string) => body.goals.includes(goalId)),
        prompt: prompt.prompt
      }))

    // Fetch experience levels to map IDs to names
    const experienceLevelRecords = await base(tables.experienceLevels)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const experienceLevels = experienceLevelRecords.map(record => transformExperienceLevel(record as any))
    const experienceLevelMap = new Map(experienceLevels.map(el => [el.id, el.name]))

    // Fetch all methods (including optimalFrequency, linkedGoals, experienceLevel)
    const methodRecords = await base(tables.methods)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const rawMethods = methodRecords.map(record => transformMethod(record as any))

    // Transform methods to AIMethod format with frequency, experience level, and goal relevance
    const methods: AIMethod[] = rawMethods.map(m => {
      // Get experience level name from the first linked record (if any)
      const expLevelId = m.experienceLevelIds?.[0]
      const experienceLevel = expLevelId ? experienceLevelMap.get(expLevelId) : undefined

      // Check if this method is linked to any of the selected goals
      const isRecommendedForGoals = m.linkedGoalIds?.some((goalId: string) => body.goals.includes(goalId)) || false

      return {
        id: m.id,
        name: m.name,
        duration: m.duration,
        description: m.description,
        optimalFrequency: m.optimalFrequency || [],
        experienceLevel,
        isRecommendedForGoals
      }
    })

    // Fetch selected days
    const dayRecords = await base(tables.daysOfWeek)
      .select({
        filterByFormula: `OR(${body.daysOfWeek.map((id: string) => `RECORD_ID() = "${id}"`).join(",")})`,
        returnFieldsByFieldId: true
      })
      .all()

    const days = dayRecords.map(record => transformDay(record as any))

    // Calculate all training dates for the program duration
    const trainingDates = calculateTrainingDates(body.startDate, body.duration, days)

    if (trainingDates.length === 0) {
      return sendError(res, "No training dates could be calculated. Check start date and selected days.", 400)
    }

    // Fetch overtuigingen linked to goals (via mindset categories) BEFORE AI call
    const categoryRecords = await base(tables.mindsetCategories)
      .select({ returnFieldsByFieldId: true })
      .all()
    const categories = categoryRecords.map(r => transformMindsetCategory(r as any))

    const matchingCategories = categories.filter(cat =>
      cat.goalIds.some((gid: string) => body.goals.includes(gid))
    )

    const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))

    const overtuigingIds = [...new Set(
      matchingCategories.flatMap(cat => cat.overtuigingIds as string[])
    )]

    let allOvertuigingen: Array<{ id: string; name: string; categoryIds: string[]; order: number; levels: string[] }> = []
    if (overtuigingIds.length > 0) {
      const formula = `OR(${overtuigingIds.map(id => `RECORD_ID() = "${id}"`).join(",")})`
      const overtuigingRecords = await base(tables.overtuigingen)
        .select({ filterByFormula: formula, returnFieldsByFieldId: true })
        .all()

      allOvertuigingen = overtuigingRecords
        .map(r => transformOvertuiging(r as any))
        .filter(o => o.levels.includes("Niveau 1"))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    // Transform to AIOvertuiging format for the prompt
    const aiOvertuigingen: AIOvertuiging[] = allOvertuigingen.map(o => ({
      id: o.id,
      name: o.name,
      categoryName: (o.categoryIds?.[0] ? categoryNameMap.get(o.categoryIds[0]) : undefined) as string | undefined
    }))

    // Build system prompt with training dates and overtuigingen
    const systemPrompt = buildSystemPrompt({
      goals,
      programPrompts,
      systemPrompts,
      methods,
      trainingDates,
      duration: body.duration,
      overtuigingen: aiOvertuigingen
    })

    // Call OpenAI GPT-4o with Structured Outputs
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Genereer een mentaal fitnessprogramma op basis van de bovenstaande informatie." }
      ],
      response_format: AI_PROGRAM_SCHEMA,
      temperature: 0.7,
      max_tokens: 4000  // Increased for longer schedules
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

    // Validate schedule method IDs against actual methods to prevent AI mixing up IDs
    const validMethodIds = new Set(rawMethods.map(m => m.id))
    for (const day of aiResponse.schedule) {
      day.methods = day.methods.filter(m => {
        if (!validMethodIds.has(m.methodId)) {
          console.warn(`[generate] Filtering out invalid methodId ${m.methodId} from schedule (not a known method)`)
          return false
        }
        return true
      })
    }

    // Extract unique method IDs from schedule
    const methodIds = new Set<string>()
    for (const day of aiResponse.schedule) {
      for (const method of day.methods) {
        methodIds.add(method.methodId)
      }
    }

    // Map AI-selected overtuiging IDs for saving
    const overtuigingMap = new Map(allOvertuigingen.map(o => [o.id, o]))
    const selectedOvertuigingIds = (aiResponse.selectedOvertuigingen || [])
      .filter(sel => overtuigingMap.has(sel.overtuigingId))
      .map(sel => sel.overtuigingId)

    // Create program in Airtable
    const programFields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek,
      [PROGRAM_FIELDS.goals]: body.goals,
      [PROGRAM_FIELDS.methods]: Array.from(methodIds)
    }

    // Add overtuigingen
    if (selectedOvertuigingIds.length > 0) {
      programFields[PROGRAM_FIELDS.overtuigingen] = selectedOvertuigingIds
    }

    // Add AI program summary as notes
    if (aiResponse.programSummary) {
      programFields[PROGRAM_FIELDS.notes] = aiResponse.programSummary
    }

    const programRecord = await base(tables.programs).create(programFields, { typecast: true })

    // Create Programmaplanning records for each training date
    await createProgramplanningRecords(programRecord.id, body.goals, aiResponse.schedule)

    // Fetch created program with computed fields
    const createdRecord = await base(tables.programs).find(programRecord.id)
    const program = transformProgram(createdRecord as any)

    // Return response
    return sendSuccess(res, {
      program,
      aiSchedule: aiResponse.schedule,
      weeklySessionTime: aiResponse.weeklySessionTime,
      recommendations: aiResponse.recommendations || [],
      programSummary: aiResponse.programSummary
    }, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
