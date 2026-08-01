/*
  # Remove Bronze Rank

  1. Changes
    - Update Gold rank requirements to reference Silver instead of Bronze
    - Delete Bronze rank from the system
    - Adjust display_order for all remaining ranks

  2. Impact
    - Gold rank will now require branches to be Silver+ instead of Bronze+
    - Display order shifts: Silver becomes #2, Gold becomes #3, D1 becomes #4, etc.

  3. Notes
    - No user profiles currently have Bronze rank
    - Safe to remove without data migration
*/

-- Step 1: Update Gold rank requirements to reference Silver instead of Bronze
UPDATE rank_requirements
SET min_branch_rank_id = (SELECT id FROM ranks WHERE name = 'Silver')
WHERE rank_id = (SELECT id FROM ranks WHERE name = 'Gold')
  AND min_branch_rank_id = (SELECT id FROM ranks WHERE name = 'Bronze');

-- Step 2: Delete Bronze rank
DELETE FROM ranks WHERE name = 'Bronze';

-- Step 3: Update display_order for remaining ranks (shift down by 1)
UPDATE ranks SET display_order = 2 WHERE name = 'Silver';
UPDATE ranks SET display_order = 3 WHERE name = 'Gold';
UPDATE ranks SET display_order = 4 WHERE name = 'D1';
UPDATE ranks SET display_order = 5 WHERE name = 'D2';
UPDATE ranks SET display_order = 6 WHERE name = 'D3';
UPDATE ranks SET display_order = 7 WHERE name = 'D4';
UPDATE ranks SET display_order = 8 WHERE name = 'D5';
UPDATE ranks SET display_order = 9 WHERE name = 'D6';
UPDATE ranks SET display_order = 10 WHERE name = 'D7';
