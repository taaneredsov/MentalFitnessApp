export const queryKeys = {
  // Reference data - long cache (30 minutes)
  goals: ["goals"] as const,
  methods: ["methods"] as const,
  method: (id: string) => ["methods", id] as const,
  days: ["days"] as const,
  companies: (ids: string[]) => ["companies", ...ids.sort()] as const,

  // User data - medium cache (5 minutes)
  programs: (userId: string) => ["programs", userId] as const,
  program: (id: string) => ["program", id] as const,

  // Dynamic data - short cache (1 minute)
  methodUsage: (programId: string) => ["methodUsage", programId] as const
}
