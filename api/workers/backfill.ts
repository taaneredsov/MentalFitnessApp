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
  console.log("[backfill] personal goals:", counts.personalGoals)
  console.log("[backfill] programs:", counts.programs)
  console.log("[backfill] schedules:", counts.schedules)
  console.log("[backfill] method usage:", counts.methodUsage)
  console.log("[backfill] habit usage:", counts.habitUsage)
  console.log("[backfill] personal goal usage:", counts.personalGoalUsage)
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
