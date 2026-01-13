# Requirements: Account Page

## Overview

Transform Tab 3 into a user Account page where authenticated users can view their profile information including name, email address, and linked company name(s).

## User Story

As an authenticated user, I want to see my account details so that I can verify my profile information is correct.

## Acceptance Criteria

1. **Navigation Update**
   - Tab 3 in bottom navigation is renamed to "Account"
   - The User icon remains (already appropriate for Account)

2. **Account Page Content**
   - Display user's full name
   - Display user's email address
   - Display linked company name(s) (resolved from Airtable linked records)
   - Show appropriate placeholder if company is not linked

3. **Data Requirements**
   - Company names must be fetched from Airtable (not just IDs)
   - Handle users with no linked company gracefully
   - Handle users with multiple linked companies

4. **UI/UX**
   - Mobile-first design consistent with existing app style
   - Use shadcn/ui Card components for consistent styling
   - Include logout button for convenience

## Dependencies

- Existing auth system (AuthContext, useAuth hook)
- Airtable Companies/Bedrijf table (linked from Users)
- shadcn/ui components (Card, Button)

## Out of Scope

- Editing profile information
- Uploading profile photos
- Password change functionality
