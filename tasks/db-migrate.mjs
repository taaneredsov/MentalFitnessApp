import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const { Client } = pg

// Load DATABASE_URL from Docker Swarm file secret if available
const dbUrlFile = process.env.DATABASE_URL_FILE
if (dbUrlFile && !process.env.DATABASE_URL) {
  try {
    const secretValue = await readFile(dbUrlFile, "utf8")
    process.env.DATABASE_URL = secretValue.trim()
  } catch {
    console.warn(`[db:migrate] Could not read DATABASE_URL from ${dbUrlFile}`)
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, "db", "migrations")

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(client) {
  const res = await client.query("SELECT id FROM schema_migrations")
  return new Set(res.rows.map((row) => row.id))
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is required")
  }

  const client = new Client({
    connectionString,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
  })

  await client.connect()

  try {
    await ensureMigrationsTable(client)
    const applied = await getAppliedMigrations(client)

    const entries = await readdir(migrationsDir)
    const files = entries.filter((f) => f.endsWith(".sql")).sort()

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[db:migrate] skip ${file}`)
        continue
      }

      console.log(`[db:migrate] applying ${file}`)
      const sql = await readFile(path.join(migrationsDir, file), "utf8")
      await client.query("BEGIN")
      await client.query(sql)
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file])
      await client.query("COMMIT")
      console.log(`[db:migrate] applied ${file}`)
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // Ignore rollback failure
    }
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("[db:migrate] failed:", error)
  process.exit(1)
})

