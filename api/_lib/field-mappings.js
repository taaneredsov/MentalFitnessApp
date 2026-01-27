/**
 * Airtable Field ID Mappings
 *
 * Using field IDs instead of names ensures stability when field names
 * are changed by non-technical users in Airtable.
 *
 * NOTE: filterByFormula requires field NAMES (Airtable limitation).
 * Use FIELD_NAMES for formulas, USER_FIELDS/COMPANY_FIELDS for reading/writing.
 *
 * To find field IDs: Airtable API > Meta > Get base schema
 */

/**
 * Escape a value for use in Airtable filterByFormula to prevent injection attacks.
 * Escapes backslashes and double quotes which could break out of string literals.
 * @param {string} value - The user-provided value to escape
 * @returns {string} - The escaped value safe for use in formulas
 */
export function escapeFormulaValue(value) {
  if (typeof value !== 'string') return value
  // Escape backslashes first, then double quotes
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Validate that a string looks like an Airtable record ID.
 * Record IDs follow the pattern: rec[A-Za-z0-9]{14}
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid record ID format
 */
export function isValidRecordId(id) {
  if (typeof id !== 'string') return false
  return /^rec[A-Za-z0-9]{14}$/.test(id)
}

// Table IDs (fallback to hardcoded IDs if env vars not set)
export const TABLES = {
  companies: process.env.AIRTABLE_TABLE_COMPANIES || "tblUIwqUiARc2VZPU",      // Bedrijven
  users: process.env.AIRTABLE_TABLE_USERS || "tbl6i8jw3DNSzcHgE",              // Gebruikers
  methods: process.env.AIRTABLE_TABLE_METHODS || "tblB0QvbGg3zWARt4",          // Methodes
  goals: process.env.AIRTABLE_TABLE_GOALS || "tbl6ngkyNrv0LFzGb",              // Doelstellingen
  measurements: process.env.AIRTABLE_TABLE_MEASUREMENTS || "tblNPRorF4HnosENA", // Metingen
  programs: process.env.AIRTABLE_TABLE_PROGRAMS || "tblqW4xeCx1tprNgX",        // Mentale Fitnessprogramma's
  methodUsage: process.env.AIRTABLE_TABLE_METHOD_USAGE || "tblktNOXF3yPPavXU", // Methodegebruik
  content: process.env.AIRTABLE_TABLE_CONTENT || "tblrGcoPeuqTiXOcM",          // Content
  media: process.env.AIRTABLE_TABLE_MEDIA || "tblwzDUwtnhFKw4kA",              // Media
  daysOfWeek: process.env.AIRTABLE_TABLE_DAYS_OF_WEEK || "tblS3gleG8cSlWOJ3",  // Dagen van de week
  programPrompts: process.env.AIRTABLE_TABLE_PROGRAM_PROMPTS || "tblHmI6cSujof3KHu", // Programma opbouw prompts
  programmaplanning: process.env.AIRTABLE_TABLE_PROGRAMMAPLANNING || "tbl2PHUaonvs1MYRx", // Programmaplanning
  experienceLevels: process.env.AIRTABLE_TABLE_EXPERIENCE_LEVELS || "tblt5lzx2Msw1aKxv",  // Ervaringsniveaus
  habitUsage: process.env.AIRTABLE_TABLE_HABIT_USAGE || "tblpWiRiseAZ7jfHm"   // Gewoontegebruik
}

// User table field IDs (Gebruikers) - use for reading/writing
export const USER_FIELDS = {
  name: "fldIK4uXpJluMZwEg",           // Naam
  email: "fldybwT82FkYEDN2j",          // E-mailadres
  passwordHash: "fldjzJzy8mvpU39Jz",   // Paswoord Hash
  createdAt: "fldGQhjGFIdZMY5Xj",      // Aangemaakt op (computed)
  lastLogin: "fldMlP3KCqMwJeXbN",      // Laatste login
  company: "fldnaYqcZHVHpH1RT",        // Bedrijf (linked)
  role: "fldu0CiOBgfDlZ7HI",           // Rol
  languageCode: "fldMQEv7JI5PjNeyk",   // Taalcode
  profilePhoto: "fldqdOOgdgZUla8Ub",   // Profielfoto
  // Reward system fields
  totalPoints: "fldRcrVTHrvSUe1Mh",      // Totaal Punten (Formula - calculated)
  bonusPoints: "fldnTqsjBrzV37WPG",      // Bonus Punten (Number - milestones, streaks)
  currentStreak: "fldDsfIZH929xN30H",    // Huidige Streak (Number)
  longestStreak: "fldUI14lfcoJAI329",    // Langste Streak (Number)
  lastActiveDate: "fldwl4wC7pT4hKZVN",   // Laatste Actieve Dag (Date)
  badges: "fldMbIUw4uzjNKYy9",           // Badges (Long text - JSON array)
  level: "fldBp9BHyhbiGxK8V",            // Niveau (Number)
  // Magic link fields
  magicLinkToken: "fldjMwmUXqn0AmmXB",   // Magic Link Token (Single line text)
  magicLinkCode: "fldQxk69kS7coP4Ih",    // Magic Link Code (Single line text)
  magicLinkExpiry: "fld44oMkQTlsuLxVq"   // Magic Link Expiry (Single line text - ISO timestamp)
}

// Company table field IDs (Bedrijven) - use for reading/writing
export const COMPANY_FIELDS = {
  name: "fldvltZfImwnHz66Y",           // Bedrijfsnaam
  logo: "fldKhdqSKt4L8h0Hx",           // Logo
  address: "fldWN5s9N1bT0FvrL",        // Adres
  city: "fldaA1Uxe1df9veG2",           // Plaats
  country: "fldSzDZt7QxG9LZic",        // Land
  users: "fld0BkgcnerJUMfc5"           // Gebruikers (linked)
}

// Programs table field IDs (Mentale Fitnessprogramma's)
export const PROGRAM_FIELDS = {
  id: "fldzeEtEfVRM3qXzp",              // ID (AutoNumber)
  programId: "fldKHAHbREuKbbi1N",       // Programma ID (Formula - display name)
  user: "fldDc1mJUjBl2y7Hy",            // Gebruiker (Link)
  startDate: "fldY5UGS0XSd1eUxu",       // Startdatum
  duration: "fld3mrRTtqPX2a1fX",        // Duur van programma
  endDate: "fld2zTiRAKOXTenP4",         // Einddatum Programma (Formula)
  daysOfWeek: "fldC9mH8v5UjLSPVU",      // Dagen van de week (Link)
  frequency: "fldIGX4ZfG9LyYgMt",       // Frequentie per week (Count)
  goals: "fldo1Lc26dqEkUkwU",           // Doelstellingen (Link)
  methods: "fldvcpSF78ATEk12U",         // Mentale methode (Link)
  notes: "fldAUf1ENHtF8NRPl",           // Notities
  methodUsage: "fldXNUYtU4KG84ZMX",     // Methodegebruik (Link)
  milestonesAwarded: "fldQu0mHYeNj4mury" // Behaalde Mijlpalen (Long text - JSON array)
}

// Goals table field IDs (Doelstellingen)
export const GOAL_FIELDS = {
  name: "fldgLmhiCydWQgjUi",             // Doelstelling Naam
  description: "fldb1q8hRJyfFglYV",      // Beschrijving
  status: "fldjVOkLDqCsAdvft",           // Status (Actief/Afgerond/Gepland)
  methods: "fldZM72fiIX2SA4Cl",          // Methodes (Link)
  user: "fld7SlWpDzIhxzW5A",             // Gebruiker (Link)
  programs: "fldHVkXMs8gQkpbr5"          // Mentale Fitnessprogramma's (Link)
}

// Methods table field IDs (Methodes)
export const METHOD_FIELDS = {
  name: "fldXP3qNngK3oXEjR",             // Methode Naam
  duration: "fldg3pJ3mtwBTVtd8",         // Duur (minuten)
  description: "fldW7tdp7AJoeKerd",      // Beschrijving
  experienceLevel: "fldKppvap3PVPlMq8",  // Ervaringsniveau (gekoppeld) - Link to Ervaringsniveaus
  optimalFrequency: "fldX9SfbkhYUuRC3T", // Optimale frequentie (multipleSelects)
  linkedGoals: "fldymisqDYdypLbUc",      // Doelstellingen (gekoppeld) - Link to Goals
  photo: "fldT64jU7CfcgTe0y",            // Foto
  media: "fldobaP1oS9uZKTh2",            // Media (Link to Media table)
  users: "fldizDnwdWMO7UfSz",            // Gebruikers (Link)
  programs: "fld36JCBhGcXYurrp"          // Mentale Fitnessprogramma's (Link)
}

// Experience Levels table field IDs (Ervaringsniveaus - tblt5lzx2Msw1aKxv)
export const EXPERIENCE_LEVEL_FIELDS = {
  name: "fldklaZeObmJ9ZNgq",              // Name (Beginner, Gevorderd, etc.)
  notes: "fldveMMaCFMTXmiUP",             // Notes (description)
  users: "fldYKpakL7EWq4FRD",             // Gebruikers (Link)
  methods: "fldNklNZgp7cLHo0x"            // Methodes (Link)
}

// Days of Week table field IDs (Dagen van de week)
export const DAY_FIELDS = {
  name: "fldj61ALcQp8OYO1u",             // Name (Maandag, Dinsdag, etc.)
  programs: "fldoml9PLaWNLT59y"          // Mentale Fitnessprogramma's (Link)
}

// Media table field IDs (Media - tblwzDUwtnhFKw4kA)
export const MEDIA_FIELDS = {
  filename: "fldJ2OY8jXdQQS3Vx",          // Bestandsnaam
  type: "fldsEJYb1olj2zQoj",              // Type (video/audio)
  file: "fld8BlErdZjq1yNkW"               // Bestand (attachment)
}

// Method Usage table field IDs (Methodegebruik - tblktNOXF3yPPavXU)
export const METHOD_USAGE_FIELDS = {
  name: "fldt25MnO1OilxFOF",              // Name (auto-generated)
  user: "fldlJtJOwZ4poOcoN",              // Gebruiker (link to Users)
  method: "fldPyWglLXgXVO0ru",            // Methode (link to Methods)
  methodName: "fld4YLJWrdwMvyrjx",        // Methode Naam (lookup)
  program: "fld18WcaPR8nXNr4a",           // Mentale Fitnessprogramma's (link to Programs) - DEPRECATED
  programmaplanning: "fldVyFTiTqVZ3BVoH", // Programmaplanning (link to Programmaplanning)
  usedAt: "fldvUGcgnwuux1bvi",            // Gebruikt op (date)
  remark: "fldpskQnKFWDFGRFk",            // Opmerking (multiline text)
  goals: "fldYrzWJeMcyf4kNi"              // Doelstellingen (link to Goals)
}

// Program Prompts table field IDs (Programma opbouw prompts - tblHmI6cSujof3KHu)
export const PROGRAM_PROMPT_FIELDS = {
  name: "fld54jyMhPH0Cesl7",              // Name
  goals: "fldDo7u9EeWNyXENj",             // Doelstellingen (link to Goals)
  prompt: "fld7nmlwZoO2QFqMj",            // Prompt (multiline text)
  promptType: "fldDawVqkN23XSfve"         // Type prompt (Systeem/Programmaopbouw)
}

// Programmaplanning table field IDs (Programmaplanning - tbl2PHUaonvs1MYRx)
export const PROGRAMMAPLANNING_FIELDS = {
  planningId: "fldufZbBLil7jDKnj",         // Planning ID (singleLineText)
  program: "fldTPzVYhmSBxYRa3",            // Mentale Fitnessprogramma (link to Programs)
  date: "fldvqnZDdjaVxB25H",               // Datum (date)
  dayOfWeek: "fldxC8uxRqMdS7InU",          // Dag van de week (link to Days)
  sessionDescription: "fldnY9fKqbItJVxel", // Beschrijving van sessie(s) (multilineText)
  startTime: "fldZmLFDUenghweym",          // Begintijd (dateTime)
  endTime: "fld5pBFBsGFb6xuvE",            // Eindtijd (dateTime)
  methods: "fldxQn8r2ySIFs4pg",            // Beoogde methodes (link to Methods)
  goals: "fld2Xyx6dzgSMR7Yy",              // Doelstelling(en) (link to Goals)
  methodUsage: "fldoxGlLYZ5NI60hl",        // Methodegebruik (link to Method Usage)
  notes: "fld28cHcjefZFQr9P"               // Opmerkingen (multilineText)
}

// Habit Usage table field IDs (Gewoontegebruik - tblpWiRiseAZ7jfHm)
export const HABIT_USAGE_FIELDS = {
  user: "fld0kGrTAfzCg35Zb",       // Gebruikers (link to Users)
  method: "fldXY6F1q5UM4e148",     // Methodes (link to Methods)
  date: "fldL34wbT2NxYPUKh"        // Datum (date YYYY-MM-DD)
}

// Field NAMES for use in filterByFormula (Airtable requires names, not IDs)
export const FIELD_NAMES = {
  user: {
    name: "Naam",
    email: "E-mailadres",
    passwordHash: "Paswoord Hash",
    createdAt: "Aangemaakt op",
    lastLogin: "Laatste login",
    company: "Bedrijf",
    role: "Rol",
    languageCode: "Taalcode",
    profilePhoto: "Profielfoto",
    // Reward fields
    totalPoints: "Totaal Punten",
    currentStreak: "Huidige Streak",
    longestStreak: "Langste Streak",
    lastActiveDate: "Laatste Actieve Dag",
    badges: "Badges",
    level: "Niveau",
    // Magic link fields
    magicLinkToken: "Magic Link Token",
    magicLinkCode: "Magic Link Code",
    magicLinkExpiry: "Magic Link Expiry"
  },
  habitUsage: {
    user: "Gebruikers",
    method: "Methodes",
    date: "Datum"
  },
  company: {
    name: "Bedrijfsnaam",
    logo: "Logo",
    address: "Adres",
    city: "Plaats",
    country: "Land",
    users: "Gebruikers"
  },
  program: {
    user: "Gebruiker",
    startDate: "Startdatum",
    duration: "Duur van programma",
    endDate: "Einddatum Programma",
    daysOfWeek: "Dagen van de week",
    frequency: "Frequentie per week",
    goals: "Doelstellingen",
    methods: "Mentale methode",
    notes: "Notities"
  },
  goal: {
    name: "Doelstelling Naam",
    description: "Beschrijving",
    status: "Status"
  },
  method: {
    name: "Methode Naam",
    duration: "Duur (minuten)",
    description: "Beschrijving",
    optimalFrequency: "Optimale frequentie"
  },
  day: {
    name: "Name"
  },
  programmaplanning: {
    planningId: "Planning ID",
    program: "Mentale Fitnessprogramma",
    date: "Datum",
    dayOfWeek: "Dag van de week",
    sessionDescription: "Beschrijving van sessie(s)",
    methods: "Beoogde methodes",
    goals: "Doelstelling(en)",
    notes: "Opmerkingen"
  }
}

/**
 * Transform Airtable user record to clean User object
 */
export function transformUser(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[USER_FIELDS.name],
    email: fields[USER_FIELDS.email],
    company: fields[USER_FIELDS.company],
    role: fields[USER_FIELDS.role],
    languageCode: fields[USER_FIELDS.languageCode],
    profilePhoto: fields[USER_FIELDS.profilePhoto]?.[0]?.url,
    createdAt: fields[USER_FIELDS.createdAt],
    lastLogin: fields[USER_FIELDS.lastLogin]
  }
}

