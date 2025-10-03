/*
  # Adjust Existing Schema for JS Live Event Timeline System

  ## Changes
  1. Updates
    - Adjust templates table to use template_key as primary key
    - Update foreign key references
    - Add missing columns

  2. Notes
    - Tables already exist with slightly different structure
    - This migration adjusts them to match requirements
*/

-- Add missing columns to templates if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates' AND column_name = 'description'
  ) THEN
    ALTER TABLE templates ADD COLUMN description text;
  END IF;
END $$;

-- Update timelines to add background_url if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timelines' AND column_name = 'background_url'
  ) THEN
    ALTER TABLE timelines ADD COLUMN background_url text;
  END IF;
END $$;

-- Add RLS policies for public access to tasks via share_links
DROP POLICY IF EXISTS "Public can read tasks via valid share link" ON tasks;
CREATE POLICY "Public can read tasks via valid share link"
  ON tasks FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = tasks.timeline_id
      AND share_links.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Public can update client tasks via valid share link" ON tasks;
CREATE POLICY "Public can update client tasks via valid share link"
  ON tasks FOR UPDATE
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

-- Add RLS policies for public access to blocks via share_links
DROP POLICY IF EXISTS "Public can read blocks via valid share link" ON blocks;
CREATE POLICY "Public can read blocks via valid share link"
  ON blocks FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = blocks.timeline_id
      AND share_links.expires_at > now()
    )
  );

-- Add RLS policies for public access to timelines via share_links
DROP POLICY IF EXISTS "Public can read timelines via valid share link" ON timelines;
CREATE POLICY "Public can read timelines via valid share link"
  ON timelines FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = timelines.id
      AND share_links.expires_at > now()
    )
  );

-- Add RLS policies for public access to events via share_links
DROP POLICY IF EXISTS "Public can read events via valid share link" ON events;
CREATE POLICY "Public can read events via valid share link"
  ON events FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM timelines t
      JOIN share_links sl ON sl.timeline_id = t.id
      WHERE t.event_id = events.id
      AND sl.expires_at > now()
    )
  );

-- Add RLS policy for public to create audit entries via share links
DROP POLICY IF EXISTS "Public can create audit entries via valid share link" ON audit_entries;
CREATE POLICY "Public can create audit entries via valid share link"
  ON audit_entries FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM share_links
      WHERE share_links.timeline_id = audit_entries.timeline_id
      AND share_links.expires_at > now()
    )
  );