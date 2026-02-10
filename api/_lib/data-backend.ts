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