/**
 * Transform Airtable company record to clean Company object
 */
export function transformCompany(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[COMPANY_FIELDS.name],
    logo: fields[COMPANY_FIELDS.logo]?.[0]?.url,
    address: fields[COMPANY_FIELDS.address],
    city: fields[COMPANY_FIELDS.city],
    country: fields[COMPANY_FIELDS.country]
  }
}

/**
 * Convert DD/MM/YYYY to ISO format YYYY-MM-DD
 * Airtable formula fields may return dates in European format
 */
function parseEuropeanDate(dateStr) {
  if (!dateStr) return null
  // If already in ISO format (YYYY-MM-DD), return as-is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr
  // Parse DD/MM/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return dateStr
}

/**
 * Transform Airtable program record to clean Program object
 */
export function transformProgram(record) {
  const fields = record.fields

  // Parse milestones from JSON string (or default to empty array)
  let milestonesAwarded = []
  const milestonesField = fields[PROGRAM_FIELDS.milestonesAwarded]
  if (milestonesField) {
    try {
      milestonesAwarded = typeof milestonesField === 'string' ? JSON.parse(milestonesField) : milestonesField
    } catch {
      milestonesAwarded = []
    }
  }

  return {
    id: record.id,
    name: fields[PROGRAM_FIELDS.programId],  // Programma ID formula field as display name
    startDate: fields[PROGRAM_FIELDS.startDate],
    endDate: parseEuropeanDate(fields[PROGRAM_FIELDS.endDate]),
    duration: fields[PROGRAM_FIELDS.duration],
    daysOfWeek: fields[PROGRAM_FIELDS.daysOfWeek] || [],
    frequency: fields[PROGRAM_FIELDS.frequency] || 0,
    goals: fields[PROGRAM_FIELDS.goals] || [],
    methods: fields[PROGRAM_FIELDS.methods] || [],
    notes: fields[PROGRAM_FIELDS.notes],
    methodUsageCount: (fields[PROGRAM_FIELDS.methodUsage] || []).length,
    milestonesAwarded
  }
}

