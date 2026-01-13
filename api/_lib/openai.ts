import OpenAI from "openai"

let _openai: OpenAI | null = null

/**
 * Get singleton OpenAI client instance
 */
export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required")
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

/**
 * Method assignment within a day's schedule
 */
export interface AIScheduleMethod {
  methodId: string
  methodName: string
  duration: number
  order: number
}

/**
 * A single day in the AI-generated schedule
 */
export interface AIScheduleDay {
  dayId: string
  dayName: string
  methods: AIScheduleMethod[]
}

/**
 * Complete response from AI program generation
 */
export interface AIProgramResponse {
  schedule: AIScheduleDay[]
  totalSessionTime: number
  weeklySessionTime: number
  recommendations: string[]
  notes?: string
}

/**
 * Input for building the AI prompt
 */
export interface AIPromptInput {
  goals: Array<{ id: string; name: string; description?: string }>
  prompts: Array<{ goalIds: string[]; prompt: string }>
  methods: Array<{ id: string; name: string; duration: number; description?: string }>
  days: Array<{ id: string; name: string }>
  duration: string
}

/**
 * Build the system prompt for GPT-4o
 */
export function buildSystemPrompt(input: AIPromptInput): string {
  const { goals, prompts, methods, days, duration } = input

  // Build goal descriptions
  const goalDescriptions = goals
    .map(g => `- ${g.name}${g.description ? `: ${g.description}` : ""}`)
    .join("\n")

  // Build prompt instructions per goal
  const promptInstructions = prompts
    .map(p => {
      const goalNames = goals
        .filter(g => p.goalIds.includes(g.id))
        .map(g => g.name)
        .join(", ")
      return `Voor ${goalNames}:\n${p.prompt}`
    })
    .join("\n\n")

  // Build available methods list
  const methodsList = methods
    .map(m => `- ID: "${m.id}", Naam: "${m.name}", Duur: ${m.duration} minuten${m.description ? `, Beschrijving: ${m.description}` : ""}`)
    .join("\n")

  // Build selected days list
  const daysList = days
    .map(d => `- ID: "${d.id}", Naam: "${d.name}"`)
    .join("\n")

  return `Je bent een expert in het samenstellen van mentale fitnessprogramma's. Je taak is om een gepersonaliseerd programma samen te stellen op basis van de geselecteerde doelstellingen en beschikbare dagen.

## Gebruiker's Doelstellingen:
${goalDescriptions}

## Instructies per Doelstelling:
${promptInstructions}

## Beschikbare Methodes:
${methodsList}

## Geselecteerde Dagen:
${daysList}

## Programma Duur:
${duration}

## Regels voor het Samenstellen:
1. Verdeel de methodes gelijkmatig over de geselecteerde dagen
2. Elke sessie moet tussen 15 en 30 minuten duren
3. Varieer de methodes gedurende de week - niet elke dag dezelfde
4. Bouw progressie op door te beginnen met eenvoudigere methodes
5. Houd rekening met de duur van elke methode
6. Gebruik ALLEEN de methode IDs uit de lijst hierboven
7. Elke methode in een dag moet een unieke "order" hebben (1, 2, 3, etc.)

## Output Formaat:
Retourneer een JSON object met exact dit formaat:
{
  "schedule": [
    {
      "dayId": "rec...",
      "dayName": "Maandag",
      "methods": [
        { "methodId": "rec...", "methodName": "Naam", "duration": 10, "order": 1 }
      ]
    }
  ],
  "totalSessionTime": 25,
  "weeklySessionTime": 75,
  "recommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "notes": "Optionele notities over het programma"
}

- totalSessionTime: gemiddelde tijd per sessie in minuten
- weeklySessionTime: totale tijd per week in minuten
- recommendations: 3-5 gepersonaliseerde tips in het Nederlands
- notes: optionele aanvullende notities`
}
