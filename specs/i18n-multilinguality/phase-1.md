# Phase 1: Foundation + Auth + Translation Pipeline

**Scope:** ~60 translation keys, ~18 files modified/created
**Goal:** Set up the full translation pipeline (Airtable -> Postgres -> API -> frontend), install i18n infrastructure, convert auth flows, add language switcher, wire taalcode from Airtable.

---

## 1. Create the Airtable `Vertalingen` Table

Create a new table in the existing Airtable base:

| Column | Type | Notes |
|--------|------|-------|
| `Key` | Primary field (single line text) | Translation key, e.g. `auth.login.title` |
| `nl` | Long text | Dutch translation (required for all rows) |
| `fr` | Long text | French translation |
| `en` | Long text | English translation |
| `Context` | Single line text | Optional. Helps translators understand where the string appears, e.g. "Login page title" |

Populate with Phase 1 keys (~60 rows). See section 4 for the full key list.

**Why Long text instead of Single line text for translations?** Some translations (especially for descriptions, tooltips, or longer UI text) may exceed the single line text limit. Long text also preserves newlines for multi-line strings if ever needed.

---

## 2. Add Postgres Migration for `translations` Table

**New file:** `api/migrations/XXX_create_translations_table.sql` (or equivalent migration mechanism)

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

CREATE INDEX idx_translations_airtable_id ON translations(airtable_id);
```

The `airtable_id` column stores the Airtable record ID for upsert logic during sync. The index on `airtable_id` supports efficient lookups during the sync process.

---

## 3. Add Translations to the Sync Worker

**Modified file:** Sync worker configuration (same file that configures other Airtable -> Postgres table syncs)

Add `translations` to the existing sync worker following the same pattern used for other tables:

```tsx
// In the sync worker table configuration:
{
  tableName: "Vertalingen",
  postgresTable: "translations",
  fieldMapping: {
    // Map Airtable field IDs to Postgres columns
    "fldXXXXXXXXXXXXXX": "key",      // Key (primary field)
    "fldXXXXXXXXXXXXXX": "nl",       // nl
    "fldXXXXXXXXXXXXXX": "fr",       // fr
    "fldXXXXXXXXXXXXXX": "en",       // en
    "fldXXXXXXXXXXXXXX": "context",  // Context
  },
  primaryKey: "key",
  // Use upsert: ON CONFLICT (key) DO UPDATE
}
```

**Note:** Replace `fldXXXXXXXXXXXXXX` with actual Airtable field IDs after creating the table. Use `returnFieldsByFieldId: true` as per the project's existing pattern.

The sync runs on the existing polling interval -- no new cron or scheduler needed.

---

## 4. Create the API Endpoint

**New file:** `api/translations/[lang].ts` (or equivalent route)

```tsx
// GET /api/translations/:lang
// Returns flat key-value JSON for the requested language.
// No auth required -- translations are not sensitive.

import { pool } from "../_lib/db";

const SUPPORTED_LANGS = ["nl", "fr", "en"];

