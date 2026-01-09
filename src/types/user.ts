/**
 * Airtable User table field names (Dutch)
 */
export const AIRTABLE_FIELDS = {
  name: "Naam",
  email: "E-mailadres",
  company: "Bedrijf",
  role: "Rol",
  languageCode: "Taalcode",
  profilePhoto: "Profielfoto",
  passwordHash: "Paswoord Hash",
  createdAt: "Aangemaakt op",
  lastLogin: "Laatste login"
} as const

/**
 * Raw Airtable record structure
 */
export interface AirtableUser {
  id: string
  fields: {
    [AIRTABLE_FIELDS.name]: string
    [AIRTABLE_FIELDS.email]: string
    [AIRTABLE_FIELDS.company]?: string[] // Linked record IDs
    [AIRTABLE_FIELDS.role]?: string
    [AIRTABLE_FIELDS.languageCode]?: string
    [AIRTABLE_FIELDS.profilePhoto]?: Array<{
      url: string
      filename: string
    }>
    [AIRTABLE_FIELDS.passwordHash]?: string
    [AIRTABLE_FIELDS.createdAt]?: string
    [AIRTABLE_FIELDS.lastLogin]?: string
  }
}

/**
 * Clean User object for frontend use
 */
export interface User {
  id: string
  name: string
  email: string
  company?: string[]
  role?: string
  languageCode?: string
  profilePhoto?: string
  createdAt?: string
  lastLogin?: string
}

/**
 * Transform Airtable record to clean User object
 */
export function transformUser(record: AirtableUser): User {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[AIRTABLE_FIELDS.name],
    email: fields[AIRTABLE_FIELDS.email],
    company: fields[AIRTABLE_FIELDS.company],
    role: fields[AIRTABLE_FIELDS.role],
    languageCode: fields[AIRTABLE_FIELDS.languageCode],
    profilePhoto: fields[AIRTABLE_FIELDS.profilePhoto]?.[0]?.url,
    createdAt: fields[AIRTABLE_FIELDS.createdAt],
    lastLogin: fields[AIRTABLE_FIELDS.lastLogin]
  }
}
