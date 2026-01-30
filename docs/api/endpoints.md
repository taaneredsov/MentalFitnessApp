# API Reference

All API endpoints are available at `/api/*`. In development, they run as Vercel Serverless Functions. In production, they're served by an Express server.

## Response Format

All responses follow this format:

```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

## Authentication

Most endpoints require a JWT access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /api/auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "recXXX",
      "name": "John Doe",
      "email": "user@example.com",
      "company": ["recYYY"],
      "role": "User",
      "languageCode": "nl",
      "profilePhoto": "https://...",
      "createdAt": "2024-01-15",
      "lastLogin": "2024-06-20"
    },
    "accessToken": "eyJ..."
  }
}
```

**Response (First-time user):**
```json
{
  "success": true,
  "data": {
    "needsPasswordSetup": true,
    "userId": "recXXX",
    "email": "user@example.com"
  }
}
```

Also sets `refreshToken` as httpOnly cookie (7 days).

### POST /api/auth/logout

Clear the refresh token cookie.

**Response:**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

### POST /api/auth/refresh

Refresh the access token using the refresh token cookie.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ..."
  }
}
```

### GET /api/auth/me

Get the current authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recXXX",
    "name": "John Doe",
    "email": "user@example.com",
    ...
  }
}
```

### POST /api/auth/set-password

Set password for first-time users.

**Request Body:**
```json
{
  "userId": "recXXX",
  "password": "newPassword123"
}
```

### POST /api/auth/magic-link

Request a magic link email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Als dit email adres bij ons bekend is, ontvang je een login link"
  }
}
```

### GET /api/auth/verify

Verify a magic link token.

**Query Parameters:**
- `token` - The magic link token from the email

**Response:** Same as login success (returns user + accessToken).

### POST /api/auth/verify-code

Verify a 6-digit magic link code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

---

## User Endpoints

### POST /api/users

Create a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "recXXX"
}
```

### GET /api/users/lookup

Find user by email.

**Query Parameters:**
- `email` - Email address to look up

### GET /api/users/:id

Get user by ID.

**Headers:** `Authorization: Bearer <token>`

### PATCH /api/users/:id

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "languageCode": "en"
}
```

### POST /api/users/change-password

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

---

## Program Endpoints

### GET /api/programs

Get all programs for a user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `userId` - User record ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXXX",
      "name": "Programma #1",
      "startDate": "2024-06-01",
      "endDate": "2024-06-28",
      "duration": "4 weken",
      "daysOfWeek": ["recMon", "recWed", "recFri"],
      "frequency": 3,
      "goals": ["recGoal1"],
      "methods": ["recMethod1", "recMethod2"],
      "totalMethods": 24,
      "completedMethods": 12,
      "milestonesAwarded": ["25", "50"]
    }
  ]
}
```

### POST /api/programs

Create a new program manually.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "recXXX",
  "startDate": "2024-06-01",
  "duration": "4 weken",
  "daysOfWeek": ["recMon", "recWed"],
  "goals": ["recGoal1"],
  "methods": ["recMethod1"]
}
```

### GET /api/programs/:id

Get program details with enriched data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recXXX",
    "name": "Programma #1",
    "startDate": "2024-06-01",
    "endDate": "2024-06-28",
    "duration": "4 weken",
    "goalDetails": [
      { "id": "recGoal1", "name": "Stressreductie", "description": "..." }
    ],
    "methodDetails": [
      { "id": "recMethod1", "name": "Ademhaling", "duration": 10, "photo": "..." }
    ],
    "dayNames": ["Maandag", "Woensdag", "Vrijdag"],
    "schedule": [
      {
        "id": "recSched1",
        "date": "2024-06-03",
        "methodIds": ["recMethod1"],
        "isCompleted": true,
        "completedMethodIds": ["recMethod1"]
      }
    ],
    "totalSessions": 12,
    "completedSessions": 6,
    "totalMethods": 24,
    "completedMethods": 12,
    "milestonesAwarded": ["25", "50"]
  }
}
```

### PATCH /api/programs/:id

Update a program.

### DELETE /api/programs/:id

