export function readBooleanFlag(envKey: string, defaultValue = false): boolean {
  const raw = process.env[envKey]
  if (raw === undefined) return defaultValue
  return raw === "true" || raw === "1" || raw === "yes"
}
