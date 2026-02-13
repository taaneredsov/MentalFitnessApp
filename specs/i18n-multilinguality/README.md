# i18n / Multilinguality Feature Spec

## Overview

The app is a React + Vite Progressive Web App currently written entirely in Dutch. This feature adds **French** and **English** language support alongside Dutch.

**Library choice:** `react-i18next` ecosystem (`i18next` + `react-i18next` + `i18next-browser-languagedetector`)

**Key constraints:**

- Single namespace (`translation`) -- the app is not large enough to warrant splitting
- ~250 translatable strings across 65+ files (13 pages, 53 components)
- Translations managed in Airtable (`Vertalingen` table), synced to Postgres, served via API endpoint
- No URL prefixes or path-based locale routing (PWA, not SEO-driven)
- Airtable content (programs, methods, beliefs) stays single-language -- **out of scope**

---

## Translation Architecture

Translations follow the same data management pattern as the rest of the app: **Airtable as the source of truth, synced to Postgres via the existing sync worker, served to the frontend via an API endpoint.**

### Why this approach

- **Non-developers can edit translations** directly in Airtable's spreadsheet UI
- **No deploy needed** for translation fixes or copy changes
- **Adding a new language** = adding a column in Airtable + a minor code update
- **Version history** via Airtable's built-in revision tracking
- **Consistent architecture** -- same Airtable -> Postgres -> API pattern used for all other data

### Data flow

```
Airtable (Vertalingen table)
    |
    v  [sync worker, existing polling interval]
Postgres (translations table)
    |
    v  [GET /api/translations/:lang]
Frontend (i18next resources)
    |
    v  [cached in localStorage]
React components (t() calls)
```

### Airtable table: `Vertalingen`

| Column | Type | Description |
|--------|------|-------------|
| `Key` | Primary (string) | Translation key, e.g. `auth.login.title` |
| `nl` | Long text | Dutch translation |
| `fr` | Long text | French translation |
| `en` | Long text | English translation |
| `Context` | Single line text (optional) | Helps translators understand where the string is used |

~250 rows, one per translation key. Anyone with Airtable access can edit translations -- no deploy needed.

### Postgres table: `translations`

