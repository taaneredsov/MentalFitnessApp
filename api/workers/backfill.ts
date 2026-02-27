import { closeDbPool, isPostgresConfigured } from "../_lib/db/client.js"
import { runFullAirtableToPostgresSync } from "../_lib/sync/full-sync.js"
import { syncNotificationJobsForAllUsers } from "../_lib/notifications/planner.js"

async function main() {
  if (!isPostgresConfigured()) {
    throw new Error("DATABASE_URL is required for backfill")
  }

  console.log("[backfill] starting")
  const counts = await runFullAirtableToPostgresSync()
  console.log("[backfill] users:", counts.users)
  console.log("[backfill] reference methods:", counts.referenceMethods)
  console.log("[backfill] reference goals:", counts.referenceGoals)
  console.log("[backfill] reference days:", counts.referenceDays)
  console.log("[backfill] reference companies:", counts.referenceCompanies)
  console.log("[backfill] translations:", counts.translations)
  console.log("[backfill] reference overtuigingen:", counts.referenceOvertuigingen)
  console.log("[backfill] reference mindset categories:", counts.referenceMindsetCategories)
  console.log("[backfill] reference program prompts:", counts.referenceProgramPrompts)
  console.log("[backfill] reference experience levels:", counts.referenceExperienceLevels)
  console.log("[backfill] reference goede gewoontes:", counts.referenceGoedeGewoontes)
  const plannedUsers = await syncNotificationJobsForAllUsers()
  console.log("[backfill] notification planning users:", plannedUsers)
  console.log("[backfill] completed")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(async () => {
    await closeDbPool()
    process.exit(0)
  }).catch(async (error) => {
    console.error("[backfill] failed:", error)
    await closeDbPool()
    process.exit(1)
  })
}
