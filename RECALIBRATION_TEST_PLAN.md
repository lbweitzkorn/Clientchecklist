# Recalibration Test Plan

## Overview
Test plan for the improved recalibration algorithm using date-fns with week-start rounding and locked task anchors.

## Key Algorithm Features

### 1. **Date-fns for Calendar Math**
- Uses `addMonths`/`subMonths` for accurate month calculations
- No more 30.44-day constants
- Proper handling of month boundaries

### 2. **Week-Start Rounding**
- All block boundaries rounded to Monday (weekStartsOn: 1)
- Provides consistent planning boundaries
- Prevents mid-week task clustering

### 3. **Locked Task Anchors**
- Locked tasks split blocks into spans
- Unlocked tasks distributed across spans
- Ensures critical dates remain fixed

### 4. **Distribution Strategies**
```typescript
'frontload': First 50% of tasks in 25% of time
'balanced':  Even distribution
'even':      Uniform spacing
```

### 5. **Overdue Handling**
- Tasks past today → pushed to today + 2 days
- Marked with `overdue_on_original_plan: true`
- Preserves visibility of schedule compression

## Test Scenarios

### Scenario 1: 12-Month Lead Time (S = 1.0)
**Setup:**
- Event date: 2026-10-03 (12 months from now)
- Today: 2025-10-03
- Scale factor: 1.0 (no scaling)

**Expected Behavior:**
- Block boundaries match canonical offsets exactly
- 12m block: 12 months → 10 months before event
- All dates rounded to Monday
- Tasks distributed according to strategy
- No overdue flags

**Test:**
```bash
curl -X POST https://xxx.supabase.co/functions/v1/timelines-recalculate/<timeline-id> \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"distribution":"frontload","respectLocks":true}'
```

**Verify:**
- [ ] scale_factor = 1.0
- [ ] Block start/end dates on Mondays
- [ ] 12m block: ~2025-10-06 to ~2025-12-01
- [ ] 8-10m block: ~2025-12-01 to ~2026-02-02
- [ ] No tasks with overdue_on_original_plan = true

---

### Scenario 2: 6-Month Lead Time (S = 0.5)
**Setup:**
- Event date: 2026-04-03 (6 months from now)
- Today: 2025-10-03
- Scale factor: 0.5 (compressed)

**Expected Behavior:**
- Blocks compressed to 50% of original duration
- 12m block becomes 6m block (12 × 0.5 = 6)
- Notes include "Compressed schedule" warning
- Week boundaries still enforced

**Test:**
```bash
curl -X POST https://xxx.supabase.co/functions/v1/timelines-recalculate/<timeline-id> \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"distribution":"balanced","respectLocks":true}'
```

**Verify:**
- [ ] scale_factor = 0.5
- [ ] notes = ["Compressed schedule: weekly mode suggested"]
- [ ] 12m block duration ≈ 3 months (half of 6m)
- [ ] All dates still on Mondays
- [ ] Tasks evenly distributed (balanced strategy)

---

### Scenario 3: 18-Month Lead Time (S = 1.5)
**Setup:**
- Event date: 2027-04-03 (18 months from now)
- Today: 2025-10-03
- Scale factor: 1.5 (extended)

**Expected Behavior:**
- Blocks extended to 150% of original duration
- More breathing room between tasks
- Same proportional distribution

**Test:**
```bash
curl -X POST https://xxx.supabase.co/functions/v1/timelines-recalculate/<timeline-id> \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"distribution":"even","respectLocks":true}'
```

**Verify:**
- [ ] scale_factor = 1.5
- [ ] 12m block duration ≈ 9 months (12 × 1.5 - 10 × 1.5 = 18 - 15 = 3m → scaled)
- [ ] Tasks evenly spaced (even strategy)
- [ ] All dates on Mondays

---

### Scenario 4: Locked Tasks as Anchors
**Setup:**
- Event date: 2026-10-03
- Lock 2 tasks in 12m block:
  - Task A: 2025-11-10 (Monday)
  - Task B: 2026-01-19 (Monday)
- 10 unlocked tasks in same block

**Expected Behavior:**
- Block split into 3 spans:
  1. Start → 2025-11-09 (before Task A)
  2. 2025-11-11 → 2026-01-18 (between A and B)
  3. 2026-01-20 → End (after Task B)
- Unlocked tasks round-robin across spans
- Locked tasks unchanged

**Test:**
```sql
-- Lock tasks first
UPDATE tasks SET locked = true, due_date = '2025-11-10' WHERE id = '<task-a-id>';
UPDATE tasks SET locked = true, due_date = '2026-01-19' WHERE id = '<task-b-id>';

-- Then recalculate
```

**Verify:**
- [ ] skipped_locked = 2
- [ ] Task A due_date unchanged: 2025-11-10
- [ ] Task B due_date unchanged: 2026-01-19
- [ ] Other tasks distributed across 3 spans
- [ ] No tasks overlap locked dates

---

### Scenario 5: Past Event (Overdue Handling)
**Setup:**
- Event date: 2025-09-01 (in the past!)
- Today: 2025-10-03
- Lead time: negative

**Expected Behavior:**
- Scale factor: 0 (clamped minimum)
- All calculated dates pushed to today + 2 days
- All tasks marked overdue_on_original_plan = true
- Notes include compressed schedule warning

**Test:**
```bash
curl -X POST https://xxx.supabase.co/functions/v1/timelines-recalculate/<timeline-id> \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"distribution":"frontload","respectLocks":true}'
```

