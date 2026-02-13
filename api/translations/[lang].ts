import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendError, sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { dbQuery, isPostgresConfigured } from "../_lib/db/client.js"

const SUPPORTED_LANGS = new Set(["nl", "fr", "en"])

type TranslationRow = {
  key: string
  nl: string
  value: string
}

function normalizeLang(input: unknown): string | null {
  if (typeof input !== "string") return null
  const normalized = input.toLowerCase()
  return SUPPORTED_LANGS.has(normalized) ? normalized : null
}

function normalizeMode(input: unknown): "keys" | "by-nl" | "full" {
  if (input === "by-nl") return "by-nl"
  if (input === "full") return "full"
  return "keys"
}

function mapRows(rows: TranslationRow[]) {
  const byKey: Record<string, string> = {}
  const byNl: Record<string, string> = {}

  for (const row of rows) {
    if (!row.key || !row.nl) continue
    byKey[row.key] = row.value
    if (!byNl[row.nl]) byNl[row.nl] = row.value
  }

  return { byKey, byNl }
}

async function loadTranslationsFromPostgres(lang: string): Promise<TranslationRow[]> {
  const valueSql =
    lang === "nl"
      ? "nl"
      : `COALESCE(NULLIF(${lang}, ''), nl)`

  const result = await dbQuery<{ key: string; nl: string; value: string }>(
    `SELECT key, nl, ${valueSql} AS value
     FROM translations_pg
     WHERE key IS NOT NULL AND key <> ''
       AND nl IS NOT NULL AND nl <> ''
     ORDER BY key ASC`
  )

  return result.rows.map((row) => ({
    key: String(row.key),
    nl: String(row.nl),
    value: String(row.value || "")
  }))
}

async function loadTranslationsFromAirtable(lang: string): Promise<TranslationRow[]> {
  const records = await base(tables.translations).select({}).all()
  const out: TranslationRow[] = []

  for (const record of records) {
    const fields = (record.fields || {}) as Record<string, unknown>
    const key = fields.Key ? String(fields.Key) : ""
    const nl = fields.nl ? String(fields.nl) : ""
    if (!key || !nl) continue

    const rawValue =
      lang === "nl"
        ? nl
        : fields[lang]
          ? String(fields[lang])
          : nl

    out.push({
      key,
      nl,
      value: rawValue || nl
    })
  }

  return out
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const lang = normalizeLang(req.params.lang)
  if (!lang) {
    return sendError(res, "Unsupported language", 400)
  }

  const mode = normalizeMode(req.query.mode)

  try {
    let rows: TranslationRow[] = []

    if (isPostgresConfigured()) {
      try {
        rows = await loadTranslationsFromPostgres(lang)
      } catch (error) {
        console.warn("[translations] Postgres read failed, falling back to Airtable:", error)
      }
    }

    if (rows.length === 0) {
      rows = await loadTranslationsFromAirtable(lang)
    }

    const payload = mapRows(rows)
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")

    if (mode === "by-nl") {
      return sendSuccess(res, payload.byNl)
    }

    if (mode === "full") {
      return sendSuccess(res, payload)
    }

    return sendSuccess(res, payload.byKey)
  } catch (error) {
    return handleApiError(res, error)
  }
}
