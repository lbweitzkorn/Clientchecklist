# JS Live Event Timeline API Documentation

## Overview

This system provides interactive, weighted checklists for events (Wedding, Bar Mitzvah, Bat Mitzvah, Party) with client-shareable links and progress tracking.

## Setup

### 1. Seed Templates

Load the four event templates into the database:

```bash
# Via the UI: Click "Seed Templates" button on the homepage
# Or via API:
POST {SUPABASE_URL}/functions/v1/templates-seed
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json

{
  "templates": [...] # Content from seed-templates.json
}
```

Response:
```json
{
  "success": true,
  "counts": {
    "templates": 4,
    "blocks": 32,
    "tasks": 200
  }
}
```

### 2. Create Timeline from JS Live

Webhook endpoint to create a timeline from JS Live system:

```bash
POST {SUPABASE_URL}/functions/v1/timelines-create
Content-Type: application/json

{
  "event": {
    "id": "optional-uuid",
    "code": "JS1234",
    "title": "Sarah & David's Wedding",
    "date": "2025-06-15",
    "venue": "Grand Hotel",
    "type": "wedding"
  }
}
```

Response:
```json
{
  "timelineId": "uuid",
  "shareUrl": "https://your-app.com/timeline?token=...",
  "token": "secure-token"
}
```

## API Endpoints

### Get Timeline Details

```bash
GET {SUPABASE_URL}/functions/v1/timelines/{timelineId}
Authorization: Bearer {SUPABASE_ANON_KEY}
```

Returns complete timeline with all blocks and tasks, sorted by order.

### Update Task

```bash
PUT {SUPABASE_URL}/functions/v1/timelines/{timelineId}/tasks/{taskId}
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json

{
  "done": true,
  "assignee": "client",
  "due_date": "2025-05-01",
  "weight": 3,
  "actor": "admin"
}
```

Creates an audit entry automatically.

### Generate Share Link

```bash
POST {SUPABASE_URL}/functions/v1/timelines/{timelineId}/share
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json

{
  "expiresInDays": 90
}
```

Response:
```json
{
  "url": "https://your-app.com/timeline?token=...",
  "token": "secure-token",
  "expiresAt": "2025-12-31T00:00:00Z"
}
```

## Features Implemented

### ✅ Core Functionality
- Database schema with templates, events, timelines, blocks, tasks, share links, and audit entries
- Seed loader for four event templates (Wedding, Bar Mitzvah, Bat Mitzvah, Party)
- Webhook endpoint for creating timelines from JS Live
- Weighted progress calculation (skeleton tasks = 3 points, normal = 1 point)
- Admin timeline list and detail views
- Public client view with token-based access
- Task assignments (client, js, both) with permissions
- Audit trail for all task changes

### ✅ User Interface
- Admin timeline list with search and overview
- Admin timeline detail with expandable blocks and progress rings
- Client view with themed backgrounds and toggle control
- Progress visualization per block and overall timeline
- Mobile-responsive design with large tap targets

### ✅ Security
- Row Level Security (RLS) policies for all tables
- Token-based share links with expiration (90 days default)
- Client can only toggle client/both tasks
- Admin has full access with authentication

### 🚧 Export Functionality (Not Yet Implemented)

The following export features are specified but not yet implemented:

- PDF export (Status/Full modes)
- DOCX export with watermarked backgrounds
- CSV export with all data points
- Background inclusion toggle
- Audit log inclusion toggle

To implement exports, you'll need to:
1. Create an Edge Function using a library like Puppeteer (PDF) or docx (DOCX)
2. Add CSV generation logic
3. Wire up the export buttons in the UI

## Data Model

### Task Weights & Progress
- Default task weight: 1
- Skeleton task weight: 3
- Progress = (completed weight / total weight) × 100

### Assignee Types
- `client`: Client-only tasks
- `js`: JustSeventy-only tasks (clients cannot toggle)
- `both`: Shared responsibility

### Audit Actions
- `check`: Task marked complete
- `uncheck`: Task marked incomplete
- `edit`: Task properties changed
- `create`: Task created

## Usage Flow

1. **Seed Templates** (one-time): Load the four event templates
2. **JS Live Webhook**: When event is created in JS Live, webhook creates timeline
3. **Admin Management**: Admin views timeline, updates tasks, generates share link
4. **Client Access**: Client uses share link to view and check off their tasks
5. **Progress Tracking**: Both admin and client see real-time weighted progress
6. **Audit Trail**: All changes are logged with actor and timestamp

## Environment Variables

Required in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Edge Functions automatically have access to:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing the System

1. Start the dev server: `npm run dev`
2. Visit the homepage and click "Seed Templates"
3. Use the webhook API to create a test timeline
4. View the timeline in admin mode
5. Generate a client share link
6. Open the client link in a new browser/incognito window
7. Toggle some client/both tasks and see progress update

## Notes

- Share links expire after 90 days (configurable)
- Skeleton tasks are marked with orange "Key Task" badges
- Progress rings use color coding: gray < 25%, orange < 50%, blue < 75%, green ≥ 75%
- Client view includes themed background with blur overlay for readability
- All times are stored in UTC (timestamptz)
