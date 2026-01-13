# Requirements: Methods with Linked Media

## Overview

Update the Methodes feature to fetch media from a separate linked Media table (`tblwzDUwtnhFKw4kA`) instead of expecting attachments directly on the Methods table. Each method can have multiple linked media items, which should all be playable in the app.

## Current State

- Methods table (`tblB0QvbGg3zWARt4`) exists with basic fields
- Media table (`tblwzDUwtnhFKw4kA`) exists as a separate table with fields:
  - `Bestandsnaam` - file name
  - `Type` - video/audio
  - `Bestand` - the actual file attachment
- MethodsPage and MethodDetailPage created but using incorrect field mapping

## Requirements

### Data Model

1. **Methods table** has a linked field pointing to Media table
2. **Media table** (`tblwzDUwtnhFKw4kA`) contains:
   - `Bestandsnaam` - File name (used to link method to program)
   - `Type` - Media type ("video" or "audio")
   - `Bestand` - Attachment field with actual media file
3. Each method can link to multiple media items

### User Experience

1. **MethodsPage** displays all methods in a grid with:
   - Thumbnail (Foto)
   - Name (Methode Naam)
   - Duration (Duur minuten)
   - Experience level (Ervaringsniveau)

2. **MethodDetailPage** shows:
   - **Methode Naam** - Method name as page title
   - **Duur (minuten)** - Duration in minutes
   - **Beschrijving** - Full description text
   - **Media** - All linked media items with playable players

3. Audio files show audio player controls
4. Video files show video player with controls

## Acceptance Criteria

- [ ] MEDIA_FIELDS added to `field-mappings.js` with correct field IDs
- [ ] METHOD_FIELDS.media updated with correct linked field ID
- [ ] Methods API fetches linked media records from Media table
- [ ] MethodDetailPage displays: name, duration, description, media
- [ ] Audio files (type: "audio") are playable with audio controls
- [ ] Video files (type: "video") are playable with video controls
- [ ] Multiple media items per method are supported

## Dependencies

- Existing Methods feature (already created)
- Airtable base with Media table (`tblwzDUwtnhFKw4kA`)

## Related Features

- Mental Fitness Programs (methods are linked to programs)
