/*
  # Add Recalibration Fields for Pro-Rata Timeline Adjustment

  This migration adds fields needed for dynamic timeline recalibration based on lead time.

  ## Changes

  1. Template Blocks
    - Add `months_before_start` (numeric): Canonical start offset in months before event (e.g., 12 for "12m block")
    - Add `months_before_end` (numeric): Canonical end offset in months before event (e.g., 10 for "12m block")
    - These define the canonical timeframe for template blocks

  2. Blocks (Timeline Instances)
    - Add `start_date` (date): Calculated start date for this block in the timeline
    - Add `end_date` (date): Calculated end date for this block in the timeline
    - These are populated during recalibration

  3. Tasks
    - Add `locked` (boolean): Prevents recalculation from changing this task's due_date
    - Add `depends_on_task_ids` (uuid[]): Array of task IDs this task depends on
    - Default locked to false

  4. Timelines
    - Add `last_recalculated_at` (timestamptz): Timestamp of last recalculation
    - Add `scale_factor` (numeric): The S factor used in last recalculation (LT/12)

  ## Notes
  - All new fields are nullable to support existing data
  - Existing timelines can be recalculated to populate these fields
  - Locked tasks won't be moved during recalculation
*/

-- Add canonical offset fields to template_blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_blocks' AND column_name = 'months_before_start'
  ) THEN
    ALTER TABLE template_blocks ADD COLUMN months_before_start numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_blocks' AND column_name = 'months_before_end'
  ) THEN
    ALTER TABLE template_blocks ADD COLUMN months_before_end numeric;
  END IF;
END $$;

-- Add calculated date fields to blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blocks' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE blocks ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blocks' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE blocks ADD COLUMN end_date date;
  END IF;
END $$;

-- Add lock and dependency fields to tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'locked'
  ) THEN
    ALTER TABLE tasks ADD COLUMN locked boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'depends_on_task_ids'
  ) THEN
    ALTER TABLE tasks ADD COLUMN depends_on_task_ids uuid[];
  END IF;
END $$;

-- Add recalculation tracking to timelines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timelines' AND column_name = 'last_recalculated_at'
  ) THEN
    ALTER TABLE timelines ADD COLUMN last_recalculated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timelines' AND column_name = 'scale_factor'
  ) THEN
    ALTER TABLE timelines ADD COLUMN scale_factor numeric;
  END IF;
END $$;

-- Create index on task dependencies for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks USING GIN (depends_on_task_ids);

-- Add comment explaining the canonical offset system
COMMENT ON COLUMN template_blocks.months_before_start IS 'Canonical start offset in months before event (e.g., 12 for 12-month block)';
COMMENT ON COLUMN template_blocks.months_before_end IS 'Canonical end offset in months before event (e.g., 10 for 12-month block ending at 10 months)';
COMMENT ON COLUMN blocks.start_date IS 'Calculated start date for this block after recalibration';
COMMENT ON COLUMN blocks.end_date IS 'Calculated end date for this block after recalibration';
COMMENT ON COLUMN tasks.locked IS 'When true, recalculation will not change this task due_date';
COMMENT ON COLUMN tasks.depends_on_task_ids IS 'Array of task IDs this task depends on - enforces due(this) >= due(dependency) + 1 day';
COMMENT ON COLUMN timelines.last_recalculated_at IS 'Timestamp of last recalculation run';
COMMENT ON COLUMN timelines.scale_factor IS 'Scale factor (S = lead_time / 12) used in last recalculation';
