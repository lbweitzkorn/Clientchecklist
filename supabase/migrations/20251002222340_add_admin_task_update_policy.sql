/*
  # Add Admin Task Update Policy

  This migration adds a policy to allow full task updates (including assignee changes)
  for users accessing tasks directly through the timeline (admin access).

  ## Changes
  
  1. Policy Changes
    - Add policy "Admin can update all task fields" for UPDATE operations
    - Allows changing any field including assignee
    - No restrictions on the new values in WITH CHECK
    - Uses simple timeline_id existence check for access control
*/

-- Drop the overly restrictive public update policy
DROP POLICY IF EXISTS "Public can update client tasks via valid share link" ON tasks;

-- Add back the public policy for client updates through share links
CREATE POLICY "Public can update client tasks via valid share link"
  ON tasks
  FOR UPDATE
  TO public
  USING (
    assignee IN ('client', 'both')
    AND EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = tasks.timeline_id
      AND share_links.expires_at > now()
    )
  )
  WITH CHECK (
    assignee IN ('client', 'both')
    AND EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = tasks.timeline_id
      AND share_links.expires_at > now()
    )
  );

-- Add admin access policy that allows all updates when accessing via timeline directly
CREATE POLICY "Admin can update all task fields"
  ON tasks
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM timelines
      WHERE timelines.id = tasks.timeline_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timelines
      WHERE timelines.id = tasks.timeline_id
    )
  );
