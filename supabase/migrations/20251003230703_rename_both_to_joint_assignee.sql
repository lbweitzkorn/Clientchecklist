/*
  # Rename 'both' to 'joint' assignee value

  1. Changes
    - Drop existing assignee check constraint
    - Update all tasks with assignee='both' to assignee='joint'
    - Add new check constraint allowing 'client', 'js', 'joint'
    
  2. Notes
    - This is a data and schema migration to align with new naming convention
    - Changes existing task assignee values from 'both' to 'joint'
*/

-- Drop the existing check constraint first
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_check;

-- Update all tasks with assignee 'both' to 'joint'
UPDATE tasks
SET assignee = 'joint'
WHERE assignee = 'both';

-- Add new check constraint with 'joint' instead of 'both'
ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_check 
  CHECK (assignee IN ('client', 'js', 'joint'));