/**
 * Transform Airtable goal record to clean Goal object
 */
export function transformGoal(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[GOAL_FIELDS.name],
    description: fields[GOAL_FIELDS.description],
    status: fields[GOAL_FIELDS.status]
  }
}

/**
 * Transform Airtable method record to clean Method object
 */
export function transformMethod(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[METHOD_FIELDS.name],
    duration: fields[METHOD_FIELDS.duration] || 0,
    description: fields[METHOD_FIELDS.description],
    experienceLevelIds: fields[METHOD_FIELDS.experienceLevel] || [],  // Linked record IDs to Ervaringsniveaus
    optimalFrequency: fields[METHOD_FIELDS.optimalFrequency] || [],   // Array of frequency options
    linkedGoalIds: fields[METHOD_FIELDS.linkedGoals] || [],           // Linked record IDs to Goals
    photo: fields[METHOD_FIELDS.photo]?.[0]?.thumbnails?.large?.url || fields[METHOD_FIELDS.photo]?.[0]?.url,
    media: fields[METHOD_FIELDS.media] || []  // Linked record IDs to Media table
  }
}

/**
 * Transform Airtable experience level record to clean ExperienceLevel object
 */
export function transformExperienceLevel(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[EXPERIENCE_LEVEL_FIELDS.name],
    notes: fields[EXPERIENCE_LEVEL_FIELDS.notes]
  }
}