**Verify:**
- [ ] scale_factor = 0
- [ ] All task due_dates = 2025-10-05 (today + 2)
- [ ] All tasks have overdue_on_original_plan = true
- [ ] notes includes "Compressed schedule"

---

### Scenario 6: Task Dependencies
**Setup:**
- Event date: 2026-10-03
- Task chain: A → B → C
  - Task A: no dependencies
  - Task B: depends on A
  - Task C: depends on B

**Expected Behavior:**
- Task B.due_date ≥ Task A.due_date + 1 day
- Task C.due_date ≥ Task B.due_date + 1 day
- Dependencies honored even if distribution pushes earlier

**Test:**
```sql
-- Set dependencies
UPDATE tasks SET depends_on_task_ids = ARRAY['<task-a-id>'] WHERE id = '<task-b-id>';
UPDATE tasks SET depends_on_task_ids = ARRAY['<task-b-id>'] WHERE id = '<task-c-id>';

-- Recalculate
```

**Verify:**
- [ ] Task B due_date > Task A due_date
- [ ] Task C due_date > Task B due_date
- [ ] Minimum 1-day gap between dependent tasks

---

### Scenario 7: Distribution Strategy Comparison
**Setup:**
- Event date: 2026-10-03
- Same timeline, 3 recalculations with different strategies
- 10 tasks in 12m block (60 days duration)

**Expected Behavior:**

#### Frontload:
- Tasks 1-5: Days 0-15 (25% of time)
- Tasks 6-10: Days 16-60 (75% of time)
- Critical/skeleton tasks earliest

#### Balanced:
- Tasks evenly distributed
- Equal spacing: ~6 days between tasks

#### Even:
- Uniform distribution
- Spacing formula: i / (N-1) × span_days

**Test:**
Run recalc 3 times with each strategy, compare task due dates.

**Verify:**
- [ ] Frontload: Early tasks clustered
- [ ] Balanced: Even spacing throughout
- [ ] Even: Mathematical uniform distribution

---

### Scenario 8: No Event Date Set
**Setup:**
- Event without date field
- Attempt recalculation

**Expected Behavior:**
- 400 error: "Event date not set"
- No changes to tasks or blocks

**Test:**
```sql
UPDATE events SET date = NULL WHERE id = '<event-id>';
```

**Verify:**
- [ ] HTTP 400 response
- [ ] Error message: "Event date not set"
- [ ] No audit entry created

---

### Scenario 9: Response Structure
**Setup:**
- Any valid recalculation

**Expected Response:**
```json
{
  "success": true,
  "updated": 42,
  "skipped_locked": 3,
  "scale_factor": 0.83,
  "notes": ["Compressed schedule: weekly mode suggested"]
}
```

**Verify:**
- [ ] updated count matches actual changes
- [ ] skipped_locked matches locked task count
- [ ] scale_factor accurate (LT/12)
- [ ] notes array present (may be empty)

---

### Scenario 10: Audit Trail
**Setup:**
- Run recalculation

**Expected Audit Entry:**
```json
{
  "timeline_id": "<uuid>",
  "task_id": null,
  "action": "edit",
  "actor": "admin",
  "changes": {
    "type": "recalculation",
    "scale_factor": 0.83,
    "distribution": "frontload",
    "respect_locks": true,
    "updated": 42,
    "skipped_locked": 3,
    "notes": [...]
  }
}
```

**Verify:**
- [ ] Audit entry created
- [ ] All metadata captured
- [ ] Timestamp accurate

---

## Manual Verification Steps

### 1. **Visual Inspection**
- Open TimelineDetail page
- Check block boundaries on Mondays
- Verify task distribution looks correct
- Check locked tasks unchanged

### 2. **Database Queries**
```sql
-- Check block dates
SELECT id, key, title, start_date, end_date
FROM blocks
WHERE timeline_id = '<timeline-id>'
ORDER BY "order";

-- Check task dates
SELECT id, title, due_date, locked, overdue_on_original_plan
FROM tasks
WHERE timeline_id = '<timeline-id>'
ORDER BY due_date;

-- Check scale factor
SELECT last_recalculated_at, scale_factor
FROM timelines
WHERE id = '<timeline-id>';
```

### 3. **Edge Cases**
- [ ] Block with 0 tasks (skip)
- [ ] Block with 1 task (place at start)
- [ ] All tasks locked (skip all)
- [ ] Event date = today (S = 0)
- [ ] Event date > 2 years out (S clamped to 2)

---

## Success Criteria

✅ **All scenarios pass**
✅ **No TypeScript errors**
✅ **Build succeeds**
✅ **Dates consistently on Mondays**
✅ **Locked tasks never move**
✅ **Dependencies always honored**
✅ **Overdue tasks flagged correctly**
✅ **Audit trail complete**
✅ **Response structure matches docs**

---

## Notes

- Algorithm now uses proper calendar month math
- Week-start rounding prevents mid-week dates
- Locked tasks create natural planning boundaries
- Overdue flag provides schedule visibility
- Distribution strategies are deterministic

## Implementation Files

- `/supabase/functions/timelines-recalculate/index.ts` (edge function)
- `/src/utils/recalculation-engine.ts` (frontend utility)
- `/src/types/index.ts` (updated with overdue_on_original_plan)
- `/supabase/migrations/xxx_add_overdue_field.sql` (database)
