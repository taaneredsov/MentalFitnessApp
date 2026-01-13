import Airtable from "airtable"

if (!process.env.AIRTABLE_ACCESS_TOKEN) {
  throw new Error("AIRTABLE_ACCESS_TOKEN is not defined")
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID is not defined")
}

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_ACCESS_TOKEN
})

export const base = airtable.base(process.env.AIRTABLE_BASE_ID)

export const tables = {
  users: process.env.AIRTABLE_USER_TABLE_ID || "Users"
}
