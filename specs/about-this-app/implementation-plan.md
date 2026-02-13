# Implementation Plan: Over deze app

## Overview

Add an "Over deze app" (About this app) card to the Account page with app info, legal links, and an auto-incrementing version number.

## Phase 1: Version Auto-Increment

Set up automatic patch version bumping so every build produces a new version number.

### Tasks

- [ ] Create a `scripts/bump-version.js` script that increments the patch version in `package.json`
- [ ] Add a `prebuild` npm script that runs the bump script before each build
- [ ] Expose the version to the frontend via Vite's `define` config (inject `__APP_VERSION__`)

### Technical Details

**bump-version.js** — Simple Node script:
- Read `package.json`, parse version, increment patch (e.g. `0.1.0` → `0.1.1`), write back
- Use `fs` only, no dependencies

**vite.config.ts** — Add define:
```ts
define: {
  __APP_VERSION__: JSON.stringify(require('./package.json').version)
}
```
Since Vite uses ESM, use `import` or `readFileSync` to read package.json version.

**package.json** — Add script:
```json
"prebuild": "node scripts/bump-version.js"
```

**Type declaration** — Add to `src/vite-env.d.ts`:
```ts
declare const __APP_VERSION__: string;
```

## Phase 2: "Over deze app" Card

Add the UI section to the Account page.

### Tasks

- [ ] Add "Over deze app" Card section to `AccountPage.tsx` (placed before the logout button)
- [ ] Display app name, brief description text
- [ ] Add external links for Privacy Policy and General Conditions (open in new tab)
- [ ] Display the version number from `__APP_VERSION__`

### Technical Details

**File:** `src/pages/AccountPage.tsx`

**Icons to add:** `Info`, `ExternalLink`, `FileText`, `Shield` from `lucide-react`

**Card structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Info className="h-5 w-5" />
      Over deze app
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Prana Mental Fitness — jouw persoonlijke tool voor mentale fitheid op het werk.
    </p>
    <div className="space-y-2">
      <a href="https://prana.be/privacy-policy" target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-2 text-sm text-primary hover:underline">
        <Shield className="h-4 w-4" /> Privacybeleid <ExternalLink className="h-3 w-3" />
      </a>
      <a href="https://prana.be/general-conditions" target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-2 text-sm text-primary hover:underline">
        <FileText className="h-4 w-4" /> Algemene voorwaarden <ExternalLink className="h-3 w-3" />
      </a>
    </div>
    <p className="text-xs text-muted-foreground">Versie {__APP_VERSION__}</p>
  </CardContent>
</Card>
```
