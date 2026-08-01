/*
  # Create United Warriors Group

  1. Changes
    - Insert United Warriors group into the groups table
    - This is a system-wide group available for all users

  2. Notes
    - The group is created without a specific creator (created_by is NULL)
    - Users will be able to join or be added to this group
*/

INSERT INTO groups (id, name, description, created_by, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'United Warriors',
  'A community group for all members to connect, share, and grow together.',
  NULL,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;