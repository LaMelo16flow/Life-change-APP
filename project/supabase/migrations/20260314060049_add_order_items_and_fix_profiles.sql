/*
  # Add Order Items Table and Fix Profile Defaults

  ## Changes

  1. New Tables
    - `order_items` - Stores individual items within an order
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `product_id` (uuid, references products)
      - `quantity` (integer) - paid quantity
      - `free_quantity` (integer) - free items from promotions
      - `unit_price` (numeric) - price at time of order
      - `subtotal` (numeric) - quantity * unit_price
      - `pv_value` (numeric) - PV per unit
      - `promotion_id` (uuid, nullable) - linked promotion
      - `created_at` (timestamptz)

  2. Modified Tables
    - `orders` - Make product_id nullable (items in order_items), add items_count
    - `profiles` - Set region default from country_code

  3. Security
    - Enable RLS on order_items
    - Users can view their own order items
    - Admins can view all order items
*/

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  free_quantity integer NOT NULL DEFAULT 0 CHECK (free_quantity >= 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  pv_value numeric NOT NULL DEFAULT 0,
  promotion_id uuid REFERENCES product_promotions(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own order items
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = (select auth.uid())
    )
  );

-- Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Users can insert order items for their own orders
CREATE POLICY "Users can insert own order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = (select auth.uid())
    )
  );

-- Make product_id nullable in orders (for multi-item orders)
ALTER TABLE orders ALTER COLUMN product_id DROP NOT NULL;

-- Add items_count column to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'items_count'
  ) THEN
    ALTER TABLE orders ADD COLUMN items_count integer DEFAULT 1;
  END IF;
END $$;

-- Set region default from country_code for profiles
CREATE OR REPLACE FUNCTION set_profile_region_from_country()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.region IS NULL AND NEW.country_code IS NOT NULL THEN
    NEW.region := NEW.country_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profile_region_trigger ON profiles;
CREATE TRIGGER set_profile_region_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_region_from_country();

-- Update existing profiles with null region
UPDATE profiles SET region = country_code WHERE region IS NULL;

-- Set default values for nullable profile fields with empty strings
UPDATE profiles SET 
  address_line1 = COALESCE(address_line1, ''),
  city = COALESCE(city, ''),
  state_province = COALESCE(state_province, ''),
  postal_code = COALESCE(postal_code, ''),
  phone = COALESCE(phone, '')
WHERE address_line1 IS NULL 
   OR city IS NULL 
   OR state_province IS NULL 
   OR postal_code IS NULL 
   OR phone IS NULL;

-- Set defaults for address fields
ALTER TABLE profiles ALTER COLUMN address_line1 SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN city SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN state_province SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN postal_code SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN region SET DEFAULT '';