```sql
CREATE TABLE translations (
  key TEXT PRIMARY KEY,
  nl TEXT NOT NULL,
  fr TEXT,
  en TEXT,
  context TEXT,
  airtable_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API endpoint

`GET /api/translations/:lang` -- returns flat JSON:

```json
{
  "auth.login.title": "Inloggen",
  "auth.login.emailLabel": "E-mailadres",
  "nav.home": "Home"
}
```

- No auth required (translations are not sensitive)
- Response is small (~10-15 KB), can be cached with appropriate `Cache-Control` headers

### Frontend loading strategy

1. **On app init:** fetch translations from `GET /api/translations/:lang`
2. **Cache in localStorage** with a version/timestamp key
3. **On subsequent loads:** use cached translations immediately (no loading flash), refresh in background
4. **Minimal fallback snapshot** bundled in the app (just auth-critical strings) so the app never shows raw keys even if the API is unreachable
5. **i18next `init()`** receives resources from cache/fetch -- no `i18next-http-backend` plugin needed (simpler, more control)

---

## Language Detection Priority

The language is resolved using the following priority chain:

| Priority | Source | Mechanism |
|----------|--------|-----------|
| 1 | `localStorage` key `i18nextLng` | User's explicit override, persists across sessions |
| 2 | Airtable `Taalcode` field (`fldMQEv7JI5PjNeyk`) | Set when user is created, returned on login |
| 3 | Browser `navigator.language` | Detected by `i18next-browser-languagedetector` |
| 4 | Dutch (`nl`) | Ultimate fallback language |

### Flow on login

1. User authenticates (password or magic link)
2. API response includes the user's `taalcode` from Airtable (values: `"nl"`, `"fr"`, `"en"`)
3. Frontend checks if `localStorage` already has a language override
4. If no localStorage override exists, frontend calls `i18n.changeLanguage(taalcode)` which also writes to localStorage
5. If localStorage override exists, it takes precedence (user previously chose a different language)
6. After language is resolved, frontend fetches translations for that language from the API (or uses cached version)

### Flow on language switch

1. User selects new language on Account page
2. Frontend calls `i18n.changeLanguage(newLang)` -- this updates localStorage automatically
3. Frontend fetches translations for the new language from the API
4. Frontend fires API call to update Airtable `Taalcode` field for the user
5. All rendered strings update reactively via react-i18next

---

## Scope Inventory (~250 strings)

### By area

| Area | Estimated Keys | Files Affected |
|------|---------------|----------------|
| Auth flows (Login, MagicLink, SetPassword, VerifyCode, VerifyToken, FirstTimeUser) | ~25 | 6 pages + Zod schemas |
| Navigation / layout (AppHeader, BottomNav) | ~10 | 4 components |
| HomePage + section components | ~30 | 8 components (515-line HomePage) |
| Rewards system (LEVELS + BADGES constants) | 54 | 2 constant files + display components |
| Programs / Methods pages | ~25 | 8 pages + cards |
| Overtuigingen page + dialogs | ~20 | 5 components |
| AccountPage (profile, settings, notifications, goals) | ~40 | 1 page + sub-components |
| Wizards (AI Program + Manual Program) | ~30 | 12 files (6 per wizard) |
| Onboarding (WelcomeScreen, GuidedTour, tourSteps) | ~10 | 4 components |
| Validation messages (Zod schemas) | ~30 | 6+ schema files |
| Date/number locale formatting | implicit | 8+ files with hardcoded `"nl-NL"` |

### Notable complexity spots

- **HomePage** (515 lines): Heavy interpolation, dynamic section rendering
- **Rewards constants**: 27 levels + 27 badges with `name` and `description` fields -- currently hardcoded Dutch strings in constant arrays
- **Zod validation schemas**: Defined at module level with Dutch error messages -- need refactoring to factory pattern
- **Tour steps**: Array of step objects defined at module level with Dutch strings
- **Date formatting**: 8+ files with hardcoded `"nl-NL"` locale in `toLocaleDateString()` / `Intl.DateTimeFormat`

---

## Implementation Phases

Each phase is independently deployable. Earlier phases provide infrastructure that later phases build on.

---

### Phase 1: Foundation + Auth + Translation Pipeline (~60 keys, 14+ files)

**Goal:** Set up the full translation pipeline (Airtable -> Postgres -> API -> frontend), install i18n infrastructure, convert auth flows, add language switcher.

**Deliverables:**
- Create the Airtable `Vertalingen` table with `Key`, `nl`, `fr`, `en`, `Context` columns
- Add Postgres migration for `translations` table
- Add `translations` to the existing sync worker configuration (Airtable -> Postgres)
- Create `GET /api/translations/:lang` API endpoint
- Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- Create `src/lib/i18n.ts` with configuration (loading from API + localStorage cache + bundled fallback)
- Build frontend translation loader with caching (localStorage + background refresh)
- Bundle a minimal fallback snapshot of auth-critical strings
- Wire i18n into `src/main.tsx`
- Add `taalcode` to user object from Airtable login API response
- Convert 6 auth pages to use `t()` function
- Refactor Zod validation schemas to factory pattern with `useMemo`
- Add language switcher to AccountPage
- Sync language override back to Airtable `Taalcode` field
- Convert AccountPage labels for immediate demo value
- Populate the Airtable `Vertalingen` table with Phase 1 keys (~60 keys in nl/fr/en)

**See:** [phase-1.md](./phase-1.md) for detailed implementation steps.

---

### Phase 2: Navigation + Layout (~40 keys, 12 files)

**Goal:** Translate all persistent UI chrome (header, nav, prompts, modals).

**Files to convert:**
- `AppHeader` -- app title, menu items
- `BottomNav` -- tab labels (currently may be module-level constants -- move into render)
- `PWAUpdatePrompt` -- "Update available" / "Refresh" strings
- `InstallPrompt` -- "Install app" prompt text
- `InAppReminderBanner` -- reminder messages with pluralization (`{{count}} herinneringen`)
- `FeedbackModal` -- form labels, placeholders, submit button

**Technical notes:**
- Tab labels in BottomNav may be defined outside the component -- move into component body or use a function that calls `t()`
- Pluralization: i18next uses `_one` / `_other` suffixes (or `_zero` / `_one` / `_other` for languages that need it)
- French has special pluralization rules (0 and 1 are singular) -- i18next handles this automatically
- Add new keys to Airtable `Vertalingen` table -- they will sync automatically

---

### Phase 3: HomePage + Rewards + Onboarding (~80 keys, 20 files)

**Goal:** Translate the main dashboard, reward system, and onboarding experience.

**This is the most complex phase** due to interpolation, dynamic content, and centralized constants.

**Deliverables:**

**HomePage (515 lines, ~30 strings):**
- Greeting with interpolation: `"Goedemorgen, {{name}}"` / `"Bonjour, {{name}}"` / `"Good morning, {{name}}"`
- Time-of-day greetings (morning/afternoon/evening)
- Section headers, empty states, call-to-action buttons
- Dynamic score display text

**Rewards system (54 keys):**
- `LEVELS` array (27 entries): each has `name` and `description`
- `BADGES` array (27 entries): each has `name` and `description`
- Strategy: Keep data structure as-is, replace hardcoded strings with translation keys
  - e.g., `name: "Beginner"` becomes `name: "rewards.levels.beginner.name"`
  - At render time, call `t(level.name)` instead of using the string directly
- `formatPoints()` function: update to use `i18n.language` for number formatting

**Date locale helper:**
- Create shared `getDateLocale()` function in `src/lib/date-utils.ts`
- Maps i18n language to locale string: `nl -> "nl-NL"`, `fr -> "fr-FR"`, `en -> "en-GB"`
- Replace all 8+ hardcoded `"nl-NL"` references

**Onboarding:**
- `WelcomeScreen` -- welcome text, button labels
- `GuidedTour` -- navigation buttons (Next, Previous, Finish)
- `tourSteps` array -- step titles and descriptions (move from module-level to function/component)

**Section components:**
- `ScoreWidgets` -- score labels, period selectors
- `GoodHabitsSection` -- habit tracking strings
- `PersonalGoalsSection` -- goal display strings
- `OvertuigingenSection` -- beliefs section header/description
- `PersonalGoalDialog` -- form labels and buttons

---

### Phase 4: Programs, Methods, Overtuigingen (~40 keys, 15 files)

**Goal:** Translate all remaining content pages and wizard flows.

**Pages:**
- `ProgramsPage` -- page title, empty states, action buttons
- `ProgramDetailPage` -- detail labels, progress indicators
- `ProgramCard` -- card labels, status badges
- `MethodsPage` -- search placeholder, filter labels
- `MethodDetailPage` -- detail labels, action buttons
- `OvertuigingenPage` -- page title, category filters, personal beliefs section
- Overtuigingen dialogs -- form labels, buttons

**Wizards (12 files):**
- AI Program Wizard (6 files): step titles, instructions, AI prompt labels, result display
- Manual Program Wizard (6 files): step titles, form labels, method selection, schedule setup

**Remaining AccountPage strings:**
- Notification settings labels
- Personal goals management
- Any strings missed in Phase 1

---

### Phase 5: PWA + Tests + Polish (~10 keys, 10 files)

**Goal:** Final integration, testing infrastructure, and quality assurance.

**PWA manifest:**
- Set `name` and `short_name` to language-neutral values (or keep Dutch as the manifest is static)
- Set `lang: "nl"` as default
- Consider: manifest is static, so multi-language manifest is not practical for PWAs. Keep Dutch.

**HTML lang attribute:**
- Sync `<html lang="...">` to current i18n language on language change
- Add effect in `App.tsx` or i18n config: `i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng })`

**Test infrastructure:**
- Create `src/test/i18n-setup.ts` that initializes i18next for test environment
- Update `vitest.config.ts` / test setup to import i18n initialization
- Decide: mock translations (faster, tests break less) vs. use real translations (catches missing keys)
- Recommendation: use real Dutch translations (fetched or snapshot) in tests to catch missing keys

**Translation quality review:**
- Verify all keys exist in all 3 language columns in Airtable (write a simple script or check the Postgres table)
- Check interpolation variables match across languages
- Review French/English translations for accuracy
- Test edge cases: very long German-style translations (if ever added), RTL (not needed now but good to verify no hardcoded assumptions)

**Final verification:**
- All 3 languages render correctly across all pages
- Language persists across page reloads
- Language switch updates all visible strings without page reload
- Login with different `taalcode` values works correctly
- Translation edits in Airtable propagate to the app after sync (no deploy needed)

---

## Key Technical Patterns

### Zod Schema Factories

Zod schemas with custom error messages are typically defined at module level. Since `t()` is not available outside React components/hooks, refactor to factory functions.

```tsx
// BEFORE (module-level, hardcoded Dutch)
const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten"),
});

