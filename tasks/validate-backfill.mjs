import pg from "pg"
import dotenv from "dotenv"
import { resolve } from "path"
import Airtable from "airtable"

dotenv.config({ path: resolve(process.cwd(), ".env.local") })

const { Client } = pg

const TABLES = {
  users: { airtable: process.env.AIRTABLE_TABLE_USERS || "tbl6i8jw3DNSzcHgE", pg: "users_pg" },
  programs: { airtable: process.env.AIRTABLE_TABLE_PROGRAMS || "tblqW4xeCx1tprNgX", pg: "programs_pg" },
  programSchedule: { airtable: process.env.AIRTABLE_TABLE_PROGRAMMAPLANNING || "tbl2PHUaonvs1MYRx", pg: "program_schedule_pg" },
  methodUsage: { airtable: process.env.AIRTABLE_TABLE_METHOD_USAGE || "tblktNOXF3yPPavXU", pg: "method_usage_pg" },
  habitUsage: { airtable: process.env.AIRTABLE_TABLE_HABIT_USAGE || "tblpWiRiseAZ7jfHm", pg: "habit_usage_pg" },
  personalGoalUsage: { airtable: process.env.AIRTABLE_TABLE_PERSONAL_GOAL_USAGE || "tbl8eJeQtMnIF5EJo", pg: "personal_goal_usage_pg" },
  overtuigingUsage: { airtable: process.env.AIRTABLE_TABLE_OVERTUIGINGEN_GEBRUIK || "tblsPtnIlTezVacxv", pg: "overtuiging_usage_pg" }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is required")
  }

  const airtableToken = process.env.AIRTABLE_ACCESS_TOKEN
  const airtableBaseId = process.env.AIRTABLE_BASE_ID
  if (!airtableToken || !airtableBaseId) {
    throw new Error("AIRTABLE_ACCESS_TOKEN and AIRTABLE_BASE_ID are required")
  }

  Airtable.configure({ apiKey: airtableToken })
  const base = Airtable.base(airtableBaseId)

  const client = new Client({
    connectionString,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()

  console.log("\n=== Backfill Validation Report ===\n")

  let hasDiscrepancy = false

  for (const [name, config] of Object.entries(TABLES)) {
    try {
      // Count Airtable records
      const airtableRecords = await base(config.airtable).select().all()
      const airtableCount = airtableRecords.length

      // Count Postgres rows
      const pgResult = await client.query(`SELECT COUNT(*) as count FROM ${config.pg}`)
      const pgCount = Number(pgResult.rows[0].count)

      const diff = airtableCount - pgCount
      const status = diff === 0 ? "OK" : "MISMATCH"
      const icon = diff === 0 ? "+" : "!"

      console.log(`[${icon}] ${name.padEnd(20)} Airtable: ${String(airtableCount).padStart(5)}  Postgres: ${String(pgCount).padStart(5)}  Diff: ${String(diff).padStart(4)}  ${status}`)

      if (diff !== 0) hasDiscrepancy = true
    } catch (err) {
      console.log(`[!] ${name.padEnd(20)} ERROR: ${err.message}`)
      hasDiscrepancy = true
    }
  }

  console.log("\n" + (hasDiscrepancy ? "Discrepancies found." : "All tables in sync.") + "\n")

  await client.end()
  process.exit(hasDiscrepancy ? 1 : 0)
}

main().catch((error) => {
  console.error("[validate:backfill] failed:", error)
  process.exit(1)
})
