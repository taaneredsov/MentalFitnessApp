import { base, tables } from "./airtable.js"
import { isPostgresConfigured } from "./db/client.js"
import {
  transformGoal,
  transformMethod,
  transformDay,
  transformProgramPrompt,
  transformExperienceLevel,
  transformOvertuiging,
  transformMindsetCategory
} from "./field-mappings.js"
import {
  listAllMethods,
  listAllGoals,
  listAllDays,
  listAllMindsetCategories,
  listAllOvertuigingen,
  listAllProgramPrompts,
  listAllExperienceLevels,
  lookupGoalsByIds
} from "./repos/reference-repo.js"
import type { AirtableRecord } from "./types.js"
import type { AIMethod, AIOvertuiging } from "./openai.js"

export interface ProgramGenerationData {
  goals: Record<string, unknown>[]
  programPrompts: Array<{ goalIds: string[]; prompt: string }>
  systemPrompts: Map<string, string>
  methods: AIMethod[]
  rawMethods: Record<string, unknown>[]
  days: Array<{ id: string; name: string }>
  aiOvertuigingen: AIOvertuiging[]
  allOvertuigingen: Array<{ id: string; name: string; categoryIds: string[]; order: number; levels: string[] }>
  experienceLevelMap: Map<string, string>
}

export async function loadProgramGenerationData(input: {
  goalIds: string[]
  dayIds: string[]
}): Promise<ProgramGenerationData> {
  if (isPostgresConfigured()) {
    try {
      return await loadFromPostgres(input)
    } catch (error) {
      console.warn("[program-generation] Postgres load failed, falling back to Airtable:", error instanceof Error ? error.message : error)
    }
  }
  return loadFromAirtable(input)
}

async function loadFromPostgres(input: {
  goalIds: string[]
  dayIds: string[]
}): Promise<ProgramGenerationData> {
  const [allGoals, allPrompts, allExperienceLevels, allMethods, allDays, allCategories, allOvertuigingen] = await Promise.all([
    lookupGoalsByIds(input.goalIds),
    listAllProgramPrompts(),
    listAllExperienceLevels(),
    listAllMethods(),
    listAllDays(),
    listAllMindsetCategories(),
    listAllOvertuigingen()
  ])

  return processReferenceData({
    goals: allGoals,
    allPrompts,
    allExperienceLevels,
    allMethods,
    allDays,
    allCategories,
    allOvertuigingen: allOvertuigingen as Array<{ id: string; name: string; categoryIds: string[]; order: number; levels: string[] }>,
    goalIds: input.goalIds,
    dayIds: input.dayIds
  })
}

async function loadFromAirtable(input: {
  goalIds: string[]
  dayIds: string[]
}): Promise<ProgramGenerationData> {
  // Fetch goal details from Airtable
  const goalRecords = await base(tables.goals)
    .select({
      filterByFormula: `OR(${input.goalIds.map((id: string) => `RECORD_ID() = "${id}"`).join(",")})`,
      returnFieldsByFieldId: true
    })
    .all()
  const allGoals = goalRecords.map(record => transformGoal(record as AirtableRecord))

  // Fetch all program prompts
  const promptRecords = await base(tables.programPrompts)
    .select({ returnFieldsByFieldId: true })
    .all()
  const allPrompts = promptRecords.map(record => transformProgramPrompt(record as AirtableRecord))

  // Fetch experience levels
  const experienceLevelRecords = await base(tables.experienceLevels)
    .select({ returnFieldsByFieldId: true })
    .all()
  const allExperienceLevels = experienceLevelRecords.map(record => transformExperienceLevel(record as AirtableRecord))

  // Fetch all methods
  const methodRecords = await base(tables.methods)
    .select({ returnFieldsByFieldId: true })
    .all()
  const allMethods = methodRecords.map(record => transformMethod(record as AirtableRecord))

  // Fetch selected days
  const dayRecords = await base(tables.daysOfWeek)
    .select({
      filterByFormula: `OR(${input.dayIds.map((id: string) => `RECORD_ID() = "${id}"`).join(",")})`,
      returnFieldsByFieldId: true
    })
    .all()
  const allDays = dayRecords.map(record => transformDay(record as AirtableRecord))

  // Fetch mindset categories
  const categoryRecords = await base(tables.mindsetCategories)
    .select({ returnFieldsByFieldId: true })
    .all()
  const allCategories = categoryRecords.map(r => transformMindsetCategory(r as AirtableRecord))

  // Fetch overtuigingen linked to matching categories
  const matchingCategories = allCategories.filter(cat =>
    (cat.goalIds as string[]).some((gid: string) => input.goalIds.includes(gid))
  )
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
      .map(r => transformOvertuiging(r as AirtableRecord))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  return processReferenceData({
    goals: allGoals,
    allPrompts,
    allExperienceLevels,
    allMethods,
    allDays,
    allCategories,
    allOvertuigingen,
    goalIds: input.goalIds,
    dayIds: input.dayIds
  })
}