Delete a program.

### GET /api/programs/:id/methods

Get methods for a specific program day.

**Query Parameters:**
- `date` - Date in YYYY-MM-DD format

### POST /api/programs/preview

Generate an AI program preview without saving.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "recXXX",
  "goals": ["recGoal1", "recGoal2"],
  "startDate": "2024-06-01",
  "duration": "4 weken",
  "daysOfWeek": ["recMon", "recWed", "recFri"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "aiSchedule": [
      {
        "date": "2024-06-03",
        "dayOfWeek": "Maandag",
        "dayId": "recMon",
        "methods": [
          { "methodId": "recMethod1", "methodName": "Ademhaling", "duration": 10 }
        ]
      }
    ],
    "weeklySessionTime": 75,
    "recommendations": ["Tip 1", "Tip 2"],
    "programSummary": "Dit programma...",
    "availableMethods": [...],
    "selectedGoals": [...]
  }
}
```

### POST /api/programs/confirm

Save an AI-generated program (after preview and optional edits).

**Request Body:**
```json
{
  "userId": "recXXX",
  "goals": ["recGoal1"],
  "startDate": "2024-06-01",
  "duration": "4 weken",
  "daysOfWeek": ["recMon", "recWed"],
  "editedSchedule": [...],
  "programSummary": "..."
}
```

### POST /api/programs/generate

Generate and immediately save an AI program (without preview step).

### POST /api/programs/:id/regenerate-schedule

Regenerate future sessions when program days or goals change.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "daysOfWeek": ["recMon", "recWed", "recFri"],
  "goals": ["recGoal1", "recGoal2"],
  "regenerateMethod": "ai",
  "force": false
}
```

**Parameters:**
- `daysOfWeek` - (Required) Array of day record IDs for new schedule
- `goals` - (Optional) Array of goal record IDs. If omitted, uses existing goals.
- `regenerateMethod` - (Required) `"ai"` for AI-generated schedule, `"simple"` for even distribution
- `force` - (Optional) Force delete future sessions with completed activities. Default `false`.

**Response:**
```json
{
  "success": true,
  "data": {
    "program": { ... },
    "preservedSessions": 5,
    "regeneratedSessions": 8,
    "deletedSessions": 8,
    "newSchedule": [
      {
        "date": "2026-02-03",
        "dayOfWeek": "Maandag",
        "dayId": "recMon",
        "methods": [
          { "methodId": "recMethod1", "methodName": "Ademhaling", "duration": 10 }
        ]
      }
    ]
  }
}
```

**Behavior:**
1. Sessions with date <= today are preserved
2. Future sessions are deleted
3. New schedule is generated based on `regenerateMethod`:
   - `"ai"` - Uses GPT-4o with edit context (completed methods, preserved count)
   - `"simple"` - Evenly distributes existing methods across new dates
4. New Programmaplanning records are created
5. Program record is updated with new daysOfWeek and goals

**Errors:**
- `400` - Invalid request body or missing daysOfWeek
- `401` - Unauthorized
- `403` - Not owner of program
- `404` - Program not found
- `409` - Future sessions have completed activities (use `force: true` to override)

### PATCH /api/programs/:id/schedule/:planningId

Update a specific session's methods.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "methods": ["recMethod1", "recMethod2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recSched1",
    "date": "2026-02-03",
    "methodIds": ["recMethod1", "recMethod2"],
    ...
  }
}
```

---

## Method Endpoints

### GET /api/methods

Get all methods.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXXX",
      "name": "Ademhaling",
      "duration": 10,
      "description": "...",
      "experienceLevelIds": ["recBeginner"],
      "optimalFrequency": ["Dagelijks"],
      "linkedGoalIds": ["recGoal1"],
      "photo": "https://...",
      "media": ["recMedia1"]
    }
  ]
}
```

### GET /api/methods/:id

Get method details with media.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recXXX",
    "name": "Ademhaling",
    "duration": 10,
    "description": "...",
    "photo": "https://...",
    "mediaDetails": [
      {
        "id": "recMedia1",
        "filename": "ademhaling.mp4",
        "type": "video",
        "url": "https://..."
      }
    ]
  }
}
```

### GET /api/methods/habits

Get methods linked to "Goede gewoontes" goal.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXXX",
      "name": "Dankbaarheid",
      "description": "..."
    }
  ]
}
```

