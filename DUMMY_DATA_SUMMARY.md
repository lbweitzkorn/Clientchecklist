# Dummy Data - Ready to View

## ✅ Demo Events Created

Four demo events have been created in your database, one for each event type:

### 1. Wedding Demo
- **Code**: `DEMO-WED-001`
- **Title**: Sarah & David's Wedding
- **Date**: December 15, 2025
- **Venue**: The Grand Ballroom, London
- **Type**: wedding
- **Template**: Wedding 12-Month Timeline (48 tasks across 8 blocks)

### 2. Bar Mitzvah Demo
- **Code**: `DEMO-BAR-001`
- **Title**: Joshua's Bar Mitzvah
- **Date**: November 8, 2025
- **Venue**: Beth Shalom Synagogue, Manchester
- **Type**: bar_mitzvah
- **Template**: Bar Mitzvah 12-Month Timeline (46 tasks across 6 blocks)

### 3. Bat Mitzvah Demo
- **Code**: `DEMO-BAT-001`
- **Title**: Rebecca's Bat Mitzvah
- **Date**: October 25, 2025
- **Venue**: Emanuel Synagogue, Birmingham
- **Type**: bat_mitzvah
- **Template**: Bat Mitzvah 12-Month Timeline (49 tasks across 6 blocks)

### 4. Party Demo
- **Code**: `DEMO-PARTY-001`
- **Title**: Emma's 40th Birthday Celebration
- **Date**: September 20, 2025
- **Venue**: The Warehouse Venue, Bristol
- **Type**: party
- **Template**: Party 12-Month Timeline (44 tasks across 6 blocks)

---

## 🚀 How to View the Dummy Data

### Step 1: Seed the Templates

**First, you need to seed the templates into your database:**

1. Open your application in the browser
2. Look for a **"Seed Templates"** button or admin function
3. Click it to load all 4 templates with their complete task structures

**What gets seeded:**
- ✅ Wedding template (48 tasks, 8 blocks)
- ✅ Bar Mitzvah template (46 tasks, 6 blocks)  
- ✅ Bat Mitzvah template (49 tasks, 6 blocks)
- ✅ Party template (44 tasks, 6 blocks)

### Step 2: Create Timelines from Templates

Once templates are seeded, create a timeline for each demo event:

**Option A: Using the Application UI**
1. Navigate to "Create Timeline" or similar feature
2. Select one of the demo events by its code
3. Choose the matching template
4. Create the timeline

**Option B: Using the API**

Run these commands to create all 4 timelines:

```bash
# Set your environment variables
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

# Create Wedding Timeline
curl -X POST "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-WED-001", "templateKey": "wedding"}'

# Create Bar Mitzvah Timeline
curl -X POST "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-BAR-001", "templateKey": "bar_mitzvah"}'

# Create Bat Mitzvah Timeline
curl -X POST "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-BAT-001", "templateKey": "bat_mitzvah"}'

# Create Party Timeline
curl -X POST "${SUPABASE_URL}/functions/v1/timelines-create" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"eventCode": "DEMO-PARTY-001", "templateKey": "party"}'
```

### Step 3: View and Interact

Once timelines are created, you can:

✅ **View Timeline List** - See all 4 demo events  
✅ **Open Timeline Details** - Click any event to see complete task breakdown  
✅ **Check Tasks** - Mark tasks complete to see progress tracking  
✅ **View Progress** - See weighted progress calculations and completion percentages  
✅ **Generate Share Links** - Create client-facing view links  

---

## 📊 What Each Timeline Shows

### Wedding Timeline (8 Blocks)
- **12 months before** - Date setting, venue booking, vendor research
- **10 months before** - Photographer, florist, caterer booking
- **8 months before** - Menu selection, dress shopping, music decisions
- **6 months before** - Invitations, rehearsal dinner planning
- **4 months before** - Final dress fittings, ceremony details
- **2 months before** - Final vendor confirmations
- **1 month before** - Seating charts, final headcount
- **2 weeks before** - Final details, emergency kit, ceremony rehearsal

### Bar Mitzvah Timeline (6 Blocks)
- **12 months before** - Planning vision, synagogue booking, JustSeventy template
- **8-10 months before** - Insurance, vendor sourcing, accommodation
- **6-8 months before** - Stationery designs, florist proposals, entertainment
- **3-4 months before** - Print approvals, food tasting, invitations sent
- **1-2 months before** - Transport, RSVPs, seating, photographer brief
- **2 weeks before** - Final confirmations, guest list to caterer

### Bat Mitzvah Timeline (6 Blocks)
Similar structure to Bar Mitzvah with gender-appropriate adjustments and specific Jewish tradition elements.

### Party Timeline (6 Blocks)
- **12 months before** - Event inspiration, theme/color, venue booking
- **8-10 months before** - Vendor sourcing, entertainment decisions
- **6-8 months before** - Stationery, decor booking, catering finalized
- **3-4 months before** - Print proofs, entertainment confirmed
- **1-2 months before** - Transport, seating, music brief
- **2 weeks before** - Final confirmations, guest list, Letter of Engagement

---

## 🎯 Making It Realistic

To create realistic demo data:

1. **Complete Early Blocks** - Check off 80-100% of "12 months before" tasks
2. **Partial Middle Blocks** - Complete 50-60% of "6-8 months" tasks
3. **Leave Recent Unchecked** - Keep "2 weeks before" mostly incomplete
4. **Mix Assignees** - Show tasks split between client, JS, and both
5. **Add Due Dates** - Set realistic due dates for upcoming tasks

### Progress Tracking

The system uses weighted progress:
- **Skeleton tasks** (weight 3) = Critical milestones
- **Regular tasks** (weight 1) = Standard tasks
- Progress percentage calculated by weight, not just count

Example: If you complete 3 skeleton tasks and 6 regular tasks out of 10 skeleton and 30 regular tasks total:
- Completed weight: (3 × 3) + (6 × 1) = 15
- Total weight: (10 × 3) + (30 × 1) = 60
- Progress: 15/60 = 25%

---

## 🔍 Viewing Options

### Admin View
- Full timeline management
- Edit tasks, due dates, descriptions
- View audit logs
- Generate share links

### Client View (via share link)
- Read-only timeline view
- Progress indicators
- Task completion status
- Clean, professional interface

---

## 💡 Quick Start Command Summary

```bash
# 1. Open your app and click "Seed Templates"

# 2. Then run this to create all timelines at once:
for code in DEMO-WED-001 DEMO-BAR-001 DEMO-BAT-001 DEMO-PARTY-001; do
  template=$(echo $code | grep -oP '(?<=-)[A-Z]+(?=-)' | tr '[:upper:]' '[:lower:]')
  curl -X POST "${SUPABASE_URL}/functions/v1/timelines-create" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"eventCode\": \"${code}\", \"templateKey\": \"${template}\"}"
done
```

Your dummy data is ready to demonstrate all four event types with realistic UK venue names and proper J70 Timelines structure!
