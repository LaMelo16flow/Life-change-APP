/*
  # Make created_by nullable in groups table

  1. Changes
    - Alter groups.created_by to allow NULL values
    - This allows system-created groups that don't have a specific user creator

  2. Notes
    - Necessary for creating default groups like United Warriors
*/

ALTER TABLE groups ALTER COLUMN created_by DROP NOT NULL;