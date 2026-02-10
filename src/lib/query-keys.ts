export const queryKeys = {
  // Reference data - long cache (30 minutes)
  goals: ["goals"] as const,
  methods: ["methods"] as const,
  method: (id: string) => ["methods", id] as const,
  habits: ["habits"] as const,
  days: ["days"] as const,
  companies: (ids: string[]) => ["companies", ...ids.sort()] as const,

  // User data - medium cache (5 minutes)
  programs: (userId: string) => ["programs", userId] as const,
  program: (id: string) => ["program", id] as const,

  // Personal goals - medium cache (5 minutes)
  personalGoals: (userId: string) => ["personalGoals", userId] as const,
  personalGoalUsage: (userId: string, date: string) => ["personalGoalUsage", userId, date] as const,

  // Overtuigingen - reference data
  overtuigingen: ["overtuigingen"] as const,
  mindsetCategories: ["mindsetCategories"] as const,
  overtuigingenByGoals: (goalIds: string[]) => ["overtuigingen", "byGoals", ...goalIds.sort()] as const,

  // Overtuigingen - user data
  overtuigingUsage: (programId: string) => ["overtuigingUsage", programId] as const,
  allOvertuigingUsage: ["allOvertuigingUsage"] as const,
  persoonlijkeOvertuigingen: (userId: string) => ["persoonlijkeOvertuigingen", userId] as const,

  // Rewards data - short cache (1 minute)
  rewards: ["rewards"] as const,
  habitUsage: (userId: string, date: string) => ["habitUsage", userId, date] as const,

  // Dynamic data - short cache (1 minute)
  methodUsage: (programId: string) => ["methodUsage", programId] as const,

  // Programmaplanning - for session editing
  programmaplanning: (programId: string, planningId: string) => ["programmaplanning", programId, planningId] as const
}
