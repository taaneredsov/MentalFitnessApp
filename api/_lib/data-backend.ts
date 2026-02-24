export type DataBackendMode = "airtable_only" | "postgres_shadow_read" | "postgres_primary"

function readMode(raw: string | undefined): DataBackendMode {
  if (raw === "postgres_shadow_read" || raw === "postgres_primary") {
    return raw
  }
  return "airtable_only"
}

export function getDataBackendMode(envKey: string): DataBackendMode {
  return readMode(process.env[envKey])
}

export function isPostgresPrimary(envKey: string): boolean {
  return getDataBackendMode(envKey) === "postgres_primary"
}

export function isPostgresShadowRead(envKey: string): boolean {
  return getDataBackendMode(envKey) === "postgres_shadow_read"
}

export function readBooleanFlag(envKey: string, defaultValue = false): boolean {
  const raw = process.env[envKey]
  if (raw === undefined) return defaultValue
  return raw === "true" || raw === "1" || raw === "yes"
}

const DATA_BACKEND_KEYS = [
  "DATA_BACKEND_COMPANIES",
  "DATA_BACKEND_DAYS",
  "DATA_BACKEND_GOALS",
  "DATA_BACKEND_HABIT_USAGE",
  "DATA_BACKEND_METHOD_USAGE",
  "DATA_BACKEND_METHODS",
  "DATA_BACKEND_MINDSET_CATEGORIES",
  "DATA_BACKEND_OVERTUIGING_USAGE",
  "DATA_BACKEND_OVERTUIGINGEN",
  "DATA_BACKEND_PERSONAL_GOAL_USAGE",
  "DATA_BACKEND_PERSONAL_GOALS",
  "DATA_BACKEND_PERSOONLIJKE_OVERTUIGINGEN",
  "DATA_BACKEND_PROGRAMS",
  "DATA_BACKEND_REWARDS",
] as const

export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return
  if (!process.env.DATABASE_URL) return

  const warnings: string[] = []

  for (const key of DATA_BACKEND_KEYS) {
    const mode = getDataBackendMode(key)
    if (mode === "airtable_only") {
      const reason = process.env[key] ? `set to "airtable_only"` : "not set (defaults to airtable_only)"
      warnings.push(`  ${key}: ${reason}`)
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[config] DATABASE_URL is set but ${warnings.length} backend key(s) still resolve to airtable_only:\n${warnings.join("\n")}`
    )
  }
}

