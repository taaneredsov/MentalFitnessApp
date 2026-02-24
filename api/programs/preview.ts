import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  getOpenAI,
  buildSystemPrompt,
  AI_PROGRAM_SCHEMA,
  type AIProgramResponse,
  type TrainingDate
} from "../_lib/openai.js"
import { loadProgramGenerationData } from "../_lib/program-generation-data.js"

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
 * POST /api/programs/preview - Generate AI program preview WITHOUT saving to Airtable
 * Body: { userId, goals[], startDate, duration, daysOfWeek[] }
 * Returns: AI schedule + available methods for editing
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

    // Load all reference data (Postgres with Airtable fallback)
    const data = await loadProgramGenerationData({
      goalIds: body.goals,
      dayIds: body.daysOfWeek
    })

    // Calculate all training dates for the program duration
    const trainingDates = calculateTrainingDates(body.startDate, body.duration, data.days)

    if (trainingDates.length === 0) {
      return sendError(res, "No training dates could be calculated. Check start date and selected days.", 400)
    }

    // Build system prompt with training dates, overtuigingen, and goede gewoontes
    const systemPrompt = buildSystemPrompt({
      goals: data.goals as Array<{ id: string; name: string; description?: string }>,
      programPrompts: data.programPrompts,
      systemPrompts: data.systemPrompts,
      methods: data.methods,
      trainingDates,
      duration: body.duration,
      overtuigingen: data.aiOvertuigingen,
      goedeGewoontes: data.aiGoedeGewoontes
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
      max_tokens: 4000
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
    const validMethodIds = new Set(data.rawMethods.map(m => m.id as string))
    for (const day of aiResponse.schedule) {
      day.methods = day.methods.filter(m => {
        if (!validMethodIds.has(m.methodId)) {
          console.warn(`[preview] Filtering out invalid methodId ${m.methodId} from schedule (not a known method)`)
          return false
        }
        return true
      })
    }

    // Transform methods to frontend format (without internal fields)
    const availableMethods = data.rawMethods.map(m => ({
      id: m.id as string,
      name: m.name as string,
      duration: m.duration as number,
      description: m.description as string | undefined,
      optimalFrequency: (m.optimalFrequency as string[]) || [],
      photo: m.photo as string | undefined
    }))

    // Map AI-selected overtuigingen to full objects for frontend
    const overtuigingMap = new Map(data.allOvertuigingen.map(o => [o.id, o]))
    const suggestedOvertuigingen = (aiResponse.selectedOvertuigingen || [])
      .filter(sel => overtuigingMap.has(sel.overtuigingId))
      .map(sel => {
        const full = overtuigingMap.get(sel.overtuigingId)!
        return { id: full.id, name: full.name, order: full.order }
      })

    console.log("[preview] AI-selected overtuigingen:", suggestedOvertuigingen.length, "from pool:", data.aiOvertuigingen.length)

    // Map AI-selected goede gewoontes to frontend format
    const goedeGewoonteMap = new Map(data.aiGoedeGewoontes.map(g => [g.id, g]))
    const suggestedGoedeGewoontes = (aiResponse.selectedGoedeGewoontes || [])
      .filter(sel => goedeGewoonteMap.has(sel.goedeGewoonteId))
      .map(sel => {
        const full = goedeGewoonteMap.get(sel.goedeGewoonteId)!
        return { id: full.id, name: full.name, reason: sel.reason }
      })

    console.log("[preview] AI-selected goede gewoontes:", suggestedGoedeGewoontes.length, "from pool:", data.aiGoedeGewoontes.length)

    // Return preview response (NO Airtable records created)
    return sendSuccess(res, {
      aiSchedule: aiResponse.schedule,
      weeklySessionTime: aiResponse.weeklySessionTime,
      recommendations: aiResponse.recommendations || [],
      programSummary: aiResponse.programSummary,
      programName: aiResponse.programName,
      availableMethods,
      selectedGoals: data.goals,
      suggestedOvertuigingen,
      suggestedGoedeGewoontes
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
