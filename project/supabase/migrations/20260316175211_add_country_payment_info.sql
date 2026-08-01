/*
  # Add country-specific payment information

  1. New Tables
    - `country_payment_info`
      - `id` (uuid, primary key)
      - `country_code` (text, references countries.code)
      - `payment_method` (text) - e.g. 'e-transfer', 'mobile_money', 'bank_transfer'
      - `payment_label` (text) - display label e.g. 'Interac e-Transfer', 'MTN Mobile Money'
      - `recipient_name` (text) - name of person/entity receiving payment
      - `recipient_contact` (text) - email, phone number, or account number
      - `payment_instructions` (text) - specific instructions for this payment method
      - `is_active` (boolean, default true)
      - `display_order` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
  2. Changes to `countries` table
    - Add `region` column (text, nullable) for sub-regions like Cameroon's regions

  3. Security
    - Enable RLS on `country_payment_info`
    - Admins can manage payment info
    - Authenticated users can read active payment info
*/

CREATE TABLE IF NOT EXISTS country_payment_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT '',
  payment_label text NOT NULL DEFAULT '',
  recipient_name text NOT NULL DEFAULT '',
  recipient_contact text NOT NULL DEFAULT '',
  payment_instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE country_payment_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage country payment info"
  ON country_payment_info
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.is_master = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.is_master = true)
    )
  );

CREATE POLICY "Authenticated users can read active payment info"
  ON country_payment_info
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'countries' AND column_name = 'region'
  ) THEN
    ALTER TABLE countries ADD COLUMN region text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_country_payment_info_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_country_payment_info_updated_at
  BEFORE UPDATE ON country_payment_info
  FOR EACH ROW
  EXECUTE FUNCTION update_country_payment_info_timestamp();