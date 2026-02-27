# Action Required: Overtuigingen

## Before Implementation

- [x] **Create "Overtuigingen Gebruik" table in Airtable**
- [x] **Add "Overtuigingen" link field to Programs table**
- [x] **Add fields to Persoonlijke Overtuigingen table**
- [ ] **Record all new field IDs via Airtable Meta API** - Run `curl` against Airtable Meta API to get field IDs for all new/modified fields. These IDs are needed for `field-mappings.js`
- [ ] **Provide field IDs to developer** - Required IDs: all fields in Overtuigingen Gebruik table, the new Overtuigingen field on Programs table, new fields on Persoonlijke Overtuigingen table, and existing field IDs for Overtuigingen and Mindset Categorien tables

## After Implementation

- [ ] **Test with real data** - Ensure overtuigingen display correctly with actual content

## Architecture Note

All API endpoints read from Postgres exclusively. Reference data (overtuigingen, mindset categories) is synced from Airtable to Postgres via the full-sync worker. Writes go through Postgres with outbox sync to Airtable.
