# Action Required: Method Usage Tracking

Manual steps that must be completed by a human.

## Outstanding

- [ ] **Add Programmaplanning link field in Airtable** (sync layer)
  - Table: Method Usage (tblktNOXF3yPPavXU)
  - Add "Programmaplanning" link field, configure bidirectional link with Programmaplanning.methodUsage
  - Note the field ID and update `METHOD_USAGE_FIELDS.programmaplanning` in `field-mappings.js`

- [ ] **Verify outbox sync writes Programmaplanning link correctly**
  - Create a method usage from a program schedule
  - Confirm the Airtable record shows the Programmaplanning link after sync

## Completed

- [x] Method usage reads/writes use Postgres (`method_usage_pg`).
- [x] Outbox sync writes method usage to Airtable asynchronously.
- [x] Reward awarding integrated into method usage recording flow.
- [x] Media progress tracking, feedback modal, and API endpoint implemented.
