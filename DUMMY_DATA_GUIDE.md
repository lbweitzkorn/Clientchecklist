# Dummy Data Guide

## How to Create Demo Timelines

Your application is ready to display timelines for all four event types. Here's how to create dummy data:

### Step 1: Seed Templates

1. Open your application in the browser
2. Click the **"Seed Templates"** button (usually on the homepage or admin section)
3. This will load all 4 templates into your database:
   - Wedding (48 tasks, 8 blocks)
   - Bar Mitzvah (46 tasks, 6 blocks)
   - Bat Mitzvah (49 tasks, 6 blocks)
   - Party (44 tasks, 6 blocks)

### Step 2: Create Demo Events

You can create demo events using the application interface or via API:

#### Wedding Demo
- **Event Code**: DEMO-WED-001
- **Title**: Sarah & David's Wedding
- **Date**: December 15, 2025
- **Venue**: The Grand Ballroom, London
- **Type**: Wedding
- **Template**: wedding

#### Bar Mitzvah Demo
- **Event Code**: DEMO-BAR-001
- **Title**: Joshua's Bar Mitzvah
- **Date**: November 8, 2025
- **Venue**: Beth Shalom Synagogue, Manchester
- **Type**: Bar Mitzvah
- **Template**: bar_mitzvah

#### Bat Mitzvah Demo
- **Event Code**: DEMO-BAT-001
- **Title**: Rebecca's Bat Mitzvah
- **Date**: October 25, 2025
- **Venue**: Emanuel Synagogue, Birmingham
- **Type**: Bat Mitzvah
- **Template**: bat_mitzvah

#### Party Demo
- **Event Code**: DEMO-PARTY-001
- **Title**: Emma's 40th Birthday Celebration
- **Date**: September 20, 2025
- **Venue**: The Warehouse Venue, Bristol
- **Type**: Party
- **Template**: party

### Step 3: View the Timelines

Once created, you'll be able to:

1. **View All Timelines** - See the list of all demo events
2. **Open Timeline Details** - Click on any event to see its full timeline with all blocks and tasks
3. **Check Tasks** - Mark tasks as complete to see progress indicators
4. **Share Links** - Generate shareable links for clients to view their timelines

### What You'll See

Each timeline will display:

#### Wedding Timeline (8 blocks)
- 12 months before
- 10 months before
- 8 months before
- 6 months before
- 4 months before
- 2 months before
- 1 month before
- 2 weeks before

#### Bar/Bat Mitzvah & Party Timelines (6 blocks each)
- 12 months before
- 8-10 months before
- 6-8 months before
- 3-4 months before
- 1-2 months before
- 2 weeks before

### Progress Tracking

Each timeline shows:
- **Progress Ring**: Visual indicator of completion percentage
- **Task Counts**: Number of completed vs total tasks
- **Weight-Based Progress**: Skeleton tasks (weight 3) count more than regular tasks (weight 1)
- **Completion Stats**: Real-time updates as you check off tasks

### Realistic Demo Data Features

To make the demo more realistic, you can:

1. **Complete Early Tasks**: Check off tasks from the "12 months before" block
2. **Leave Recent Tasks Unchecked**: Keep "2 weeks before" tasks incomplete
3. **Mix Progress**: Have 40-60% completion for a realistic in-progress event
4. **Add Due Dates**: Set due dates on important tasks
5. **Assign Tasks**: Use the assignee field (client, js, both) to show responsibility

### Quick SQL Insert (Alternative Method)

If you prefer to insert demo data via SQL, run this query:

```sql
-- Insert events
INSERT INTO events (code, title, date, venue, type) VALUES
  ('DEMO-WED-001', 'Sarah & David''s Wedding', '2025-12-15', 'The Grand Ballroom, London', 'wedding'),
  ('DEMO-BAR-001', 'Joshua''s Bar Mitzvah', '2025-11-08', 'Beth Shalom Synagogue, Manchester', 'bar_mitzvah'),
  ('DEMO-BAT-001', 'Rebecca''s Bat Mitzvah', '2025-10-25', 'Emanuel Synagogue, Birmingham', 'bat_mitzvah'),
  ('DEMO-PARTY-001', 'Emma''s 40th Birthday', '2025-09-20', 'The Warehouse Venue, Bristol', 'party');

-- Then use your app's "Create Timeline" feature for each event
```

### API Method (Using Edge Functions)

You can also create timelines programmatically:

```bash
# Wedding
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/timelines-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-WED-001", "templateKey": "wedding"}'

# Bar Mitzvah
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/timelines-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-BAR-001", "templateKey": "bar_mitzvah"}'

# Bat Mitzvah
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/timelines-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-BAT-001", "templateKey": "bat_mitzvah"}'

# Party
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/timelines-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-PARTY-001", "templateKey": "party"}'
```

### Next Steps

1. **Seed the templates** using the app interface
2. **Create the demo events** using any method above
3. **Generate timelines** from the templates
4. **Check off some tasks** to show realistic progress
5. **Generate share links** to show client-facing views

All demo data uses realistic venue names, dates, and event details from the UK events industry!
