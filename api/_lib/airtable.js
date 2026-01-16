import dotenv from "dotenv"
import { resolve } from "path"
import Airtable from "airtable"
import { TABLES } from "./field-mappings.js"
import { loadSecrets } from "./secrets.js"

// Load .env.local for local development
dotenv.config({ path: resolve(process.cwd(), ".env.local") })

// Load Docker Swarm secrets (will override env vars if files exist)
loadSecrets()

let _base = null

export function base(tableName) {
  if (!_base) {
    if (!process.env.AIRTABLE_ACCESS_TOKEN) {
      throw new Error("AIRTABLE_ACCESS_TOKEN is not defined")
    }
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error("AIRTABLE_BASE_ID is not defined")
    }
    const airtable = new Airtable({
      apiKey: process.env.AIRTABLE_ACCESS_TOKEN
    })
    _base = airtable.base(process.env.AIRTABLE_BASE_ID)
  }
  return _base(tableName)
}

// Re-export TABLES from field-mappings.js for convenience
export const tables = TABLES
