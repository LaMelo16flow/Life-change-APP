/*
  # Remove Life Changer Codes feature

  1. Changes
    - Drop `life_changer_codes` table (promo/referral codes with bonus PV
      and commission rate) and its indexes/policies.
    - Drop `orders.life_changer_code` column (plain text, not FK-referenced
      by anything else, safe to drop directly).

  2. Notes
    - This is unrelated to `profiles.referred_by` / the branch/team referral
      system, which is untouched.
*/

ALTER TABLE orders DROP COLUMN IF EXISTS life_changer_code;

DROP TABLE IF EXISTS life_changer_codes CASCADE;
