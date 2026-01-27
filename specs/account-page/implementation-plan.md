# Implementation Plan: Account Page

## Overview

Transform Tab 3 into a full Account page that displays user details (name, email, company). Requires adding an API endpoint to resolve company IDs to names from Airtable linked records.

## Phase 1: Company Lookup API

Add an API endpoint to fetch company names by their Airtable record IDs.

### Tasks

- [x] Add company table configuration to Airtable client
- [x] Create GET /api/companies/lookup endpoint
- [x] Add company lookup function to frontend API client

### Technical Details

**Update `api/_lib/airtable.js`** - Add companies table:
```javascript
export const tables = {
  users: process.env.AIRTABLE_USER_TABLE_ID || "Users",
  companies: process.env.AIRTABLE_COMPANY_TABLE_ID || "Bedrijf"
}
```

**Create `api/companies/lookup.ts`**:
```typescript
// GET /api/companies/lookup?ids=rec123,rec456
// Returns: { success: true, data: { rec123: "Company A", rec456: "Company B" } }
```

The endpoint accepts comma-separated record IDs and returns a map of ID to company name.

**Update `src/lib/api-client.ts`**:
```typescript
companies: {
  lookup: (ids: string[]) =>
    request<Record<string, string>>(`/companies/lookup?ids=${ids.join(",")}`)
}
```

## Phase 2: Rename Tab 3 to Account

Update the bottom navigation to show "Account" instead of "Tab 3".

### Tasks

- [x] Update BottomNav tab label from "Tab 3" to "Account"

### Technical Details

**Update `src/components/BottomNav.tsx`**:
```typescript
const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/tab1", icon: Calendar, label: "Tab 1" },
  { path: "/tab2", icon: BookOpen, label: "Tab 2" },
  { path: "/account", icon: User, label: "Account" }  // Changed path and label
]
```

**Update `src/App.tsx`** route:
```typescript
<Route path="/account" element={<AccountPage />} />
```

## Phase 3: Account Page UI

Build the Account page component with user details display.

### Tasks

- [x] Create AccountPage component with user info display
- [x] Add company name fetching with useEffect
- [x] Add loading state for company lookup
- [x] Include logout button
- [x] Remove old Tab3Page component

### Technical Details

**Create `src/pages/AccountPage.tsx`**:
```typescript
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AccountPage() {
  const { user, logout } = useAuth()
  const [companyNames, setCompanyNames] = useState<string[]>([])
  const [loadingCompany, setLoadingCompany] = useState(false)

  useEffect(() => {
    if (user?.company?.length) {
      setLoadingCompany(true)
      api.companies.lookup(user.company)
        .then(data => setCompanyNames(Object.values(data)))
        .catch(() => setCompanyNames([]))
        .finally(() => setLoadingCompany(false))
    }
  }, [user?.company])

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Account</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company</p>
            {loadingCompany ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : companyNames.length > 0 ? (
              <p className="font-medium">{companyNames.join(", ")}</p>
            ) : (
              <p className="text-muted-foreground">No company linked</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={logout} variant="outline" className="w-full">
        Sign Out
      </Button>
    </div>
  )
}
```

**Update `src/pages/index.ts`**:
```typescript
export { AccountPage } from "./AccountPage"
// Remove Tab3Page export
```

**Delete `src/pages/Tab3Page.tsx`**
