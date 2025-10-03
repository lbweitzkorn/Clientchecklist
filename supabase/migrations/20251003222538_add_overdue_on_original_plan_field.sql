/*
  # Add overdue_on_original_plan field to tasks
  
  This migration adds an optional flag to indicate when a task's due date
  was pushed forward because the calculated date was in the past.
  
  ## Changes
  
  1. Tasks Table
    - Add `overdue_on_original_plan` (boolean): Indicates task would have been overdue
      based on the original calculation, but was pushed forward to today + grace days
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'overdue_on_original_plan'
  ) THEN
    ALTER TABLE tasks ADD COLUMN overdue_on_original_plan boolean DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN tasks.overdue_on_original_plan IS 'Set to true when recalculation would have placed due_date in the past, so it was pushed to today + grace days';
