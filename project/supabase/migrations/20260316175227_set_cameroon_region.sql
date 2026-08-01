/*
  # Set region for Cameroon

  1. Changes
    - Set Cameroon's region to 'Central Africa' in the countries table
    - This allows grouping countries by region for payment info management

  2. Important Notes
    - Only Cameroon is updated as specifically requested
    - Region can be set for other countries later via admin interface
*/

UPDATE countries
SET region = 'Central Africa'
WHERE code = 'CM'
AND region IS NULL;