/**
 * Transform Airtable media record to clean Media object
 */
export function transformMedia(record) {
  const fields = record.fields
  const file = fields[MEDIA_FIELDS.file]?.[0]

  return {
    id: record.id,
    filename: fields[MEDIA_FIELDS.filename],
    type: fields[MEDIA_FIELDS.type],  // "video" or "audio"
    url: file?.url
  }
}

/**
 * Transform Airtable day record to clean Day object
 */
export function transformDay(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[DAY_FIELDS.name]
  }
}

/**
 * Transform Airtable method usage record to clean MethodUsage object
 */
export function transformMethodUsage(record) {
  const fields = record.fields
  return {
    id: record.id,
    userId: fields[METHOD_USAGE_FIELDS.user]?.[0],
    methodId: fields[METHOD_USAGE_FIELDS.method]?.[0],
    methodName: fields[METHOD_USAGE_FIELDS.methodName]?.[0],
    programId: fields[METHOD_USAGE_FIELDS.program]?.[0],  // DEPRECATED - use programmaplanningId
    programmaplanningId: fields[METHOD_USAGE_FIELDS.programmaplanning]?.[0],
    usedAt: fields[METHOD_USAGE_FIELDS.usedAt],
    remark: fields[METHOD_USAGE_FIELDS.remark]
  }
}

