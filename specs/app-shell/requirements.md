# Requirements: App Shell

## Overview

Create the main app shell with a bottom tab navigation (Home, Tab1, Tab2, Tab3), a simple homepage, and placeholder pages for each tab. This provides the core navigation structure for the PWA.

## Goals

1. Create bottom tab navigation component
2. Build homepage with user greeting
3. Create placeholder pages for Tab1, Tab2, Tab3
4. Implement smooth navigation between tabs
5. Add app header with logo/title

## UI Design

### Bottom Navigation
- Fixed at bottom of screen
- 4 tabs: Home, Tab1, Tab2, Tab3
- Active tab highlighted with accent color
- Icons + labels for each tab
- Safe area padding for iOS home indicator

### Homepage
- Greeting with user's name
- Simple card-based layout
- Quick action buttons (placeholders)
- Pull-to-refresh ready (for future)

### Tab Pages
- Tab1, Tab2, Tab3 are placeholder pages
- Each shows page title and "Coming soon" message
- Ready to be replaced with real content

## Acceptance Criteria

- [ ] Bottom navigation is fixed and always visible
- [ ] Active tab is visually highlighted
- [ ] Navigation works smoothly between all tabs
- [ ] Homepage displays user's name from auth context
- [ ] Safe area insets handled for iOS notch/home indicator
- [ ] Tab pages are accessible and render correctly
- [ ] Navigation state persists across page refreshes (via URL)

## Dependencies

- `project-setup` - Base project and shadcn/ui
- `auth-system` - User data for homepage greeting

## Related Features

- Future features will replace Tab1, Tab2, Tab3 content
