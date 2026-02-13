/**
 * Shared types for the API layer.
 *
 * AirtableRecord is used to bridge untyped JS transform functions
 * (field-mappings.js, user.js) with TypeScript call sites.
 */

/** Minimal shape returned by the Airtable SDK for a record */
export interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}
