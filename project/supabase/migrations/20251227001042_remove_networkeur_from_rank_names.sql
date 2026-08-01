/*
  # Remove Networkeur Prefix from Rank Names

  1. Changes
    - Rename "Networkeur Bronze" to "Bronze"
    - Rename "Networkeur Silver" to "Silver"
    - Rename "Networkeur Gold" to "Gold"

  2. Notes
    - Preserves all rank relationships and requirements
    - Updates are safe due to ON UPDATE CASCADE on foreign keys
*/

UPDATE ranks SET name = 'Bronze' WHERE name = 'Networkeur Bronze';
UPDATE ranks SET name = 'Silver' WHERE name = 'Networkeur Silver';
UPDATE ranks SET name = 'Gold' WHERE name = 'Networkeur Gold';