export async function GET(req: Request) {
  const lang = req.params.lang;

  if (!SUPPORTED_LANGS.includes(lang)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  // Query only the key and requested language column
  const result = await pool.query(
    `SELECT key, ${lang} as value FROM translations WHERE ${lang} IS NOT NULL`
  );

  // Build flat key-value map
  const translations: Record<string, string> = {};
  for (const row of result.rows) {
    translations[row.key] = row.value;
  }

  return Response.json(translations, {
    headers: {
      // Cache for 5 minutes, allow stale for 1 hour while revalidating
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
```

**Key design decisions:**

- **Column name in query is safe** because `lang` is validated against a whitelist (`SUPPORTED_LANGS`) before interpolation -- no SQL injection risk.
- **`WHERE ${lang} IS NOT NULL`** skips untranslated keys for non-Dutch languages. The frontend falls back to Dutch via i18next's `fallbackLng`.
- **Cache headers** allow CDN/browser caching while keeping translations reasonably fresh. The `stale-while-revalidate` directive means users see cached translations instantly while the browser fetches fresh ones in the background.
- **No auth** -- translations are public, non-sensitive data. Removing the auth requirement means translations load before login, which is needed for auth page strings.

---

## 5. Install Dependencies

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

No additional type packages needed -- all three ship their own TypeScript types.

---

## 6. Create i18n Configuration with API Loading

**New file:** `src/lib/i18n.ts`

```tsx
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { fallbackTranslations } from "./i18n-fallback";

const TRANSLATIONS_CACHE_KEY = "i18n_translations";
const TRANSLATIONS_TIMESTAMP_KEY = "i18n_translations_ts";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Load cached translations from localStorage (instant, no flash)
function getCachedTranslations(lang: string): Record<string, string> | null {
  try {
    const cached = localStorage.getItem(`${TRANSLATIONS_CACHE_KEY}_${lang}`);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

// Save translations to localStorage
function cacheTranslations(lang: string, translations: Record<string, string>) {
  try {
    localStorage.setItem(`${TRANSLATIONS_CACHE_KEY}_${lang}`, JSON.stringify(translations));
    localStorage.setItem(`${TRANSLATIONS_TIMESTAMP_KEY}_${lang}`, Date.now().toString());
  } catch {
    // localStorage full or unavailable -- non-critical
  }
}

// Fetch translations from API
async function fetchTranslations(lang: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`/api/translations/${lang}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Determine if cached translations are stale
function isCacheStale(lang: string): boolean {
  const ts = localStorage.getItem(`${TRANSLATIONS_TIMESTAMP_KEY}_${lang}`);
  if (!ts) return true;
  return Date.now() - parseInt(ts, 10) > CACHE_MAX_AGE_MS;
}

// Get initial translations: cached > fallback, then refresh in background
function getInitialResources(lang: string): Record<string, string> {
  const cached = getCachedTranslations(lang);
  if (cached) return cached;

  // Use bundled fallback for the requested language (or Dutch fallback)
  return fallbackTranslations[lang] || fallbackTranslations.nl;
}

// Resolve initial language
function getInitialLanguage(): string {
  // Check localStorage first (user's explicit choice)
  const stored = localStorage.getItem("i18nextLng");
  if (stored && ["nl", "fr", "en"].includes(stored)) return stored;

  // Browser detection will be handled by i18next-browser-languagedetector
  return "nl";
}

const initialLang = getInitialLanguage();
const initialResources = getInitialResources(initialLang);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      [initialLang]: { translation: initialResources },
    },
    lng: initialLang, // Explicit initial language (skips async detection)
    fallbackLng: "nl",
    supportedLngs: ["nl", "fr", "en"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  });

// Sync <html lang> attribute on language change
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

// Background refresh: fetch fresh translations and update i18next resources
async function refreshTranslations(lang: string) {
  const translations = await fetchTranslations(lang);
  if (translations) {
    cacheTranslations(lang, translations);
    i18n.addResourceBundle(lang, "translation", translations, true, true);
  }
}

// Refresh on init if cache is stale
if (isCacheStale(initialLang)) {
  refreshTranslations(initialLang);
}

// Refresh when language changes (fetch new language's translations)
i18n.on("languageChanged", async (lng) => {
  const cached = getCachedTranslations(lng);
  if (cached) {
    // Use cached immediately, refresh in background if stale
    i18n.addResourceBundle(lng, "translation", cached, true, true);
    if (isCacheStale(lng)) {
      refreshTranslations(lng);
    }
  } else {
    // No cache -- fetch and load (fallback strings are shown briefly)
    const fallback = fallbackTranslations[lng] || fallbackTranslations.nl;
    i18n.addResourceBundle(lng, "translation", fallback, true, true);
    await refreshTranslations(lng);
  }
});

export default i18n;
```

**New file:** `src/lib/i18n-fallback.ts`

Bundled minimal fallback translations -- only auth-critical strings so the app never shows raw keys before the API responds.

```tsx
// Minimal fallback translations bundled with the app.
// These ensure auth pages are usable even if the translations API is unreachable.
// This file should only contain auth-critical strings (~15-20 keys).

export const fallbackTranslations: Record<string, Record<string, string>> = {
  nl: {
    "auth.login.title": "Inloggen",
    "auth.login.emailLabel": "E-mailadres",
    "auth.login.emailPlaceholder": "jouw@email.nl",
    "auth.login.passwordLabel": "Wachtwoord",
    "auth.login.submitButton": "Inloggen",
    "auth.login.forgotPassword": "Wachtwoord vergeten?",
    "auth.login.magicLinkOption": "Inloggen met magic link",
    "auth.login.error": "Ongeldige inloggegevens",
    "auth.magicLink.title": "Magic Link",
    "auth.magicLink.submitButton": "Verstuur link",
    "auth.setPassword.title": "Wachtwoord instellen",
    "auth.setPassword.submitButton": "Wachtwoord instellen",
    "auth.verifyCode.title": "Code verifiëren",
    "auth.verifyCode.submitButton": "Verifiëren",
    "auth.verifyToken.verifying": "Bezig met verifiëren...",
    "auth.firstTimeUser.title": "Welkom!",
    "auth.firstTimeUser.submitButton": "Account activeren",
    "validation.required": "Dit veld is verplicht",
    "validation.invalidEmail": "Ongeldig e-mailadres",
  },
  fr: {
    "auth.login.title": "Connexion",
    "auth.login.emailLabel": "Adresse e-mail",
    "auth.login.passwordLabel": "Mot de passe",
    "auth.login.submitButton": "Se connecter",
    "auth.login.error": "Identifiants invalides",
    "validation.required": "Ce champ est obligatoire",
    "validation.invalidEmail": "Adresse e-mail invalide",
  },
  en: {
    "auth.login.title": "Log in",
    "auth.login.emailLabel": "Email address",
    "auth.login.passwordLabel": "Password",
    "auth.login.submitButton": "Log in",
    "auth.login.error": "Invalid credentials",
    "validation.required": "This field is required",
    "validation.invalidEmail": "Invalid email address",
  },
};
```

**Key design decisions:**

- **No `i18next-http-backend` plugin.** We handle fetching ourselves for full control over caching, fallback behavior, and the stale-while-revalidate pattern.
- **Instant first paint.** On subsequent loads, cached translations are available synchronously (loaded from localStorage in `getInitialResources`). No loading spinner needed.
- **Background refresh.** If the cache is stale, fresh translations are fetched without blocking rendering. When they arrive, `addResourceBundle` updates i18next's resources and react-i18next re-renders affected components.
- **Bundled fallback.** The `i18n-fallback.ts` file contains just enough strings (~15-20) for auth pages to render. This is the safety net if the API is unreachable and localStorage is empty (e.g., first visit on a flaky connection).
- **Flat key structure.** The API returns flat keys (`"auth.login.title": "Inloggen"`), which i18next supports natively with the `keySeparator: false` option or by using flat key lookups. The `t("auth.login.title")` call works with flat resources.
- `LanguageDetector` is configured to check `localStorage` first, then browser language. The Airtable `taalcode` is applied programmatically on login (not via the detector).
- `fallbackLng: "nl"` ensures Dutch is the ultimate fallback.
- `supportedLngs` prevents setting unsupported language codes.
- `escapeValue: false` is correct for React (JSX handles escaping).
- The `languageChanged` listener keeps `<html lang>` in sync from the start.

---

## 7. Wire into main.tsx

**Modified file:** `src/main.tsx`

Add a single import at the top of the file, **before** the App component is rendered. i18next initializes synchronously with the cached/fallback resources, then refreshes in the background.

```tsx
// Add this import near the top of main.tsx
import "./lib/i18n";

// ... rest of main.tsx unchanged
```

That is all. The `import` executes the i18n initialization side effect. `react-i18next` provides context automatically via `initReactI18next` plugin (no `<I18nextProvider>` wrapper needed, though one can be added for explicitness).

---

## 8. Taalcode Flow: Airtable to Frontend

### 8a. API Side

**Modified file:** `api/auth/login.ts` (or equivalent login endpoint)

The login API already returns user data from Airtable. Add the `Taalcode` field to the response.

```tsx
// In the Airtable query / user data mapping:
const taalcode = record.fields["fldMQEv7JI5PjNeyk"]; // Taalcode field ID

// Include in the API response user object:
return {
  // ... existing user fields
  taalcode: taalcode || "nl", // Default to Dutch if not set
};
```

**Modified file:** `api/auth/refresh.ts` (token refresh endpoint)

Same change -- ensure `taalcode` is included when returning user data on token refresh, so the language is restored on page reload.

### 8b. Frontend Side

**Modified file:** `src/contexts/AuthContext.tsx`

After receiving the user object with `taalcode`:

```tsx
import i18n from "../lib/i18n";

// In the login success handler:
const handleLoginSuccess = (userData: User) => {
  // ... existing token/user state updates

  // Set language from Airtable taalcode, but only if user hasn't
  // explicitly overridden it via the language switcher
  const storedLang = localStorage.getItem("i18nextLng");
  if (!storedLang || storedLang === userData.taalcode) {
    i18n.changeLanguage(userData.taalcode);
    // This triggers the languageChanged listener in i18n.ts,
    // which fetches translations for the new language if needed.
  }
  // If storedLang exists and differs from taalcode, the user's
  // explicit choice (localStorage) takes precedence.
};
```

**Important nuance:** On the very first login, localStorage will either be empty or set by the browser detector. The Airtable `taalcode` should win over browser detection, but a previous explicit user choice (from the language switcher) should be preserved. The logic above handles this by checking if localStorage already has a value and whether it differs from the Airtable value.

**Simplified rule:** If localStorage is empty OR matches the Airtable value, apply the Airtable value. If localStorage differs (user explicitly chose differently), keep localStorage.

### 8c. User Type Update

**Modified file:** `src/types/user.ts` (or wherever the User type is defined)

```tsx
interface User {
  // ... existing fields
  taalcode: "nl" | "fr" | "en";
}
```

---

## 9. Zod Schema Factory Pattern

### The Problem

Zod schemas are typically defined at module level:

```tsx
// This runs once at import time -- t() is not available
const schema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
});
```

### The Solution

Convert to factory functions that accept `t`, call them inside components with `useMemo`.

**Pattern for each auth page:**

```tsx
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { z } from "zod";
import type { TFunction } from "i18next";

// Factory function (can be in same file or a shared schemas file)
function createLoginSchema(t: TFunction) {
  return z.object({
    email: z
      .string()
      .min(1, t("validation.required"))
      .email(t("validation.invalidEmail")),
    password: z
      .string()
      .min(8, t("validation.passwordMinLength", { min: 8 })),
  });
}

// Derive the type from the factory's return type
type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;

function LoginPage() {
  const { t, i18n } = useTranslation();

  // Recreate schema when language changes
  const schema = useMemo(
    () => createLoginSchema(t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );

  // Use schema with react-hook-form + zodResolver as before
  const form = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  // ... rest of component
}
```

**Why `useMemo` with `i18n.language`?**

The `t` function reference itself does not change on language switch (it is stable). Adding `i18n.language` to the dependency array ensures the schema is rebuilt when the active language changes. The `eslint-disable` comment is needed because `i18n.language` is not a standard dependency.

### Files requiring this pattern

Audit each auth page for Zod schemas and apply the factory pattern:

1. `LoginPage` -- email + password schema
2. `MagicLinkPage` -- email schema
3. `SetPasswordPage` -- password + confirm schema
4. `VerifyCodePage` -- code schema
5. `FirstTimeUserPage` -- password + confirm schema
6. Any shared schema files in `src/lib/` or `src/schemas/`

---

## 10. Language Switcher Component

**New file:** `src/components/LanguageSwitcher.tsx`

```tsx
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "nl", label: "Nederlands" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;

interface LanguageSwitcherProps {
  onLanguageChange?: (lang: string) => void;
}

export function LanguageSwitcher({ onLanguageChange }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang); // Updates localStorage automatically
    // The languageChanged listener in i18n.ts handles fetching
    // translations for the new language from the API.
    onLanguageChange?.(lang);  // Parent can sync to Airtable
  };

  return (
    <div className="language-switcher">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={i18n.language === code ? "active" : ""}
          aria-pressed={i18n.language === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Note:** Language labels are displayed in their own language (not translated). "Français" is always "Français", regardless of the current app language. This is the standard UX pattern.

### Integration with AccountPage

**Modified file:** `src/pages/AccountPage.tsx`

```tsx
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../contexts/AuthContext";

function AccountPage() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();

  const handleLanguageChange = async (lang: string) => {
    // Sync language preference back to Airtable
    try {
      await apiClient.updateUserLanguage(accessToken, lang);
    } catch (error) {
      console.error("Failed to sync language to Airtable:", error);
      // Non-critical: language still works locally via localStorage
    }
  };

  return (
    <div>
      {/* ... existing account content */}
      <section>
        <h3>{t("account.language.label")}</h3>
        <LanguageSwitcher onLanguageChange={handleLanguageChange} />
      </section>
    </div>
  );
}
```

### API Endpoint for Language Sync

**New or modified file:** API endpoint to update Airtable `Taalcode` field

```tsx
// PATCH /api/user/language
// Body: { language: "nl" | "fr" | "en" }

// In the handler:
await airtable.update(userId, {
  [FIELD_IDS.Taalcode]: language, // "fldMQEv7JI5PjNeyk"
});
```

---

## 11. Convert Auth Pages

For each auth page, the conversion follows this pattern:

1. Import `useTranslation` from `react-i18next`
2. Call `const { t } = useTranslation()` in the component
3. Replace every hardcoded Dutch string with `t("key")`
4. If the page has a Zod schema, convert to factory pattern (see section 9)
5. All keys are already in the Airtable `Vertalingen` table (added in step 1), synced to Postgres, and available via the API

### Files to Convert

| File | Changes |
|------|---------|
| `src/pages/LoginPage.tsx` | ~8 strings + Zod schema factory |
| `src/pages/MagicLinkPage.tsx` | ~7 strings + Zod schema factory |
| `src/pages/SetPasswordPage.tsx` | ~5 strings + Zod schema factory |
| `src/pages/VerifyCodePage.tsx` | ~4 strings + Zod schema factory |
| `src/pages/VerifyTokenPage.tsx` | ~4 strings (no form) |
| `src/pages/FirstTimeUserPage.tsx` | ~5 strings + Zod schema factory |
| `src/pages/AccountPage.tsx` | ~10 strings + LanguageSwitcher integration |

### Conversion Example (LoginPage)

```tsx
// BEFORE
<h1>Inloggen</h1>
<label>E-mailadres</label>
<input placeholder="jouw@email.nl" />
<label>Wachtwoord</label>
<button type="submit">Inloggen</button>
<a href="/forgot">Wachtwoord vergeten?</a>

// AFTER
const { t } = useTranslation();
// ...
<h1>{t("auth.login.title")}</h1>
<label>{t("auth.login.emailLabel")}</label>
<input placeholder={t("auth.login.emailPlaceholder")} />
<label>{t("auth.login.passwordLabel")}</label>
<button type="submit">{t("auth.login.submitButton")}</button>
<a href="/forgot">{t("auth.login.forgotPassword")}</a>
```

---

## 12. Convert AccountPage Labels

Beyond the language switcher, convert existing AccountPage strings:

- Page title ("Account")
- Profile section header and labels (name, email, company)
- Logout button
- Version display
- Any other visible Dutch strings

This gives immediate demo value: the Account page will be fully trilingual after Phase 1.

---

## 13. Populate Airtable with Phase 1 Translation Keys

Add all ~60 Phase 1 keys to the `Vertalingen` table. Below is the full key set with Dutch values (French and English columns to be filled in by translators):

```
auth.login.title                    → Inloggen
auth.login.emailLabel               → E-mailadres
auth.login.emailPlaceholder         → jouw@email.nl
auth.login.passwordLabel            → Wachtwoord
auth.login.submitButton             → Inloggen
auth.login.forgotPassword           → Wachtwoord vergeten?
auth.login.noAccount                → Nog geen account?
auth.login.magicLinkOption          → Inloggen met magic link
auth.login.error                    → Ongeldige inloggegevens
auth.magicLink.title                → Magic Link
auth.magicLink.description          → Voer je e-mailadres in en we sturen je een inloglink.
auth.magicLink.emailLabel           → E-mailadres
auth.magicLink.submitButton         → Verstuur link
auth.magicLink.successTitle         → Link verstuurd!
auth.magicLink.successDescription   → Controleer je inbox voor de inloglink.
auth.magicLink.backToLogin          → Terug naar inloggen
auth.setPassword.title              → Wachtwoord instellen
auth.setPassword.newPasswordLabel   → Nieuw wachtwoord
auth.setPassword.confirmPasswordLabel → Bevestig wachtwoord
auth.setPassword.submitButton       → Wachtwoord instellen
auth.setPassword.success            → Wachtwoord succesvol ingesteld
auth.verifyCode.title               → Code verifiëren
auth.verifyCode.description         → Voer de verificatiecode in die je hebt ontvangen.
auth.verifyCode.codeLabel           → Verificatiecode
auth.verifyCode.submitButton        → Verifiëren
auth.verifyCode.resendCode          → Code opnieuw versturen
auth.verifyToken.verifying          → Bezig met verifiëren...
auth.verifyToken.success            → Succesvol geverifieerd!
auth.verifyToken.error              → Verificatie mislukt. Probeer het opnieuw.
auth.verifyToken.invalidToken       → Ongeldige of verlopen token.
auth.firstTimeUser.title            → Welkom!
auth.firstTimeUser.description      → Stel je wachtwoord in om je account te activeren.
auth.firstTimeUser.passwordLabel    → Kies een wachtwoord
auth.firstTimeUser.confirmLabel     → Bevestig wachtwoord
auth.firstTimeUser.submitButton     → Account activeren
validation.required                 → Dit veld is verplicht
validation.invalidEmail             → Ongeldig e-mailadres
validation.passwordMinLength        → Wachtwoord moet minimaal {{min}} tekens bevatten
validation.passwordMismatch         → Wachtwoorden komen niet overeen
validation.codeRequired             → Verificatiecode is verplicht
validation.codeLength               → Code moet {{length}} cijfers bevatten
account.title                       → Account
account.language.label              → Taal
account.language.nl                 → Nederlands
account.language.fr                 → Français
account.language.en                 → English
account.profile.title               → Profiel
account.profile.nameLabel           → Naam
account.profile.emailLabel          → E-mailadres
account.profile.companyLabel        → Bedrijf
account.logout                      → Uitloggen
account.version                     → Versie
```

---

## 14. Files Modified/Created Summary

### New Files
| File | Purpose |
|------|---------|
| `api/migrations/XXX_create_translations_table.sql` | Postgres migration for translations table |
| `api/translations/[lang].ts` | `GET /api/translations/:lang` endpoint |
| `src/lib/i18n.ts` | i18next configuration with API loading + caching |
| `src/lib/i18n-fallback.ts` | Minimal bundled fallback translations (auth-critical) |
| `src/components/LanguageSwitcher.tsx` | Language switcher UI component |

### Modified Files
| File | Changes |
|------|---------|
| `package.json` | Add i18next dependencies |
| `src/main.tsx` | Import `./lib/i18n` |
| `src/types/user.ts` (or equivalent) | Add `taalcode` to User type |
| `src/contexts/AuthContext.tsx` | Apply taalcode on login/refresh |
| `src/lib/api-client.ts` | Add `updateUserLanguage()` method |
| `api/auth/login.ts` | Include `taalcode` in response |
| `api/auth/refresh.ts` | Include `taalcode` in response |
| `api/user/language.ts` (new endpoint) | Update Airtable Taalcode field |
| Sync worker config | Add `translations` table to sync configuration |
| `src/pages/LoginPage.tsx` | Translate strings + Zod factory |
| `src/pages/MagicLinkPage.tsx` | Translate strings + Zod factory |
| `src/pages/SetPasswordPage.tsx` | Translate strings + Zod factory |
| `src/pages/VerifyCodePage.tsx` | Translate strings + Zod factory |
| `src/pages/VerifyTokenPage.tsx` | Translate strings |
| `src/pages/FirstTimeUserPage.tsx` | Translate strings + Zod factory |
| `src/pages/AccountPage.tsx` | Translate strings + LanguageSwitcher |

### Airtable Changes
| Change | Details |
|--------|---------|
| New table: `Vertalingen` | Columns: Key, nl, fr, en, Context |
| ~60 rows populated | Phase 1 translation keys with nl/fr/en values |

---

## 15. Acceptance Criteria

### Must pass
- [ ] `npm run build` completes with zero errors
- [ ] `npm run lint` completes with zero errors (may need ESLint config for i18next rules)
- [ ] Postgres migration runs successfully, `translations` table exists
- [ ] Sync worker picks up translations from Airtable and populates Postgres
- [ ] `GET /api/translations/nl` returns ~60 key-value pairs
- [ ] `GET /api/translations/fr` returns translated key-value pairs
- [ ] `GET /api/translations/en` returns translated key-value pairs
- [ ] Bundled fallback translations cover all auth-critical strings

### Manual testing
- [ ] Fresh visit (no localStorage): app loads with bundled fallback, then fetches full translations from API
- [ ] Second visit (localStorage has cache): app loads instantly with cached translations, no loading flash
- [ ] Login with user whose `Taalcode` is `"fr"`: app switches to French
- [ ] Login with user whose `Taalcode` is `"en"`: app switches to English
- [ ] Login with user whose `Taalcode` is `"nl"` or empty: app stays Dutch
- [ ] After login, reload page: language persists (from localStorage)
- [ ] On Account page, switch language to French: all auth + account strings update to French immediately
- [ ] Switch language on Account page: reload page, language is still French
- [ ] Switch language on Account page: the Airtable `Taalcode` field updates (verify in Airtable)
- [ ] After switching language on Account page, log out and log back in: the localStorage choice is preserved (not overwritten by Airtable value)
- [ ] Validation errors display in the current language (submit empty form, check error messages)
- [ ] Change language while validation errors are visible: errors update to new language
- [ ] All 6 auth pages display correctly in all 3 languages
- [ ] AccountPage displays correctly in all 3 languages
- [ ] No hardcoded Dutch strings visible on any converted page when language is French or English

### Translation pipeline testing
- [ ] Edit a translation in Airtable -> wait for sync cycle -> verify API returns updated value -> verify frontend shows updated value (after cache refresh)
- [ ] Add a new key in Airtable -> verify it syncs to Postgres -> verify API returns it -> verify frontend can use it
- [ ] API returns proper `Cache-Control` headers

### Edge cases
- [ ] User with no `Taalcode` in Airtable: defaults to Dutch
- [ ] User with invalid `Taalcode` (e.g., `"de"`): falls back to Dutch (via `supportedLngs`)
- [ ] Clear localStorage, set browser to French, visit app without logging in: auth pages display in French (from API or fallback)
- [ ] Extremely long translated strings do not break layout (spot check)
- [ ] API unreachable on first visit: app still renders auth pages using bundled fallback translations
- [ ] API unreachable on subsequent visit: app uses localStorage cached translations
