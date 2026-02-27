# Apple-Style Polish Pass — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the UI to feel uniformly polished and Apple-like — clean shadows, consistent spacing, subtle micro-interactions — while keeping the existing color scheme.

**Architecture:** CSS-first approach. Changes flow from theme tokens → shared UI components → layout components → page-level fixes. No new components, no structural changes.

**Tech Stack:** Tailwind CSS v4 (with `@theme inline`), React, shadcn/ui components

---

### Task 1: Card Component — Shadow-Only Elevation

**Files:**
- Modify: `src/components/ui/card.tsx`

**Step 1: Update Card base classes**

Remove `border` class, keep `shadow-sm`, add transition for interactive cards:

```tsx
// In Card function, change className from:
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"
// To:
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 shadow-sm transition-shadow duration-200"
```

**Step 2: Update CardTitle typography**

```tsx
// In CardTitle, change className from:
"leading-none font-semibold"
// To:
"leading-snug font-semibold tracking-tight"
```

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass (no card-specific tests, but ensure nothing breaks)

**Step 4: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "refine: card shadow-only elevation, tighter title typography"
```

---

### Task 2: Button Component — Sizing & Press Feedback

**Files:**
- Modify: `src/components/ui/button.tsx`

**Step 1: Add press feedback to base styles**

In the `cva()` base string, append active scale and ensure duration:

```tsx
// Add to end of base cva string (before the comma):
"active:scale-[0.98]"
```

Full base string becomes:
```
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]"
```

**Step 2: Increase default button height**

In the `size` variants, change default from `h-9` to `h-10`:

```tsx
default: "h-10 px-4 py-2 has-[>svg]:px-3",
```

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "refine: larger default buttons, press feedback animation"
```

---

### Task 3: Input & Textarea — Rounded & Refined

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`

**Step 1: Update Input border-radius and height**

In `input.tsx`, change the className:
- `rounded-md` → `rounded-lg`
- `h-9` → `h-10`
- Add `focus-visible:shadow-md` after the existing focus-visible ring classes

```tsx
className={cn(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:shadow-md",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  className
)}
```

**Step 2: Update Textarea border-radius**

Read `src/components/ui/textarea.tsx` first, then change `rounded-md` → `rounded-lg`.

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "refine: larger rounded inputs, elevated focus state"
```

---

### Task 4: Dialog — Consistent Radius & Border Removal

**Files:**
- Modify: `src/components/ui/dialog.tsx`

**Step 1: Update DialogContent**

Change `rounded-lg` → `rounded-2xl` and remove `border`:

```tsx
// In DialogContent className, change:
"... border bg-background p-4 sm:p-6 shadow-lg ... rounded-lg"
// To:
"... bg-background p-5 sm:p-6 shadow-lg ... rounded-2xl"
```

Note: also standardize padding from `p-4` to `p-5`.

**Step 2: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "refine: dialog rounded-2xl, remove border, uniform padding"
```

---

### Task 5: AppHeader — More Breathing Room

**Files:**
- Modify: `src/components/AppHeader.tsx`

**Step 1: Update header height, padding, and remove border**

```tsx
// Change the header className from:
"sticky top-0 z-40 bg-white border-b border-border pt-safe"
// To:
"sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm pt-safe"

// Change the inner div from:
"flex items-center justify-between h-14 px-4"
// To:
"flex items-center justify-between h-16 px-5"
```

Key changes:
- `h-14` → `h-16` (more breathing room)
- `px-4` → `px-5` (consistent padding)
- `border-b border-border` → `shadow-sm` (shadow-only, matches card pattern)
- Add `bg-white/95 backdrop-blur-sm` for subtle scroll-under effect (not glass-morphism — just practical blur so content doesn't clash)

**Step 2: Bump subtitle text size**

```tsx
// Change:
<span className="text-[10px] text-muted-foreground">by Prana Mental Excellence</span>
// To:
<span className="text-xs text-muted-foreground">by Prana Mental Excellence</span>
```

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Visual verify via preview**

Start dev server, screenshot login → navigate to home → verify header looks balanced.

**Step 5: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "refine: header breathing room, shadow elevation, subtle blur"
```

---

### Task 6: BottomNav — Polished Tab Bar

**Files:**
- Modify: `src/components/BottomNav.tsx`

**Step 1: Update nav container — shadow instead of border**

```tsx
// Change nav className from:
"fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-safe"
// To:
"fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-safe"
```

**Step 2: Update tab labels and add active pill**

```tsx
// Change the NavLink className function from:
cn(
  "flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1",
  "text-muted-foreground transition-colors",
  isActive && "text-primary"
)
// To:
cn(
  "flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1",
  "text-muted-foreground transition-all duration-200 active:scale-95",
  isActive && "text-primary"
)

// Change label from:
<span className="text-[10px] mt-1 whitespace-nowrap">{label}</span>
// To:
<span className="text-xs mt-1 whitespace-nowrap">{label}</span>
```

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "refine: bottom nav shadow elevation, larger labels, tap feedback"
```

---

### Task 7: Page Container Consistency

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/ProgramsPage.tsx`
- Modify: `src/pages/MethodsPage.tsx`
- Modify: `src/pages/AccountPage.tsx`
- Modify: `src/pages/OvertuigingenPage.tsx`

**Step 1: Audit each page's outer container**

Read the first 30 lines of each page file. Identify the outermost wrapper `<div>` className. Standardize all to `px-5 py-6 space-y-6`.

For each page, if the current padding differs from `px-5 py-6 space-y-6`, update it.

Common patterns to fix:
- `px-4` → `px-5`
- `py-4` or `py-8` → `py-6`
- Missing `space-y-6` → add it

**Step 2: Run tests and verify**

Run: `npm test -- --run`
Expected: All tests pass

**Step 3: Visual verify via preview**

Screenshot each page to verify consistent spacing.

**Step 4: Commit**

```bash
git add src/pages/
git commit -m "refine: uniform page container padding across all pages"
```

---

### Task 8: Login Page Polish

**Files:**
- Modify: `src/pages/LoginPage.tsx`

**Step 1: Read LoginPage.tsx fully**

Understand the PWA tip card structure and form layout.

**Step 2: Reduce PWA tip visual weight**

- Make the tip card more subtle: reduce padding, use muted background, smaller text
- Ensure login form uses `px-5` container padding
- Ensure the email input and button use updated components (they'll inherit from Tasks 2-3)

**Step 3: Run tests and verify**

Run: `npm test -- --run`
Expected: LoginPage tests pass

**Step 4: Visual verify via preview**

Screenshot login page on mobile viewport.

**Step 5: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "refine: login page polish, subtler PWA tip"
```

---

### Task 9: Final Visual QA & Fix Pass

**Files:**
- Any files needing touch-ups

**Step 1: Full visual walkthrough**

Using preview tools, screenshot each page on mobile (375x812):
1. Login page
2. Home page
3. Programs page
4. Methods page
5. Mindset page
6. Account page

**Step 2: Identify and fix any remaining inconsistencies**

- Double-padding issues
- Cards that still show borders (from page-level overrides)
- Typography inconsistencies
- Any spacing that breaks the rhythm

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "refine: final QA pass for Apple-style polish"
```
