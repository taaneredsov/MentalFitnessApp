# Action Required: Score Split Display

Manual steps that must be completed by a human. These cannot be automated.

## Before Implementation

- [ ] **Add Airtable fields to Gebruikers table** - Need to manually create 3 new number fields:
  - `Mental Fitness Score` (number, default 0)
  - `Persoonlijke Doelen Score` (number, default 0)
  - `Goede Gewoontes Score` (number, default 0)

- [ ] **Update Totaal Punten formula** - Modify the formula field to:
  ```
  {Mental Fitness Score} + {Persoonlijke Doelen Score} + {Goede Gewoontes Score} + {Bonus Punten}
  ```

- [ ] **Document field IDs** - After creating fields, copy the field IDs for use in code:
  - Go to Airtable > Extensions > Scripting > Run schema script
  - Or use API: `curl -H "Authorization: Bearer TOKEN" "https://api.airtable.com/v0/meta/bases/BASE_ID/tables"`

## During Implementation

- [ ] **Update field-mappings.js with actual field IDs** - Replace placeholder IDs with real ones from Airtable

## After Implementation

- [ ] **Migrate existing user data** - Calculate and populate the new score fields based on existing usage data (optional for MVP)

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
