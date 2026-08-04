/*
  # Delete all countries except Canada

  1. Context
    - A prior migration (20260803123000_restrict_to_canada_only.sql) only
      deactivated other countries (is_active = false). Several admin screens
      (ManagerManagement region list, InventoryManagement "initialize all
      stock", etc.) query `countries` without filtering on is_active, so
      inactive countries were still showing up there.
    - This migration physically removes every country row except Canada.

  2. Important - profiles.country_code has ON DELETE RESTRICT
    - Any profile still pointing at a non-Canada country would block the
      DELETE entirely. This migration first normalizes any such profiles
      (and their `region`) to Canada, so the delete can proceed.
    - This is a real data change on existing user rows, not just reference
      data - if you have live users registered under other countries, their
      country_code will be overwritten to 'CA'.

  3. Cascades
    - `payment_methods` and `product_prices` rows for other countries are
      removed automatically via their own ON DELETE CASCADE to countries.
*/

UPDATE profiles SET country_code = 'CA' WHERE country_code <> 'CA';
UPDATE profiles SET region = 'CA' WHERE region IS NOT NULL AND region <> 'CA';

DELETE FROM countries WHERE code <> 'CA';
UPDATE countries SET is_active = true WHERE code = 'CA';