// AFTER (factory function)
function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t("validation.invalidEmail")),
    password: z.string().min(8, t("validation.passwordMinLength", { min: 8 })),
  });
}

// In component
function LoginPage() {
  const { t, i18n } = useTranslation();
  const schema = useMemo(() => createLoginSchema(t), [t, i18n.language]);
  // ... use schema with react-hook-form
}
```

The `useMemo` is keyed on `i18n.language` to ensure the schema regenerates when the language changes.

### Rewards Constants

Keep the existing data structure but replace hardcoded strings with translation keys.

```tsx
// BEFORE
export const LEVELS = [
  { threshold: 0, name: "Beginner", description: "Je bent net begonnen" },
  // ...
];

// AFTER
export const LEVELS = [
  { threshold: 0, nameKey: "rewards.levels.0.name", descriptionKey: "rewards.levels.0.description" },
  // ...
];

// At render time
function LevelBadge({ level }) {
  const { t } = useTranslation();
  return <span>{t(level.nameKey)}</span>;
}
```

### Date Formatting Helper

Replace all hardcoded `"nl-NL"` locale strings.

```tsx
// src/lib/date-utils.ts
import i18n from "./i18n";

const LOCALE_MAP: Record<string, string> = {
  nl: "nl-NL",
  fr: "fr-FR",
  en: "en-GB",
};

