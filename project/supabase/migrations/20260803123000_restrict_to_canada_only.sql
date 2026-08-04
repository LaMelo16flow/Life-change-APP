/*
  # Restrict active countries to Canada only

  1. Changes
    - Set `countries.is_active = false` for every country except Canada ('CA').
    - Ensure Canada itself is active.

  2. Notes
    - This only affects country selection (signup form, shop pricing/region
      lookups query `countries WHERE is_active = true`). It does not touch
      existing user profiles, orders, or inventory tied to other country
      codes - those rows are left as-is, just no longer selectable for new
      activity.
*/

UPDATE countries SET is_active = false WHERE code <> 'CA';
UPDATE countries SET is_active = true WHERE code = 'CA';
