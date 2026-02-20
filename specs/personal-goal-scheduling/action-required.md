# Action Required: Personal Goal Scheduling

## Before Deploy

### 1. Create Airtable "Planningdagen" Field

**Table**: Persoonlijke doelen (`tblbjDv35B50ZKG9w`)

1. Add a "Long text" field named "Planningdagen"
2. Copy the field ID from the Airtable API schema
3. Replace `fldPLACEHOLDER_SCHEDULE` in `api/_lib/field-mappings.js` line 219

### 2. Add Status Options in Airtable

The "Status" field in Persoonlijke doelen needs these options:
- Actief (existing)
- Gearchiveerd (existing)
- **Voltooid** (new)
- **Verwijderd** (new)

### 3. Run Migration on Server

Migration `007_personal_goal_schedule.sql` will run automatically via `npm run db:migrate` during deploy.
