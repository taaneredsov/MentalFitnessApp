# Action Required: Overtuigingen

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [x] **Create "Overtuigingen Gebruik" table in Airtable** - Tracks user practice of beliefs at different levels. Fields: Gebruikers (link → Users), Overtuiging (link → Overtuigingen), Programma (link → Programs), Niveau (Single select: "Niveau 1", "Niveau 2", "Niveau 3"), Datum (Date)
- [x] **Add "Overtuigingen" link field to Programs table** - Links programs to selected overtuigingen. Field type: Link to Overtuigingen table
- [x] **Add fields to Persoonlijke Overtuigingen table** - Add: Programma (link → Programs), Datum afgerond (Date), Status (Single select: "Actief" / "Afgerond")
- [ ] **Record all new field IDs via Airtable Meta API** - Run `curl` against Airtable Meta API to get field IDs for all new/modified fields. These IDs are needed for `field-mappings.js`
- [ ] **Commit current work to main** - All uncommitted changes must be committed before creating feature branch
- [ ] **Deploy current main to mfa.drvn.be** - Ensure production is stable before starting feature work
- [ ] **Create feature branch `feat/overtuigingen`** - Branch from main after commit + deploy

## During Implementation

- [ ] **Provide field IDs to developer** - After Airtable setup, share the field IDs so they can be added to `field-mappings.js`. Required IDs: all fields in Overtuigingen Gebruik table, the new Overtuigingen field on Programs table, new fields on Persoonlijke Overtuigingen table, and existing field IDs for Overtuigingen and Mindset Categorien tables

## After Implementation

- [ ] **Verify Airtable automations still work** - The existing Airtable automation that suggests methods based on goals should not be affected
- [ ] **Test with real data** - Ensure overtuigingen display correctly with actual Airtable content

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
