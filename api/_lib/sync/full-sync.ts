import { base, tables } from "../airtable.js"
import { USER_FIELDS } from "../field-mappings.js"
import { dbQuery } from "../db/client.js"
import { upsertUserFromAirtable } from "../repos/user-repo.js"

// Track when the last full sync completed (for health endpoint)
let _lastFullPollSyncAt: string | null = null

export function getLastFullPollSyncAt(): string | null {
  return _lastFullPollSyncAt
}

interface FullSyncCounts {
  users: number
  referenceMethods: number
  referenceGoals: number
  referenceDays: number
  referenceCompanies: number
  translations: number
  referenceOvertuigingen: number
  referenceMindsetCategories: number
  referenceProgramPrompts: number
  referenceExperienceLevels: number
  referenceGoedeGewoontes: number
}

async function syncReferenceTable(
  tableId: string,
  targetTable: "reference_methods_pg" | "reference_goals_pg" | "reference_days_pg" | "reference_overtuigingen_pg" | "reference_mindset_categories_pg" | "reference_companies_pg" | "reference_program_prompts_pg" | "reference_experience_levels_pg" | "reference_goede_gewoontes_pg",
  viewName?: string
): Promise<number> {
  const selectOpts: Record<string, unknown> = { returnFieldsByFieldId: true }
  if (viewName) selectOpts.view = viewName
  const records = await base(tableId).select(selectOpts).all()
  const seenIds = new Set<string>()
  let count = 0
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    seenIds.add(record.id)
    const payload = { ...(record.fields || {}), _syncOrder: index }
    await dbQuery(
      `INSERT INTO ${targetTable} (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [record.id, JSON.stringify(payload)]
    )
    count += 1
  }

  // Delete records no longer in Airtable
  if (seenIds.size > 0) {
    await dbQuery(
      `DELETE FROM ${targetTable} WHERE id != ALL($1::text[])`,
      [[...seenIds]]
    )
  }

  return count
}

export async function syncReferenceDataFromAirtable(): Promise<{
  methods: number
  goals: number
  days: number
  companies: number
  overtuigingen: number
  mindsetCategories: number
  programPrompts: number
  experienceLevels: number
  goedeGewoontes: number
}> {
  const methods = await syncReferenceTable(tables.methods, "reference_methods_pg", "App")
  const goals = await syncReferenceTable(tables.goals, "reference_goals_pg", "App")
  const days = await syncReferenceTable(tables.daysOfWeek, "reference_days_pg")
  const companies = await syncReferenceTable(tables.companies, "reference_companies_pg")
  const overtuigingen = await syncReferenceTable(tables.overtuigingen, "reference_overtuigingen_pg", "App")
  const mindsetCategories = await syncReferenceTable(tables.mindsetCategories, "reference_mindset_categories_pg")
  const programPrompts = await syncReferenceTable(tables.programPrompts, "reference_program_prompts_pg")
  const experienceLevels = await syncReferenceTable(tables.experienceLevels, "reference_experience_levels_pg")
  const goedeGewoontes = await syncReferenceTable(tables.goedeGewoontes, "reference_goede_gewoontes_pg", "App")
  return { methods, goals, days, companies, overtuigingen, mindsetCategories, programPrompts, experienceLevels, goedeGewoontes }
}

export async function syncTranslationsFromAirtable(): Promise<number> {
  const exists = await dbQuery<{ table_name: string | null }>(
    `SELECT to_regclass('public.translations_pg') AS table_name`
  )
  if (!exists.rows[0]?.table_name) {
    return 0
  }

  const records = await base(tables.translations).select({}).all()
  const seenAirtableIds = new Set<string>()
  let count = 0

  for (const record of records) {
    const fields = (record.fields || {}) as Record<string, unknown>
    const key = fields.Key ? String(fields.Key).trim() : ""
    if (!key) continue

    await dbQuery(
      `INSERT INTO translations_pg (key, nl, fr, en, context, airtable_record_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (key)
       DO UPDATE SET
         nl = EXCLUDED.nl,
         fr = EXCLUDED.fr,
         en = EXCLUDED.en,
         context = EXCLUDED.context,
         airtable_record_id = EXCLUDED.airtable_record_id,
         updated_at = NOW()`,
      [
        key,
        fields.nl ? String(fields.nl) : "",
        fields.fr ? String(fields.fr) : null,
        fields.en ? String(fields.en) : null,
        fields.Context ? String(fields.Context) : null,
        record.id
      ]
    )

    seenAirtableIds.add(record.id)
    count += 1
  }

  // Delete rows whose Airtable record no longer exists (only rows that came from Airtable)
  if (seenAirtableIds.size > 0) {
    await dbQuery(
      `DELETE FROM translations_pg WHERE airtable_record_id IS NOT NULL AND airtable_record_id != ALL($1::text[])`,
      [[...seenAirtableIds]]
    )
  }

  return count
}

export async function syncUsersFromAirtable(): Promise<number> {
  const records = await base(tables.users).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    await upsertUserFromAirtable({
      id: record.id,
      name: String(record.fields[USER_FIELDS.name] || ""),
      email: String(record.fields[USER_FIELDS.email] || ""),
      role: record.fields[USER_FIELDS.role] ? String(record.fields[USER_FIELDS.role]) : null,
      languageCode: record.fields[USER_FIELDS.languageCode] ? String(record.fields[USER_FIELDS.languageCode]) : null,
      passwordHash: record.fields[USER_FIELDS.passwordHash] ? String(record.fields[USER_FIELDS.passwordHash]) : null,
      lastLogin: record.fields[USER_FIELDS.lastLogin] ? String(record.fields[USER_FIELDS.lastLogin]) : null,
      bonusPoints: record.fields[USER_FIELDS.bonusPoints] ? Number(record.fields[USER_FIELDS.bonusPoints]) : null,
      badges: record.fields[USER_FIELDS.badges] ? String(record.fields[USER_FIELDS.badges]) : null,
      level: record.fields[USER_FIELDS.level] ? Number(record.fields[USER_FIELDS.level]) : null
    })
    count += 1
  }
  return count
}

export async function runFullAirtableToPostgresSync(): Promise<FullSyncCounts> {
  const users = await syncUsersFromAirtable()
  const refs = await syncReferenceDataFromAirtable()
  const translations = await syncTranslationsFromAirtable()

  _lastFullPollSyncAt = new Date().toISOString()

  return {
    users,
    referenceMethods: refs.methods,
    referenceGoals: refs.goals,
    referenceDays: refs.days,
    referenceCompanies: refs.companies,
    translations,
    referenceOvertuigingen: refs.overtuigingen,
    referenceMindsetCategories: refs.mindsetCategories,
    referenceProgramPrompts: refs.programPrompts,
    referenceExperienceLevels: refs.experienceLevels,
    referenceGoedeGewoontes: refs.goedeGewoontes,
  }
}
