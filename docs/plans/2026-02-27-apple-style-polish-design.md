# Apple-Style Polish Pass — Design Doc

**Date:** 2026-02-27
**Scope:** UI refinement pass — uniformity, decluttering, premium feel
**Constraints:** Keep current color scheme. No glass-morphism. No layout restructuring.

## Goals

- Uniform shadows, typography, spacing, and radius across the entire app
- Remove visual clutter (unnecessary borders, inconsistent padding)
- Add subtle micro-interactions for premium tactile feel
- Achieve Apple-like cleanliness without changing the app's identity

## 1. Theme & Design Tokens

### Shadows — 3-tier system
| Tier | Use | Value |
|-|-|-|
| `shadow-sm` | Cards at rest | Soft, diffused — default card elevation |
| `shadow-md` | Hover/focus states | Medium elevation for interactive feedback |
| `shadow-lg` | Dialogs/modals only | Strong elevation for overlays |

Cards use shadow-only elevation — no visible borders.

### Typography
| Element | Style |
|-|-|-|
| Page headings | `font-semibold tracking-tight` |
| Section headings | `font-semibold` |
| Body text | `font-normal leading-relaxed` |
| UI labels | `font-medium text-sm` |
| Nav labels | `text-xs` (up from `text-[10px]`) |
| Muted/helper text | `text-sm text-muted-foreground` |

Font family unchanged (system-ui stack). Base size unchanged (17px).

### Spacing — Consistent rhythm
| Context | Value |
|-|-|
| Page container horizontal padding | `px-5` |
| Page container vertical padding | `py-6` |
| Section gaps | `space-y-6` |
| Card internal padding | `p-5` uniform |

### Border Radius
- Cards: `rounded-xl` (unchanged, already good)
- Inputs/textareas: `rounded-md` → `rounded-lg`
- Buttons: keep `rounded-md`
- Dialogs: `rounded-2xl`

## 2. Shared Components

### Card (`src/components/ui/card.tsx`)
- Remove `border` class — shadow-only elevation
- Uniform `p-5` padding (simplify header/content/footer padding)
- Add `transition-shadow duration-200` base
- Hover: `hover:shadow-md` where interactive

### Button (`src/components/ui/button.tsx`)
- Default height: `h-9` → `h-10` for primary actions
- Add press feedback: `active:scale-[0.98] transition-all duration-150`
- Keep all existing variants

### Input (`src/components/ui/input.tsx`)
- `rounded-md` → `rounded-lg`
- Focus: `focus-visible:shadow-md` for elevation effect
- Consider subtle background fill (`bg-muted/50`) instead of visible border

### Textarea
- `rounded-md` → `rounded-lg`
- Match input focus behavior

### Dialog (`src/components/ui/dialog.tsx`)
- Ensure `rounded-2xl` on content
- `shadow-lg` on overlay content

## 3. Layout Components

### Header (`AppHeader`)
- Height: `h-14` → `h-16`
- Padding: ensure `px-5`

### Bottom Nav (`BottomNav`)
- Labels: `text-[10px]` → `text-xs`
- Active tab: subtle background pill (`bg-primary/10 rounded-full`)
- Tap feedback: `active:scale-95 duration-150`

## 4. Page-Level Cleanup

All pages adopt standard container: `px-5 py-6 space-y-6`

- Remove one-off spacing overrides
- Prevent double-padding (card padding + container padding)
- Login page: reduce visual weight of PWA tip card
- HomePage: consistent card spacing and section headers

## 5. Animations & Transitions

| Element | Transition |
|-|-|
| Cards | `transition-shadow duration-200` |
| Buttons | `transition-all duration-150` (scale + color) |
| Progress bars | `transition-all duration-500 ease-out` |
| Nav items | `transition-colors duration-200` |
| Interactive elements | `duration-200 ease-out` default |

No bouncy/spring effects. Apple-restrained subtlety.

## 6. Explicitly Out of Scope

- No glass-morphism
- No color palette changes
- No font family changes
- No layout restructuring
- No new components
- No feature changes
