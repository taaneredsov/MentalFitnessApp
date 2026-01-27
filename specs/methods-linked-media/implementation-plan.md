# Implementation Plan: Methods with Linked Media

## Overview

Update the Methods feature to properly fetch media from the linked Media table instead of expecting attachments on the Methods table directly. Simplify the Method detail screen to show: name, duration, description, and playable media.

## Phase 1: Media Table Field Mappings

Add field mappings for the Media table and update the Methods field to reference linked media records.

### Tasks

- [x] Add MEDIA_FIELDS constant with field IDs from Media table
- [x] Update METHOD_FIELDS.media to use correct linked field ID
- [x] Create transformMedia function to transform media records

### Technical Details

**File: `api/_lib/field-mappings.js`**

Add Media table field mappings:
```javascript
// Media table field IDs (Media - tblwzDUwtnhFKw4kA)
export const MEDIA_FIELDS = {
  filename: "fld???",    // Bestandsnaam - file name
  type: "fld???",        // Type - video/audio
  file: "fld???"         // Bestand - actual file attachment
}
```

Update METHOD_FIELDS:
```javascript
media: "fld???",         // Media (Link to Media table) - get actual field ID
```

Add transformMedia function:
```javascript
export function transformMedia(record) {
  const fields = record.fields
  const file = fields[MEDIA_FIELDS.file]?.[0]

  return {
    id: record.id,
    filename: fields[MEDIA_FIELDS.filename],
    type: fields[MEDIA_FIELDS.type],  // "video" or "audio"
    url: file?.url
  }
}
```

## Phase 2: Update Methods API

Modify the methods API to fetch linked media records from the Media table.

### Tasks

- [x] Update `api/methods/[id].ts` to fetch linked media records from Media table
- [x] Update transformMethod to return media as linked record IDs

### Technical Details

**File: `api/methods/[id].ts`**

Update to fetch media from linked table:
```typescript
import { transformMethod, transformMedia, MEDIA_FIELDS } from "../_lib/field-mappings.js"

// In handler:
const method = transformMethod({ id: record.id, fields: record.fields } as any)

// Fetch media details if there are linked media
let mediaDetails: any[] = []
const mediaIds = method.media
if (mediaIds && mediaIds.length > 0) {
  const mediaRecords = await Promise.all(
    mediaIds.map((mediaId: string) =>
      base(tables.media).find(mediaId).catch(() => null)
    )
  )

  mediaDetails = mediaRecords
    .filter(Boolean)
    .map(r => transformMedia({ id: r!.id, fields: r!.fields } as any))
}

return sendSuccess(res, {
  ...method,
  mediaDetails
})
```

**File: `api/_lib/field-mappings.js`**

Update transformMethod (simplify - remove goals, experienceLevel, photo since not needed for display):
```javascript
export function transformMethod(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[METHOD_FIELDS.name],
    duration: fields[METHOD_FIELDS.duration] || 0,
    description: fields[METHOD_FIELDS.description],
    photo: fields[METHOD_FIELDS.photo]?.[0]?.thumbnails?.large?.url || fields[METHOD_FIELDS.photo]?.[0]?.url,
    media: fields[METHOD_FIELDS.media] || []  // Linked record IDs
  }
}
```

## Phase 3: Update Frontend Types and Detail Page

Update the MethodDetail type and simplify MethodDetailPage to show only required fields.

### Tasks

- [x] Update MethodDetail interface to include mediaDetails
- [x] Update MediaItem interface for linked media structure
- [x] Simplify MethodDetailPage to show: name, duration, description, media players

### Technical Details

**File: `src/types/program.ts`**

Update types:
```typescript
export interface MediaItem {
  id: string
  filename: string
  type: string  // "video" or "audio"
  url: string
}

export interface MethodDetail extends Method {
  mediaDetails?: MediaItem[]
}
```

**File: `src/pages/MethodDetailPage.tsx`**

Simplify to show only:
- Methode Naam (name) - as page title
- Duur (minuten) - duration in minutes
- Beschrijving - description text
- Media players - for all linked media

Remove:
- experienceLevel display
- Goals section
- Photo hero image (keep thumbnail in list only)

```tsx
return (
  <div className="px-4 py-6 space-y-6">
    <Button variant="ghost" onClick={() => navigate(-1)}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Terug
    </Button>

    {/* Title */}
    <h1 className="text-2xl font-bold">{method.name}</h1>

    {/* Duration */}
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>{method.duration} minuten</span>
    </div>

    {/* Description */}
    {method.description && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Beschrijving</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {method.description}
          </p>
        </CardContent>
      </Card>
    )}

    {/* Media */}
    {hasMedia && (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Media</h2>
        {method.mediaDetails!.map((item, index) => (
          <MediaPlayer key={index} media={item} />
        ))}
      </div>
    )}
  </div>
)
```

Update MediaPlayer component to use `type` field:
```tsx
function MediaPlayer({ media }: { media: MediaItem }) {
  const isAudio = media.type === "audio"
  const isVideo = media.type === "video"

  // ... render appropriate player based on type
}
```
