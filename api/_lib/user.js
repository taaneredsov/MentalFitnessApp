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
}

/**
 * Transform Airtable record to clean User object
 */
export function transformUser(record) {
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
