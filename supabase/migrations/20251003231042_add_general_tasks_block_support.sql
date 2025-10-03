/*
  # Add General Tasks Block Support

  1. New Fields
    - Add to `timelines` table:
      - `allow_client_task_create` (boolean, default false) - Allow clients to create tasks in General block
      - `include_general_in_totals` (boolean, default true) - Include General Tasks in progress calculations
    
    - Add to `blocks` table:
      - `is_general` (boolean, default false) - Marks block as General Tasks block
  
  2. Data Migration
    - Create a "General Tasks" block for every existing timeline
    - Set key='general', title='General Tasks', order=999, is_general=true
  
  3. Security
    - No RLS changes needed (existing policies cover new fields)
  
  4. Notes
    - General Tasks blocks are synthetic blocks not tied to month phases
    - They always appear last in the timeline
    - Can be used for ad-hoc tasks outside the canonical timeline structure
*/

-- Add fields to timelines table
ALTER TABLE timelines 
ADD COLUMN IF NOT EXISTS allow_client_task_create boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS include_general_in_totals boolean DEFAULT true;

-- Add field to blocks table
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS is_general boolean DEFAULT false;

-- Create General Tasks block for all existing timelines
INSERT INTO blocks (timeline_id, key, title, "order", is_general, created_at)
SELECT 
  id as timeline_id,
  'general' as key,
  'General Tasks' as title,
  999 as "order",
  true as is_general,
  now() as created_at
FROM timelines
WHERE NOT EXISTS (
  SELECT 1 FROM blocks 
  WHERE blocks.timeline_id = timelines.id 
  AND blocks.key = 'general'
);
