# Viewing Dummy Data - Quick Start

## ✅ Added UI Buttons to Create Demo Data!

Your homepage now has easy-to-use buttons to set up all the demo data.

## 🚀 How to View Dummy Data (3 Easy Steps)

### Step 1: Open Your App
Navigate to: `http://localhost:5173/` (or your dev server URL)

### Step 2: Click "Seed Templates" Button
- Located in the top-right corner
- This loads all 4 templates into your database:
  - Wedding (48 tasks, 8 blocks)
  - Bar Mitzvah (46 tasks, 6 blocks)
  - Bat Mitzvah (49 tasks, 6 blocks)
  - Party (44 tasks, 6 blocks)

### Step 3: Click "Create Demo Timelines" Button
- Creates timelines for all 4 demo events:
  - DEMO-WED-001: Sarah & David's Wedding
  - DEMO-BAR-001: Joshua's Bar Mitzvah
  - DEMO-BAT-001: Rebecca's Bat Mitzvah
  - DEMO-PARTY-001: Emma's 40th Birthday Celebration

### Step 4: View Your Demo Data!
- The page will refresh and show all 4 timelines
- Click "Open" on any timeline to see the full details
- Each timeline shows:
  - Progress percentage (0% initially)
  - Event details (date, venue, code)
  - Event type badge

## 📋 What You'll See

### Homepage (`/`)
- List of all 4 demo timelines
- Event information cards with:
  - Event code (e.g., DEMO-WED-001)
  - Event type badge (Wedding, Bar Mitzvah, Bat Mitzvah, Party)
  - Title, date, and venue
  - Progress indicator (0% initially)
  - "Open" button to view details

### Timeline Detail Page (`/timeline/:id`)
Click "Open" on any timeline to see:
- All time blocks (e.g., "12 months before", "10 months before")
- All tasks within each block
- Task checkboxes to mark complete
- Progress ring showing completion percentage
- Task assignee indicators (Client, JS, Both)
- Skeleton tasks (key milestones) highlighted with higher weight

## 🎯 Interactive Features

Once your demo data is loaded, you can:

1. **Check off tasks** - Mark tasks as complete and watch the progress update
2. **View task details** - See assignee, weight, and skeleton status
3. **Track progress** - Progress is weight-based (skeleton tasks count more)
4. **Browse all events** - Switch between Wedding, Bar/Bat Mitzvah, and Party timelines

## 📊 Demo Events Details

### Wedding - Sarah & David
- **Date**: December 15, 2025
- **Venue**: The Grand Ballroom, London
- **Tasks**: 48 tasks across 8 time blocks
- **Timeline**: 12 months to 2 weeks before event

### Bar Mitzvah - Joshua
- **Date**: November 8, 2025
- **Venue**: Beth Shalom Synagogue, Manchester
- **Tasks**: 46 tasks across 6 time blocks
- **Timeline**: 12 months to 2 weeks before event

### Bat Mitzvah - Rebecca
- **Date**: October 25, 2025
- **Venue**: Emanuel Synagogue, Birmingham
- **Tasks**: 49 tasks across 6 time blocks
- **Timeline**: 12 months to 2 weeks before event

### Party - Emma's 40th Birthday
- **Date**: September 20, 2025
- **Venue**: The Warehouse Venue, Bristol
- **Tasks**: 44 tasks across 6 time blocks
- **Timeline**: 12 months to 2 weeks before event

## 💡 Tips for Demo

1. **Mark some tasks complete** to show realistic progress (40-60% is good)
2. **Complete early blocks first** (e.g., "12 months before" tasks)
3. **Leave recent blocks incomplete** (e.g., "2 weeks before" tasks)
4. **Mix assignees** to show collaboration between client and JS

## 🔧 Troubleshooting

**If "Create Demo Timelines" fails:**
- Make sure you clicked "Seed Templates" first
- Check browser console for error messages
- Templates must be seeded before creating timelines

**If no timelines show:**
- Click "Create Demo Timelines" button
- Wait for success message
- Page should auto-refresh to show timelines

That's it! Your dummy data is now accessible and ready to explore in your frontend! 🎉