export function getDateLocale(): string {
  return LOCALE_MAP[i18n.language] || "nl-NL";
}

// Usage (replaces hardcoded "nl-NL")
date.toLocaleDateString(getDateLocale(), { day: "numeric", month: "long" });
```

### Number Formatting

```tsx
// Update existing formatPoints or create locale-aware version
export function formatPoints(points: number): string {
  return points.toLocaleString(getDateLocale());
}
```

### Module-Level Strings

Some strings are defined outside components (e.g., `tourSteps` array, tab configurations). These cannot use `useTranslation()` directly.

**Options:**
1. **Move into component render** -- define the array inside the component body
2. **Use a function** -- `const getTourSteps = (t: TFunction) => [...]`
3. **Use translation keys** -- store keys instead of strings, translate at render time

Prefer option 2 for arrays that are used as configuration, option 1 for simple cases.

### Translation Key Convention

Use dot-separated, hierarchical keys. These are stored as flat keys in the Airtable `Key` column:

```
auth.login.title
auth.login.emailLabel
auth.login.passwordLabel
auth.login.submitButton
auth.login.forgotPassword
auth.validation.invalidEmail
auth.validation.passwordMinLength

nav.home
nav.programs
nav.methods
nav.account

home.greeting.morning
home.greeting.afternoon
home.greeting.evening
home.scoreWidget.title

rewards.levels.0.name
rewards.levels.0.description
rewards.badges.0.name
rewards.badges.0.description

account.title
account.language.label
account.language.nl
account.language.fr
account.language.en
```

The API returns these as a flat key-value map. i18next can work with flat keys directly (no nested JSON structure required), or the frontend loader can unflatten them if preferred.

---

## Verification Checklist (per phase)

Before marking any phase complete:

- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] Manual test: switch to each language, verify all converted strings update
- [ ] Manual test: reload page, verify language persists (localStorage)
- [ ] Manual test: clear localStorage, log in with user that has different `taalcode`, verify correct language is set
- [ ] No hardcoded Dutch strings remain in converted files
- [ ] All 3 languages have values for the phase's keys in Airtable (and synced to Postgres)
- [ ] Interpolation variables (`{{name}}`, `{{count}}`) work correctly in all languages
- [ ] Pluralization works correctly where applicable (especially French: 0 = singular)
- [ ] Translation edit in Airtable propagates to app after sync cycle (no deploy)

---

## Out of Scope

- Airtable content translation (programs, methods, beliefs descriptions)
- Server-side rendering / SSR
- URL-based locale routing
- Right-to-left (RTL) language support
- Automated translation (all translations will be provided manually)