/**
 * Transform Airtable program prompt record to clean ProgramPrompt object
 */
export function transformProgramPrompt(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[PROGRAM_PROMPT_FIELDS.name],
    prompt: fields[PROGRAM_PROMPT_FIELDS.prompt],
    goals: fields[PROGRAM_PROMPT_FIELDS.goals] || [],
    promptType: fields[PROGRAM_PROMPT_FIELDS.promptType]  // "Systeem" or "Programmaopbouw"
  }
}

/**
 * Transform Airtable programmaplanning record to clean Programmaplanning object
 */
export function transformProgrammaplanning(record) {
  const fields = record.fields
  const methodUsageIds = fields[PROGRAMMAPLANNING_FIELDS.methodUsage] || []
  return {
    id: record.id,
    planningId: fields[PROGRAMMAPLANNING_FIELDS.planningId],
    programId: fields[PROGRAMMAPLANNING_FIELDS.program]?.[0],
    date: fields[PROGRAMMAPLANNING_FIELDS.date],
    dayOfWeekId: fields[PROGRAMMAPLANNING_FIELDS.dayOfWeek]?.[0],
    sessionDescription: fields[PROGRAMMAPLANNING_FIELDS.sessionDescription],
    methodIds: fields[PROGRAMMAPLANNING_FIELDS.methods] || [],
    goalIds: fields[PROGRAMMAPLANNING_FIELDS.goals] || [],
    methodUsageIds: methodUsageIds,
    isCompleted: methodUsageIds.length > 0,  // Session is completed when it has at least one methodUsage
    notes: fields[PROGRAMMAPLANNING_FIELDS.notes]
  }
}

