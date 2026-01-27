import fs from "fs"

/**
 * Get a secret value from either a file (Docker Swarm secrets) or environment variable
 * Priority: FILE env var > direct env var
 *
 * @param {string} name - The environment variable name (e.g., "AIRTABLE_ACCESS_TOKEN")
 * @returns {string | undefined} - The secret value
 */
export function getSecret(name) {
  // Check for file-based secret first (Docker Swarm pattern)
  const fileEnvName = `${name}_FILE`
  const filePath = process.env[fileEnvName]

  if (filePath) {
    try {
      const value = fs.readFileSync(filePath, "utf8").trim()
      return value
    } catch (error) {
      console.warn(`Warning: Could not read secret from ${filePath}:`, error.message)
    }
  }

  // Fall back to direct environment variable
  return process.env[name]
}

/**
 * Load all secrets and make them available as environment variables
 * Call this early in the application startup
 */
export function loadSecrets() {
  const secretNames = [
    "AIRTABLE_ACCESS_TOKEN",
    "AIRTABLE_BASE_ID",
    "JWT_SECRET",
    "OPENAI_API_KEY",
    "SMTP_SERVER",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM"
  ]

  for (const name of secretNames) {
    const value = getSecret(name)
    if (value && !process.env[name]) {
      process.env[name] = value
    }
  }
}