---

## Method Usage Endpoints

### GET /api/method-usage

Get method usage records.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `userId` - User ID
- `programId` - (Optional) Filter by program

### POST /api/method-usage

Record method completion.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "recXXX",
  "methodId": "recMethod1",
  "programmaplanningId": "recSched1",
  "date": "2024-06-03",
  "remark": "Voelde goed!"
}
```

### GET /api/method-usage/by-program

Get recent method usage for a program.

**Query Parameters:**
- `programId` - Program ID
- `limit` - (Optional) Number of records to return

---

## Habit Usage Endpoints

### GET /api/habit-usage

Get completed habits for a date.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `userId` - User ID
- `date` - Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": ["recMethod1", "recMethod2"]
}
```

### POST /api/habit-usage

Mark a habit as completed.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "recXXX",
  "methodId": "recMethod1",
  "date": "2024-06-03"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recUsage1",
    "pointsAwarded": 5
  }
}
```

### DELETE /api/habit-usage

Remove a habit completion (uncheck).

**Query Parameters:**
- `userId` - User ID
- `methodId` - Method ID
- `date` - Date in YYYY-MM-DD format

---

## Personal Goals Endpoints

### GET /api/personal-goals

Get all active personal goals for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `userId` - (Optional) User ID. Defaults to authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recGoal1",
      "name": "Speak up in meeting",
      "description": "Share my opinion at least once per meeting",
      "status": "Actief",
      "userId": "recXXX",
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

**Security:** Users can only view their own goals (403 if accessing another user's goals).

### POST /api/personal-goals

Create a new personal goal.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Take a 10-minute walk",
  "description": "During lunch break or between meetings"
}
```

**Validation:**
- `name`: Required, 1-200 characters
- `description`: Optional, max 1000 characters
- Maximum 10 active goals per user

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recNewGoal",
    "name": "Take a 10-minute walk",
    "description": "During lunch break or between meetings",
    "status": "Actief",
    "userId": "recXXX",
    "createdAt": "2026-01-30T14:20:00.000Z"
  }
}
```

**Errors:**
- `400` - Validation error or maximum goals limit reached
- `401` - Unauthorized

### PATCH /api/personal-goals/:id

Update an existing personal goal.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated goal name",
  "description": "Updated description"
}
```

**Security:** Users can only update their own goals (403 if not owner).

### DELETE /api/personal-goals/:id

Archive a personal goal by setting status to "Gearchiveerd".

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Personal goal archived"
  }
}
```

**Security:** Users can only delete their own goals (403 if not owner).

### GET /api/personal-goal-usage

Get completion counts for all personal goals.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `userId` - (Optional) User ID. Defaults to authenticated user.
- `date` - (Required) Date in YYYY-MM-DD format

**Request:**
```
GET /api/personal-goal-usage?userId=recXXX&date=2026-01-30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recGoal1": {
      "today": 3,
      "total": 45
    },
    "recGoal2": {
      "today": 0,
      "total": 12
    }
  }
}
```

**Security:** Users can only view their own usage (403 if accessing another user's data).

### POST /api/personal-goal-usage

Record a goal completion and award 10 bonus points.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "recXXX",
  "personalGoalId": "recGoal1",
  "date": "2026-01-30"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recUsage123",
    "pointsAwarded": 10,
    "todayCount": 4,
    "totalCount": 46
  }
}
```

**Side Effects:**
1. Creates usage record in Airtable
2. Awards 10 bonus points to user
3. Updates user's streak (if new day)
4. Updates user's `lastActiveDate`

**Security:** Users can only create completions for their own goals (403 if not owner).

**Errors:**
- `400` - Invalid request body
- `403` - Goal doesn't belong to user
- `404` - Goal not found

**Note:** Allows multiple completions per day (no uniqueness constraint).

---

## Rewards Endpoints

### GET /api/rewards

