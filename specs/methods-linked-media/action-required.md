# Action Required: Methods with Linked Media

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [ ] **Get Media table field IDs from Airtable** - Need actual field IDs for these fields in Media table (`tblwzDUwtnhFKw4kA`):
  - `Bestandsnaam` - File name (used to link method to program)
  - `Type` - Media type (video/audio)
  - `Bestand` - The actual file attachment (contains media URL)

  Go to Airtable API > Meta > Get base schema to find the field IDs.

- [ ] **Get Methods→Media linked field ID** - Need the field ID for the linked field on Methods table that points to Media table.

## During Implementation

- [ ] **Update MEDIA_FIELDS with actual field IDs** - Replace placeholder IDs in `api/_lib/field-mappings.js`:
  ```javascript
  export const MEDIA_FIELDS = {
    filename: "fld???",    // Bestandsnaam
    type: "fld???",        // Type (video/audio)
    file: "fld???"         // Bestand (attachment)
  }
  ```

- [ ] **Update METHOD_FIELDS.media with actual field ID** - Replace `fldMedia` placeholder with the real linked field ID.

## After Implementation

None required.

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
