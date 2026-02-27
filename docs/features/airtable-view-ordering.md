# Airtable View-Based Ordering

Reference data (Goals, Methods, Goede Gewoontes, Overtuigingen) displays in the order curated in Airtable views.

## How It Works

1. **Airtable**: Each relevant table has a view named **"App"** where the display order is set by dragging records
2. **Sync**: The worker passes `view: "App"` to `base(tableId).select()` — Airtable returns records in view order. The array index is stored as `_syncOrder` in the JSONB payload
3. **Read**: SQL queries use `ORDER BY (payload->>'_syncOrder')::int` to preserve the order

## Tables Using View Order

| Table | Airtable View | Target Table |
|-|-|-|
| Goals | App | `reference_goals_pg` |
| Methods | App | `reference_methods_pg` |
| Goede Gewoontes | App | `reference_goede_gewoontes_pg` |
| Overtuigingen | App | `reference_overtuigingen_pg` |

Tables **not** using view order (no curated display order needed): Companies, Days, Translations, Experience Levels, Program Prompts.

Mindset Categories use `_syncOrder` from database insertion order (no "App" view) and are additionally sorted by their `order` field on the frontend.

## Key Files

| File | Role |
|-|-|
| `api/_lib/sync/full-sync.ts` | `syncReferenceTable()` accepts optional `viewName`, stores `_syncOrder` in payload |
| `api/_lib/repos/reference-repo.ts` | All `list*()` and `lookup*ByIds()` queries include `ORDER BY _syncOrder` |

## Changing Display Order

1. Open the relevant Airtable table
2. Switch to the **"App"** view
3. Drag records into the desired order
4. Wait for the next sync cycle (or trigger manual sync)
5. Records will display in the new order in the app

## Notes

- `_syncOrder` is the zero-based index of the record in the Airtable view
- If the "App" view doesn't exist, Airtable falls back to default order
- Overtuigingen also have an explicit `order` field; `_syncOrder` serves as a backup
