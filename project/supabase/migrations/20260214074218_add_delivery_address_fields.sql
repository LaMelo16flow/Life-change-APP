/*
  # Add Delivery Address Fields to Profiles

  1. Changes
    - Add address fields to profiles table for order delivery
      - `address_line1` (street address)
      - `address_line2` (apartment, suite, etc)
      - `city` (city name)
      - `state_province` (state or province)
      - `postal_code` (zip/postal code)
      - `phone` (phone number for delivery contact)

  2. Security
    - No changes to RLS policies needed
    - Users can already update their own profiles
*/

DO $$
BEGIN
  -- Add address fields if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE profiles ADD COLUMN address_line1 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address_line2'
  ) THEN
    ALTER TABLE profiles ADD COLUMN address_line2 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'state_province'
  ) THEN
    ALTER TABLE profiles ADD COLUMN state_province text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN postal_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;
