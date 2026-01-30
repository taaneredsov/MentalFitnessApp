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
}

/**
 * A single day in the AI-generated schedule (with specific date)
 */
export interface AIScheduleDay {
  date: string          // YYYY-MM-DD format
  dayOfWeek: string     // Dutch name (Maandag, etc.)
  dayId: string         // Airtable record ID
  methods: AIScheduleMethod[]
}

/**
 * Complete response from AI program generation
 */
export interface AIProgramResponse {
  schedule: AIScheduleDay[]
  weeklySessionTime: number
  recommendations: string[]
  programSummary: string
}

/**
 * Training date with day information
 */
export interface TrainingDate {
  date: string          // YYYY-MM-DD
  dayOfWeek: string     // Dutch name
  dayId: string         // Airtable record ID
}

/**
 * Method with frequency and experience information for AI
 */
export interface AIMethod {
  id: string
  name: string
  duration: number
  description?: string
  optimalFrequency: string[]
  experienceLevel?: string           // e.g., "Beginner", "Gevorderd"
  isRecommendedForGoals: boolean     // true if method is linked to selected goals
}

/**
 * Context for program edit/regeneration
 */
export interface EditContext {
  isEdit: boolean
  completedMethods: string[]      // Method IDs the user has already completed
  preservedSessionCount: number   // Number of past sessions being preserved
}

/**
 * Input for building the AI prompt
 */
export interface AIPromptInput {
  goals: Array<{ id: string; name: string; description?: string }>
  programPrompts: Array<{ goalIds: string[]; prompt: string }>  // Type: Programmaopbouw
  systemPrompts: Map<string, string>  // Type: Systeem, keyed by name
  methods: AIMethod[]
  trainingDates: TrainingDate[]
  duration: string
  editContext?: EditContext  // Optional context when regenerating an existing program
}

/**
 * OpenAI Structured Outputs JSON Schema for mental fitness program
 */
export const AI_PROGRAM_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "mental_fitness_program",
    strict: true,
    schema: {
      type: "object",
      properties: {
        schedule: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "Training date in YYYY-MM-DD format" },
              dayOfWeek: { type: "string", description: "Dutch day name (Maandag, Dinsdag, etc.)" },
              dayId: { type: "string", description: "Airtable record ID for the day" },
              methods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    methodId: { type: "string", description: "Airtable record ID for the method" },
                    methodName: { type: "string", description: "Name of the method" },
                    duration: { type: "number", description: "Duration in minutes" }
                  },
                  required: ["methodId", "methodName", "duration"],
                  additionalProperties: false
                }
              }
            },
            required: ["date", "dayOfWeek", "dayId", "methods"],
            additionalProperties: false
          }
        },
        weeklySessionTime: { type: "number", description: "Average weekly session time in minutes" },
        recommendations: {
          type: "array",
          items: { type: "string" },
          description: "3-5 personalized recommendations in Dutch"
        },
        programSummary: { type: "string", description: "Brief program summary in Dutch" }
      },
      required: ["schedule", "weeklySessionTime", "recommendations", "programSummary"],
      additionalProperties: false
    }
  }
}

// Default system prompts (used as fallbacks if not found in Airtable)
const DEFAULT_SYSTEM_PROMPTS = {
  intro: `Je bent een expert in het samenstellen van mentale fitnessprogramma's. Je taak is om een gepersonaliseerd programma samen te stellen voor ALLE opgegeven trainingsdatums.`,

  selectie_regels: `## Selectie Regels:
1. **PRIORITEIT**: Gebruik bij voorkeur methodes uit de "AANBEVOLEN" lijst - deze zijn specifiek gekoppeld aan de gekozen doelstellingen
2. **Niveau**: Houd rekening met het ervaringsniveau (Niveau) - begin met eenvoudigere methodes en bouw op
3. Methodes uit "Overige" mogen alleen gebruikt worden als aanvulling of als de aanbevolen methodes niet voldoende variatie bieden`,

  frequentie_regels: `## Frequentie Regels:
Houd rekening met de "Frequentie" van elke methode:
- "Dagelijks": Plan op ELKE trainingsdag
- "Wekelijks": Plan maximaal 1x per week
- "Meermaals per dag": Mag meerdere keren op dezelfde dag
- "Ad-hoc": Flexibel in te plannen waar passend
- Methodes zonder frequentie: Vrij in te delen, maar niet te vaak herhalen`,

  samenstelling_regels: `## Regels voor het Samenstellen:
1. Maak een planning voor ELKE datum in de trainingsdatums lijst
2. Elke sessie moet tussen 15 en 30 minuten duren
3. Respecteer de optimale frequentie van methodes
4. Bouw progressie op: begin met eenvoudigere methodes (Beginner niveau), verhoog geleidelijk naar Gevorderd
5. Varieer methodes waar mogelijk (binnen frequentieregels)
6. Gebruik ALLEEN de exacte methode IDs en dayIDs uit de lijsten hierboven
7. Kopieer de datum, dayOfWeek en dayId exact zoals opgegeven`,

  output_formaat: `## Output Formaat:
Retourneer een JSON object met exact deze structuur:
{
  "schedule": [
    {
      "date": "2026-01-20",
      "dayOfWeek": "Maandag",
      "dayId": "rec...",
      "methods": [
        { "methodId": "rec...", "methodName": "Naam", "duration": 10 }
      ]
    }
  ],
  "weeklySessionTime": 75,
  "recommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "programSummary": "Korte samenvatting van het programma"
}

- schedule: MOET een entry hebben voor ELKE trainingsdatum
- weeklySessionTime: gemiddelde totale tijd per week in minuten
- recommendations: 3-5 gepersonaliseerde tips in het Nederlands
- programSummary: korte samenvatting van het programma in het Nederlands`
}

