#!/usr/bin/env node
import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const BASE_ID = process.env.AIRTABLE_BASE_ID
const TOKEN = process.env.AIRTABLE_ACCESS_TOKEN
const TABLE_NAME = "Vertalingen"
const SPEC_PATH = path.join("specs", "i18n-multilinguality", "phase-1.md")

if (!BASE_ID || !TOKEN) {
  console.error("Missing AIRTABLE_BASE_ID or AIRTABLE_ACCESS_TOKEN")
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
}

function extractPhase1Translations(markdown) {
  const rows = []
  const lines = markdown.split("\n")

  for (const lineRaw of lines) {
    const line = lineRaw.trim()
    if (!line.includes("→")) continue
    if (line.startsWith("|")) continue
    if (line.startsWith("```")) continue

    const match = line.match(/^([a-zA-Z0-9._-]+)\s+→\s+(.+)$/)
    if (!match) continue

    rows.push({
      key: match[1].trim(),
      nl: match[2].trim()
    })
  }

  const deduped = new Map()
  for (const row of rows) deduped.set(row.key, row.nl)
  return Array.from(deduped.entries()).map(([key, nl]) => ({ key, nl }))
}

async function airtableJson(url, options = {}) {
  const res = await fetch(url, options)
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${body}`)
  }
  return body ? JSON.parse(body) : {}
}

async function getOrCreateTable() {
  const meta = await airtableJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers
  })

  const existing = (meta.tables || []).find((t) => t.name === TABLE_NAME)
  if (existing) {
    return { id: existing.id, created: false }
  }

  const created = await airtableJson(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: TABLE_NAME,
      description: "i18n translation keys and values (Phase 1 seed).",
      fields: [
        { name: "Key", type: "singleLineText" },
        { name: "nl", type: "multilineText" },
        { name: "fr", type: "multilineText" },
        { name: "en", type: "multilineText" },
        { name: "Context", type: "singleLineText" }
      ]
    })
  })

  return { id: created.id, created: true }
}

async function upsertRows(tableId, rows) {
  const batchSize = 10
  let processed = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    await airtableJson(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Key"] },
        records: batch.map((row) => ({
          fields: {
            Key: row.key,
            nl: row.nl,
            fr: "",
            en: "",
            Context: "Phase 1 seed"
          }
        }))
      })
    })

    processed += batch.length
    process.stdout.write(`\rUpserted ${processed}/${rows.length}`)
    await new Promise((resolve) => setTimeout(resolve, 220))
  }
  process.stdout.write("\n")
}

async function main() {
  const spec = await fs.readFile(SPEC_PATH, "utf8")
  const rows = extractPhase1Translations(spec)

  if (rows.length === 0) {
    throw new Error(`No translation rows found in ${SPEC_PATH}`)
  }

  const { id: tableId, created } = await getOrCreateTable()
  console.log(`${created ? "Created" : "Using"} table ${TABLE_NAME} (${tableId})`)
  console.log(`Parsed ${rows.length} Phase 1 key/nl pairs from spec`)

  await upsertRows(tableId, rows)

  console.log("Done.")
  console.log(`Table ID: ${tableId}`)
  console.log("Note: fr/en were seeded as empty strings.")
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

