# Action Required: Method Usage Tracking

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

### Airtable Schema Changes

- [ ] **Add Programmaplanning link field to Method Usage table**
  - Table: Method Usage (tblktNOXF3yPPavXU)
  - Add new field: "Programmaplanning" (Link to Programmaplanning table)
  - Configure as bidirectional link with Programmaplanning.methodUsage
  - Get the new field ID for use in code

- [ ] **Verify bidirectional link configuration**
  - Programmaplanning table (tbl2PHUaonvs1MYRx)
  - Field: Methodegebruik (`fldoxGlLYZ5NI60hl`)
  - Should auto-update when Method Usage links to it

- [ ] **Decision: Keep or remove Program link?**
  - Current: Method Usage links to "Mentale Fitnessprogramma's" (`fld18WcaPR8nXNr4a`)
  - Option A: Replace with Programmaplanning link (cleaner)
  - Option B: Keep both (for legacy data)
  - Recommended: Option A - remove Program link, derive program via Programmaplanning.program

### Get Field IDs

After creating the Programmaplanning link field:
- [ ] Note the new field ID for `METHOD_USAGE_FIELDS.programmaplanning`

## During Implementation

- [ ] **Update field-mappings.js** with new field ID once obtained from Airtable

## After Implementation

- [ ] **Test with real Airtable data**
  - Create Method Usage from program schedule
  - Verify Programmaplanning link is set correctly
  - Verify Programmaplanning.methodUsage shows the linked record
  - Verify progress calculation uses completed sessions

- [ ] **Migrate existing data (optional)**
  - Existing Method Usage records linked to Program but not Programmaplanning
  - Can be left as-is (legacy) or migrated manually

---

## Field ID Placeholder

Update this after creating the field in Airtable:

```javascript
// TODO: Replace fld??? with actual field ID
programmaplanning: "fld???"  // Programmaplanning link field
```

---

> **Note:** This Airtable schema change is a prerequisite for both `method-usage-tracking` and `activity-based-progress` specs.