Get current user's reward data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPoints": 350,
    "bonusPoints": 50,
    "currentStreak": 7,
    "longestStreak": 14,
    "lastActiveDate": "2024-06-20",
    "badges": ["eerste_sessie", "vijf_methodes", "week_streak"],
    "level": 4
  }
}
```

### POST /api/rewards/award

Award points for completing an activity.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "activityType": "method",
  "activityId": "recXXX",
  "methodsCompleted": 5,
  "programId": "recProgram1",
  "milestone": 25
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pointsAwarded": 25,
    "newTotal": 375,
    "newBadges": ["kwart_programma"],
    "levelUp": false,
    "newLevel": 4,
    "currentStreak": 8,
    "longestStreak": 14,
    "milestone": 25
  }
}
```

---

## Supporting Endpoints

### GET /api/goals

Get all goals.

### GET /api/days

Get days of the week.

### GET /api/companies/lookup

Look up company by name.

**Query Parameters:**
- `name` - Company name

### POST /api/cache/invalidate

Clear all caches (admin).

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-06-20T12:00:00Z"
  }
}
```

---

## Airtable Schema

### Tables (Dutch Names)

| Table ID | Dutch Name | English |
|----------|------------|---------|
| tbl6i8jw3DNSzcHgE | Gebruikers | Users |
| tblUIwqUiARc2VZPU | Bedrijven | Companies |
| tblB0QvbGg3zWARt4 | Methodes | Methods |
| tbl6ngkyNrv0LFzGb | Doelstellingen | Goals |
| tblqW4xeCx1tprNgX | Mentale Fitnessprogramma's | Programs |
| tblktNOXF3yPPavXU | Methodegebruik | Method Usage |
| tbl2PHUaonvs1MYRx | Programmaplanning | Program Schedule |
| tblpWiRiseAZ7jfHm | Gewoontegebruik | Habit Usage |
| tblS3gleG8cSlWOJ3 | Dagen van de week | Days of Week |
| tblt5lzx2Msw1aKxv | Ervaringsniveaus | Experience Levels |
| tblwzDUwtnhFKw4kA | Media | Media |
| tblHmI6cSujof3KHu | Programma opbouw prompts | Program Prompts |

### User Fields (Gebruikers)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldIK4uXpJluMZwEg | Naam | Name | Single line text |
| fldybwT82FkYEDN2j | E-mailadres | Email | Email |
| fldjzJzy8mvpU39Jz | Paswoord Hash | Password Hash | Single line text |
| fldGQhjGFIdZMY5Xj | Aangemaakt op | Created At | Created time (computed) |
| fldMlP3KCqMwJeXbN | Laatste login | Last Login | Date |
| fldnaYqcZHVHpH1RT | Bedrijf | Company | Linked record |
| fldu0CiOBgfDlZ7HI | Rol | Role | Single line text |
| fldMQEv7JI5PjNeyk | Taalcode | Language Code | Single line text |
| fldqdOOgdgZUla8Ub | Profielfoto | Profile Photo | Attachment |
| fldRcrVTHrvSUe1Mh | Totaal Punten | Total Points | Formula |
| fldnTqsjBrzV37WPG | Bonus Punten | Bonus Points | Number |
| fldDsfIZH929xN30H | Huidige Streak | Current Streak | Number |
| fldUI14lfcoJAI329 | Langste Streak | Longest Streak | Number |
| fldwl4wC7pT4hKZVN | Laatste Actieve Dag | Last Active Date | Date |
| fldMbIUw4uzjNKYy9 | Badges | Badges | Long text (JSON) |
| fldBp9BHyhbiGxK8V | Niveau | Level | Number |
| fldjMwmUXqn0AmmXB | Magic Link Token | Magic Link Token | Single line text |
| fldQxk69kS7coP4Ih | Magic Link Code | Magic Link Code | Single line text |
| fld44oMkQTlsuLxVq | Magic Link Expiry | Magic Link Expiry | Single line text |

### Program Fields (Mentale Fitnessprogramma's)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldzeEtEfVRM3qXzp | ID | ID | AutoNumber |
| fldKHAHbREuKbbi1N | Programma ID | Program ID | Formula |
| fldDc1mJUjBl2y7Hy | Gebruiker | User | Link |
| fldY5UGS0XSd1eUxu | Startdatum | Start Date | Date |
| fld3mrRTtqPX2a1fX | Duur van programma | Duration | Single select |
| fld2zTiRAKOXTenP4 | Einddatum Programma | End Date | Formula |
| fldC9mH8v5UjLSPVU | Dagen van de week | Days of Week | Link |
| fldIGX4ZfG9LyYgMt | Frequentie per week | Frequency | Count |
| fldo1Lc26dqEkUkwU | Doelstellingen | Goals | Link |
| fldvcpSF78ATEk12U | Mentale methode | Methods | Link |
| fldAUf1ENHtF8NRPl | Notities | Notes | Long text |
| fldXNUYtU4KG84ZMX | Methodegebruik | Method Usage | Link |
| fldQu0mHYeNj4mury | Behaalde Mijlpalen | Milestones Awarded | Long text (JSON) |
| fldJcgvXDr2LDin14 | Status | Status | Single select (Actief/Gepland/Afgewerkt) |
| fldC7QjG65RAnplH2 | Type Programma Creatie | Creation Type | Single select (Manueel/AI) |

### Method Fields (Methodes)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldXP3qNngK3oXEjR | Methode Naam | Method Name | Single line text |
| fldg3pJ3mtwBTVtd8 | Duur (minuten) | Duration | Number |
| fldW7tdp7AJoeKerd | Beschrijving | Description | Long text |
| fldKppvap3PVPlMq8 | Ervaringsniveau | Experience Level | Link |
| fldX9SfbkhYUuRC3T | Optimale frequentie | Optimal Frequency | Multiple select |
| fldymisqDYdypLbUc | Doelstellingen | Linked Goals | Link |
| fldT64jU7CfcgTe0y | Foto | Photo | Attachment |
| fldobaP1oS9uZKTh2 | Media | Media | Link |

### Programmaplanning Fields

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldufZbBLil7jDKnj | Planning ID | Planning ID | Single line text |
| fldTPzVYhmSBxYRa3 | Mentale Fitnessprogramma | Program | Link |
| fldvqnZDdjaVxB25H | Datum | Date | Date |
| fldxC8uxRqMdS7InU | Dag van de week | Day of Week | Link |
| fldnY9fKqbItJVxel | Beschrijving van sessie(s) | Session Description | Long text |
| fldxQn8r2ySIFs4pg | Beoogde methodes | Methods | Link |
| fld2Xyx6dzgSMR7Yy | Doelstelling(en) | Goals | Link |
| fldoxGlLYZ5NI60hl | Methodegebruik | Method Usage | Link |
| fld28cHcjefZFQr9P | Opmerkingen | Notes | Long text |

### Habit Usage Fields (Gewoontegebruik)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fld0kGrTAfzCg35Zb | Gebruikers | User | Link |
| fldXY6F1q5UM4e148 | Methodes | Method | Link |
| fldL34wbT2NxYPUKh | Datum | Date | Date |

### Personal Goal Fields (Persoonlijke doelen)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldJgnovQb0fukTHy | Naam | Name | Single line text |
| fldIa30JSumth6urq | Beschrijving | Description | Long text |
| fld430TQiorQDQqfT | Gebruikers | User | Link |
| fldppY7CetkUqYeTU | Status | Status | Single select (Actief/Gearchiveerd) |
| fldVYfcER59IGdFg8 | Aangemaakt op | Created At | Created time (computed) |

### Personal Goal Usage Fields (Persoonlijk Doelgebruik)

| Field ID | Dutch Name | English | Type |
|----------|------------|---------|------|
| fldlSHZh0ECrWMRV9 | Gebruikers | User | Link |
| fldGwiJAk7FRirOqY | Persoonlijke doelen | Personal Goal | Link |
| fldC2lY17qPmMsI5x | Datum | Date | Date (YYYY-MM-DD) |

---

## Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Not allowed to access resource |
| 404 | Not Found - Resource doesn't exist |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |
