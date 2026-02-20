# PWA Cache-Busting & Update Strategy

## Audit Summary

Audited the current PWA implementation against a best-practices checklist. All 5 core items were already in place. Three gaps in HTTP cache headers were identified and fixed.

## Checklist Results

| Item | Status | Location |
|---|---|---|
| `no-cache` headers on `sw.js` | PASS | `server.ts` — explicit `no-cache, no-store, must-revalidate` |
| `skipWaiting()` + `clientsClaim()` in SW | PASS | `src/sw.js` — called unconditionally |
| Listen for `updatefound` + reload | PASS | `PWAUpdatePrompt.tsx` — detects install, sends SKIP_WAITING, reloads on controllerchange |
| Bump cache version on deploy | PASS | Workbox `precacheAndRoute(self.__WB_MANIFEST)` auto-generates versioned manifest per build |
| Move to Workbox | PASS | Using `vite-plugin-pwa` with `injectManifest` strategy + Workbox |

## Additional Strengths

- **Periodic update checks** — every 60s + on app focus (`PWAUpdatePrompt.tsx`)
- **Version detection** — `useVersionCheck.ts` clears React Query cache on version/build hash change
- **Manual cache bust** — `useCacheBust.ts` provides `?bust=all|sw|rq` escape hatch
- **Debug panel** — `?debug=true` shows SW status, caches, and action buttons

## Gaps Fixed

### 1. `index.html` missing no-cache headers (Medium)

**Problem:** Served via SPA fallback with no `Cache-Control` header. Browser could heuristically cache it, delaying discovery of new JS bundles.

**Fix:** Added `Cache-Control: no-cache, no-store, must-revalidate` to the SPA fallback handler in `server.ts`.

### 2. `registerSW.js` missing no-cache headers (Low)

**Problem:** Served via `express.static` with default headers. Only matters for first visit.

**Fix:** Added dedicated route with `Cache-Control: no-cache, no-store, must-revalidate` in `server.ts` (same pattern as `sw.js`).

### 3. Hashed assets missing immutable cache headers (Low)

**Problem:** Vite outputs content-hashed filenames (e.g. `assets/index-ATbODqOH.js`) but they were served with Express defaults (no explicit cache header).

**Fix:** Added `/assets` static handler with `maxAge: 1y, immutable: true` in `server.ts`.

## Cache Header Strategy

| Path | Cache-Control | Reason |
|---|---|---|
| `sw.js` | `no-cache, no-store, must-revalidate` | Must always check for updates |
| `registerSW.js` | `no-cache, no-store, must-revalidate` | Registers SW, must not be stale |
| `index.html` (SPA fallback) | `no-cache, no-store, must-revalidate` | App shell references hashed bundles |
| `/assets/*` | `public, max-age=31536000, immutable` | Content-hashed filenames, safe to cache forever |
| Other static files | Express defaults | Favicon, manifest, etc. |
