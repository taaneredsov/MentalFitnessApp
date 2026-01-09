import Airtable from "airtable"

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error("AIRTABLE_API_KEY is not defined")
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID is not defined")
}

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
})

export const base = airtable.base(process.env.AIRTABLE_BASE_ID)

export const tables = {
  users: process.env.AIRTABLE_TABLE_ID || "Users"
}