function processReferenceData(data: {
  goals: Record<string, unknown>[]
  allPrompts: Record<string, unknown>[]
  allExperienceLevels: Record<string, unknown>[]
  allMethods: Record<string, unknown>[]
  allDays: Record<string, unknown>[]
  allCategories: Record<string, unknown>[]
  allOvertuigingen: Array<{ id: string; name: string; categoryIds: string[]; order: number; levels: string[] }>
  goalIds: string[]
  dayIds: string[]
}): ProgramGenerationData {
  // Build experience level map
  const experienceLevelMap = new Map(
    data.allExperienceLevels.map(el => [el.id as string, el.name as string])
  )

  // Process system prompts and program prompts
  const systemPromptRecords = data.allPrompts.filter(p => p.promptType === "Systeem")
  const systemPrompts = new Map<string, string>()
  for (const sp of systemPromptRecords) {
    if (sp.name && sp.prompt) {
      systemPrompts.set(sp.name as string, sp.prompt as string)
    }
  }

  const programPrompts = data.allPrompts
    .filter(p => p.promptType === "Programmaopbouw" || !p.promptType)
    .filter(prompt => (prompt.goals as string[]).some((goalId: string) => data.goalIds.includes(goalId)))
    .map(prompt => ({
      goalIds: (prompt.goals as string[]).filter((goalId: string) => data.goalIds.includes(goalId)),
      prompt: prompt.prompt as string
    }))

  // Transform methods to AIMethod format
  const methods: AIMethod[] = data.allMethods.map(m => {
    const expLevelId = (m.experienceLevelIds as string[] | undefined)?.[0]
    const experienceLevel = expLevelId ? experienceLevelMap.get(expLevelId) : undefined
    const isRecommendedForGoals = (m.linkedGoalIds as string[] | undefined)?.some(
      (goalId: string) => data.goalIds.includes(goalId)
    ) || false

    return {
      id: m.id as string,
      name: m.name as string,
      duration: m.duration as number,
      description: m.description as string | undefined,
      optimalFrequency: (m.optimalFrequency as string[]) || [],
      experienceLevel,
      isRecommendedForGoals
    }
  })

  // Filter days to selected IDs (Postgres returns all, Airtable already filtered)
  const days = data.allDays
    .filter(d => data.dayIds.includes(d.id as string))
    .map(d => ({ id: d.id as string, name: d.name as string }))

  // Process overtuigingen
  const categoryNameMap = new Map(
    data.allCategories.map(c => [c.id as string, c.name as string])
  )

  // Determine matching categories for filtering overtuigingen
  const matchingCategoryIds = new Set(
    data.allCategories
      .filter(cat => (cat.goalIds as string[]).some((gid: string) => data.goalIds.includes(gid)))
      .map(c => c.id as string)
  )

  // Filter overtuigingen by matching categories and Niveau 1
  const filteredOvertuigingen = data.allOvertuigingen
    .filter(o => {
      const catIds = o.categoryIds || []
      return catIds.some(cid => matchingCategoryIds.has(cid))
    })
    .filter(o => o.levels.includes("Niveau 1"))

  const aiOvertuigingen: AIOvertuiging[] = filteredOvertuigingen.map(o => ({
    id: o.id,
    name: o.name,
    categoryName: (o.categoryIds?.[0] ? categoryNameMap.get(o.categoryIds[0]) : undefined) as string | undefined
  }))

  return {
    goals: data.goals,
    programPrompts,
    systemPrompts,
    methods,
    rawMethods: data.allMethods,
    days,
    aiOvertuigingen,
    allOvertuigingen: filteredOvertuigingen,
    experienceLevelMap
  }
}