/**
 * Get a system prompt by name, with fallback to default
 */
function getSystemPrompt(
  prompts: Map<string, string>,
  name: keyof typeof DEFAULT_SYSTEM_PROMPTS
): string {
  return prompts.get(name) || DEFAULT_SYSTEM_PROMPTS[name]
}

/**
 * Build the system prompt for GPT-4o with training dates and frequency rules
 */
export function buildSystemPrompt(input: AIPromptInput): string {
  const { goals, programPrompts, systemPrompts, methods, trainingDates, duration, editContext } = input

  // Get dynamic system prompts (with fallbacks)
  const introPrompt = getSystemPrompt(systemPrompts, "intro")
  const selectieRegels = getSystemPrompt(systemPrompts, "selectie_regels")
  const frequentieRegels = getSystemPrompt(systemPrompts, "frequentie_regels")
  const samenstellingRegels = getSystemPrompt(systemPrompts, "samenstelling_regels")
  const outputFormaat = getSystemPrompt(systemPrompts, "output_formaat")

  // Build goal descriptions
  const goalDescriptions = goals
    .map(g => `- ${g.name}${g.description ? `: ${g.description}` : ""}`)
    .join("\n")

  // Build prompt instructions per goal (from Programmaopbouw type prompts)
  const promptInstructions = programPrompts.length > 0
    ? programPrompts
        .map(p => {
          const goalNames = goals
            .filter(g => p.goalIds.includes(g.id))
            .map(g => g.name)
            .join(", ")
          return `Voor ${goalNames}:\n${p.prompt}`
        })
        .join("\n\n")
    : "Geen specifieke instructies beschikbaar."

  // Separate recommended methods (linked to goals) from other methods
  const recommendedMethods = methods.filter(m => m.isRecommendedForGoals)
  const otherMethods = methods.filter(m => !m.isRecommendedForGoals)

  // Build method entry with all relevant info
  const formatMethod = (m: AIMethod) => {
    const parts = [`ID: "${m.id}"`, `Naam: "${m.name}"`, `Duur: ${m.duration} minuten`]
    if (m.experienceLevel) parts.push(`Niveau: ${m.experienceLevel}`)
    if (m.optimalFrequency.length > 0) parts.push(`Frequentie: ${m.optimalFrequency.join(", ")}`)
    if (m.description) parts.push(`Beschrijving: ${m.description}`)
    return `- ${parts.join(", ")}`
  }

  const recommendedMethodsList = recommendedMethods.length > 0
    ? recommendedMethods.map(formatMethod).join("\n")
    : "Geen specifieke methodes gekoppeld aan deze doelstellingen."

  const otherMethodsList = otherMethods.length > 0
    ? otherMethods.map(formatMethod).join("\n")
    : ""

  // Build training dates list
  const trainingDatesList = trainingDates
    .map(d => `- Datum: "${d.date}", Dag: "${d.dayOfWeek}", DayID: "${d.dayId}"`)
    .join("\n")

  // Build edit context section if this is a program edit
  const editContextSection = editContext?.isEdit
    ? `
## PROGRAMMA AANPASSING:
Dit is een AANPASSING van een bestaand programma, GEEN nieuw programma.
- ${editContext.preservedSessionCount} eerdere sessies worden behouden
- De gebruiker heeft al ${editContext.completedMethods.length} methodes voltooid
- Bouw voort op de voortgang van de gebruiker
- Vermijd te veel herhaling van recent voltooide methodes
- Focus op progressie en nieuwe uitdagingen
`
    : ""

  return `${introPrompt}
${editContextSection}
## Gebruiker's Doelstellingen:
${goalDescriptions}

## Instructies per Doelstelling:
${promptInstructions}

## AANBEVOLEN Methodes (gekoppeld aan de doelstellingen - PRIORITEIT):
${recommendedMethodsList}
${otherMethodsList ? `
## Overige Beschikbare Methodes (kunnen aanvullend gebruikt worden):
${otherMethodsList}` : ""}

## Trainingsdatums (maak voor ELKE datum een planning):
${trainingDatesList}

## Programma Duur:
${duration}

${selectieRegels}

${frequentieRegels}

${samenstellingRegels}

${outputFormaat}`
}
