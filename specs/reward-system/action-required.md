# Action Required: Reward System

## Manual Setup Steps

Before implementation can begin, the following manual Airtable setup is required.

---

## 1. Add Reward Fields to Gebruikers Table

Add these 6 new fields to the existing **Gebruikers** (Users) table:

| Field Name (Dutch) | Field Type | Default Value | Notes |
|-------------------|------------|---------------|-------|
| Totaal Punten | Number (Integer) | 0 | Total points earned |
| Huidige Streak | Number (Integer) | 0 | Current consecutive days |
| Langste Streak | Number (Integer) | 0 | Best streak ever achieved |
| Laatste Actieve Dag | Date | (empty) | Last activity date (YYYY-MM-DD) |
| Badges | Long text | [] | JSON array of badge IDs |
| Niveau | Number (Integer) | 1 | Current level (1-10) |

### Steps:
1. Open Airtable → Corporate Mental Fitness base → Gebruikers table
2. Click "+" to add each field
3. Set field types and defaults as specified
4. Note down each field ID (click field header → "Edit field" → look at URL or use API)

---

## 2. Create Gewoontegebruik (Habit Usage) Table

Create a new table to track daily habit completions:

| Field Name | Field Type | Configuration |
|------------|------------|---------------|
| Gebruiker | Link to another record | Link to Gebruikers table |
| Methode | Link to another record | Link to Methodes table |
| Datum | Date | Format: YYYY-MM-DD |
| Aangemaakt op | Created time | (automatic) |

### Steps:
1. Click "+" next to table tabs to create new table
2. Name it "Gewoontegebruik"
3. Add the fields as specified
4. Note down the table ID and all field IDs

---

## 3. Provide Field IDs

After creating the fields and table, provide the following IDs:

### Gebruikers Table - New Fields:
```
Totaal Punten: fld_______________
Huidige Streak: fld_______________
Langste Streak: fld_______________
Laatste Actieve Dag: fld_______________
Badges: fld_______________
Niveau: fld_______________
```

### Gewoontegebruik Table:
```
Table ID: tbl_______________
Gebruiker (link): fld_______________
Methode (link): fld_______________
Datum: fld_______________
```

---

## Verification Checklist

- [ ] Added 6 reward fields to Gebruikers table
- [ ] Created Gewoontegebruik table with 4 fields
- [ ] Collected all field IDs
- [ ] Shared field IDs with developer

---

## Notes

- Field IDs can be found in the Airtable API documentation for your base, or by inspecting the URL when editing a field
- The Badges field stores a JSON array as text, e.g., `["eerste_sessie", "week_streak"]`
- Dates should use YYYY-MM-DD format for consistency with existing fields