/**
 * Extract reward data from a user record
 */
export function transformUserRewards(record) {
  const fields = record.fields

  // Parse badges from JSON string (or default to empty array)
  let badges = []
  const badgesField = fields[USER_FIELDS.badges]
  if (badgesField) {
    try {
      badges = typeof badgesField === 'string' ? JSON.parse(badgesField) : badgesField
    } catch {
      badges = []
    }
  }

  return {
    totalPoints: fields[USER_FIELDS.totalPoints] || 0,
    bonusPoints: fields[USER_FIELDS.bonusPoints] || 0,
    currentStreak: fields[USER_FIELDS.currentStreak] || 0,
    longestStreak: fields[USER_FIELDS.longestStreak] || 0,
    lastActiveDate: fields[USER_FIELDS.lastActiveDate] || null,
    badges,
    level: fields[USER_FIELDS.level] || 1
  }
}

/**
 * Transform Airtable habit usage record to clean HabitUsage object
 */
export function transformHabitUsage(record) {
  const fields = record.fields
  return {
    id: record.id,
    userId: fields[HABIT_USAGE_FIELDS.user]?.[0],
    methodId: fields[HABIT_USAGE_FIELDS.method]?.[0],
    date: fields[HABIT_USAGE_FIELDS.date]
  }
}
