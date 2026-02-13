# Requirements: Over deze app (About this app)

## What

Add an "Over deze app" section to the Account page that displays general app information, links to legal pages, and the current app version number.

## Why

- Users need easy access to privacy policy and general conditions
- Displaying the version number helps debug issues on installed PWA instances on phones
- Version should auto-increment with every change for traceability

## Acceptance Criteria

1. A new "Over deze app" card appears on the Account page (before the logout button)
2. The card displays:
   - App name and brief description
   - Link to privacy policy: https://prana.be/privacy-policy (opens in new tab)
   - Link to general conditions: https://prana.be/general-conditions (opens in new tab)
3. The current version number is displayed (sourced from `package.json`)
4. Version is auto-incremented (patch bump) on every build via a pre-build script
5. Follows existing Card component patterns used on the Account page

## Dependencies

- Existing Account page (`src/pages/AccountPage.tsx`)
- Existing Card UI components
