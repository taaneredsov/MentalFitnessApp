import { withDbTransaction, dbQuery } from "../db/client.js"
import { enqueueSyncEvent } from "../sync/outbox.js"

interface CollectedIds {
  userId: string
  programIds: string[]
  personalGoalIds: string[]
  /** Airtable record IDs looked up from airtable_id_map */
  airtableProgramIds: string[]
  airtableGoalIds: string[]
}

interface NukeResult {
  postgres: {
    magicLinkCodes: number
    overtuigingUsage: number
    goedeGewoonteUsage: number
    persoonlijkeOvertuigingen: number
    userDeleted: boolean
    syncOutbox: number
    syncDeadLetter: number
    airtableIdMap: number
  }
  airtableEventsQueued: number
}

/**
 * Step 1: Pre-collect entity IDs that have Airtable counterparts.
 * Must run BEFORE any deletes.
 */
async function collectEntityIds(userId: string): Promise<CollectedIds> {
  const [programs, goals, atPrograms, atGoals] = await Promise.all([
    dbQuery<{ id: string }>("SELECT id FROM programs_pg WHERE user_id = $1", [userId]),
    dbQuery<{ id: string }>("SELECT id FROM personal_goals_pg WHERE user_id = $1", [userId]),
    dbQuery<{ airtable_record_id: string }>(
      "SELECT airtable_record_id FROM airtable_id_map WHERE entity_type = 'program' AND postgres_id = ANY(SELECT id::text FROM programs_pg WHERE user_id = $1)",
      [userId]
    ),
    dbQuery<{ airtable_record_id: string }>(
      "SELECT airtable_record_id FROM airtable_id_map WHERE entity_type = 'personal_goal' AND postgres_id = ANY(SELECT id::text FROM personal_goals_pg WHERE user_id = $1)",
      [userId]
    ),
  ])

  return {
    userId,
    programIds: programs.rows.map((r) => r.id),
    personalGoalIds: goals.rows.map((r) => r.id),
    airtableProgramIds: atPrograms.rows.map((r) => r.airtable_record_id),
    airtableGoalIds: atGoals.rows.map((r) => r.airtable_record_id),
  }
}

/**
 * Delete all user data from Postgres in a single transaction,
 * then enqueue Airtable delete events outside the transaction.
 */
export async function nukeUser(userId: string): Promise<NukeResult> {
  // Step 1: Collect IDs before deleting anything
  const ids = await collectEntityIds(userId)

  // All entity IDs for sync cleanup (user + programs + goals)
  const allEntityIds = [userId, ...ids.programIds, ...ids.personalGoalIds]

  // Steps 2-4: Single transaction for all Postgres deletes
  const postgres = await withDbTransaction(async (client) => {
    // Step 2: Manual deletes (tables without ON DELETE CASCADE from users_pg)
    const magicLinks = await client.query(
      "DELETE FROM magic_link_codes WHERE user_id = $1",
      [userId]
    )
    const overtuigingUsage = await client.query(
      "DELETE FROM overtuiging_usage_pg WHERE user_id = $1",
      [userId]
    )
    const goedeGewoonteUsage = await client.query(
      "DELETE FROM goede_gewoontes_usage_pg WHERE user_id = $1",
      [userId]
    )
    const persOvertuigingen = await client.query(
      "DELETE FROM persoonlijke_overtuigingen_pg WHERE user_id = $1",
      [userId]
    )

    // Step 3: Delete user row — CASCADE handles child tables
    const userResult = await client.query(
      "DELETE FROM users_pg WHERE id = $1",
      [userId]
    )

    // Step 4: Cleanup sync/mapping tables
    const outbox = await client.query(
      "DELETE FROM sync_outbox WHERE entity_id = ANY($1::text[])",
      [allEntityIds]
    )
    const deadLetter = await client.query(
      "DELETE FROM sync_dead_letter WHERE entity_id = ANY($1::text[])",
      [allEntityIds]
    )
    const idMap = await client.query(
      "DELETE FROM airtable_id_map WHERE postgres_id = ANY($1::text[])",
      [allEntityIds]
    )

    return {
      magicLinkCodes: magicLinks.rowCount ?? 0,
      overtuigingUsage: overtuigingUsage.rowCount ?? 0,
      goedeGewoonteUsage: goedeGewoonteUsage.rowCount ?? 0,
      persoonlijkeOvertuigingen: persOvertuigingen.rowCount ?? 0,
      userDeleted: (userResult.rowCount ?? 0) > 0,
      syncOutbox: outbox.rowCount ?? 0,
      syncDeadLetter: deadLetter.rowCount ?? 0,
      airtableIdMap: idMap.rowCount ?? 0,
    }
  })

  // Step 5: Enqueue Airtable deletes (outside transaction, fire-and-forget)
  let airtableEventsQueued = 0

  const enqueueOps: Array<{ entityType: "user" | "program" | "personal_goal"; entityId: string }> = []

  // User record
  enqueueOps.push({ entityType: "user", entityId: userId })

  // Programs — use Airtable record IDs if available, fall back to Postgres IDs
  for (const atId of ids.airtableProgramIds) {
    enqueueOps.push({ entityType: "program", entityId: atId })
  }

  // Personal goals — use Airtable record IDs if available, fall back to Postgres IDs
  for (const atId of ids.airtableGoalIds) {
    enqueueOps.push({ entityType: "personal_goal", entityId: atId })
  }

  for (const op of enqueueOps) {
    try {
      await enqueueSyncEvent({
        eventType: "delete",
        entityType: op.entityType,
        entityId: op.entityId,
        payload: { userId, reason: "user-nuke" },
        priority: 10,
      })
      airtableEventsQueued++
    } catch (error) {
      console.error(`[user-nuke] Failed to enqueue ${op.entityType} delete for ${op.entityId}:`, error)
    }
  }

  return { postgres, airtableEventsQueued }
}
