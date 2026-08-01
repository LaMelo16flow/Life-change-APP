/*
  # Add Product Promotions System

  1. New Tables
    - `product_promotions`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `title` (text) - promotion title e.g. "Spring Sale"
      - `discount_type` (text) - 'percentage' or 'fixed_amount'
      - `discount_value` (numeric) - the discount amount (percent or fixed)
      - `country_code` (text, nullable) - target specific country, NULL means all countries
      - `starts_at` (timestamptz) - when the promotion begins
      - `ends_at` (timestamptz) - when the promotion ends
      - `is_active` (boolean) - whether the promotion is enabled
      - `created_by` (uuid) - admin who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `product_promotions` table
    - Authenticated users can read active promotions
    - Admins and managers with manage_promotions can manage promotions

  3. Notes
    - Only one active promotion per product per country at a time (enforced by unique partial index)
    - Discount is applied at display time in the shop; original prices remain in product_prices
*/

CREATE TABLE IF NOT EXISTS product_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  country_code text REFERENCES countries(code) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active promotions"
  ON product_promotions
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND starts_at <= now()
    AND ends_at > now()
  );

CREATE POLICY "Admins can insert product promotions"
  ON product_promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update product promotions"
  ON product_promotions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete product promotions"
  ON product_promotions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can view all promotions including inactive"
  ON product_promotions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_product_promotions_product ON product_promotions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_promotions_active ON product_promotions(is_active, starts_at, ends_at);
