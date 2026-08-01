/*
  # Regional Inventory and Order Management System

  ## New Tables Created
  
  ### 1. `product_inventory`
  Tracks stock levels per product per region
    - `id` (uuid, primary key)
    - `product_id` (uuid, references products)
    - `region` (text) - region code (e.g., 'CA', 'US', 'FR')
    - `quantity` (integer) - current stock quantity
    - `reserved_quantity` (integer) - quantity reserved by pending orders
    - `max_quantity` (integer) - maximum stock level set by stockist
    - `low_stock_threshold` (integer) - alert threshold
    - `managed_by` (uuid, references auth.users) - stockist managing this inventory
    - `created_at`, `updated_at` (timestamptz)

  ### 2. `orders`
  Tracks all product orders with approval workflow
    - `id` (uuid, primary key)
    - `order_number` (text, unique) - human-readable order number
    - `user_id` (uuid, references auth.users)
    - `product_id` (uuid, references products)
    - `quantity` (integer)
    - `unit_price` (numeric) - price at time of order
    - `total_amount` (numeric) - quantity * unit_price
    - `currency_code` (text)
    - `region` (text) - user's region
    - `status` (text) - pending, approved, rejected, completed, cancelled
    - `life_changer_code` (text, nullable) - optional referral code
    - `payment_transaction_id` (uuid, nullable) - links to payment when approved
    - `approved_by` (uuid, nullable) - admin who approved
    - `approved_at` (timestamptz, nullable)
    - `rejection_reason` (text, nullable)
    - `admin_notes` (text, nullable)
    - `metadata` (jsonb)
    - `created_at`, `updated_at` (timestamptz)

  ### 3. `life_changer_codes`
  Manages referral/promotional codes
    - `id` (uuid, primary key)
    - `code` (text, unique) - the actual code
    - `owner_id` (uuid, references auth.users) - who owns/benefits from this code
    - `description` (text, nullable)
    - `bonus_pv` (numeric) - bonus PV awarded when code is used
    - `commission_rate` (numeric) - commission percentage for code owner
    - `usage_limit` (integer, nullable) - max times code can be used
    - `times_used` (integer) - current usage count
    - `expires_at` (timestamptz, nullable)
    - `is_active` (boolean)
    - `created_by` (uuid) - admin who created the code
    - `created_at`, `updated_at` (timestamptz)

  ### 4. `inventory_logs`
  Audit trail for inventory movements
    - `id` (uuid, primary key)
    - `product_id` (uuid)
    - `region` (text)
    - `action` (text) - 'restock', 'order', 'adjustment', 'reservation'
    - `quantity_change` (integer) - positive or negative
    - `quantity_after` (integer)
    - `reference_id` (uuid, nullable) - order_id or other reference
    - `performed_by` (uuid)
    - `notes` (text, nullable)
    - `created_at` (timestamptz)

  ## Modified Tables
  
  ### profiles
  - Add `region` (text) - user's assigned region

  ## Security
  - Enable RLS on all new tables
  - Users can view their own orders
  - Admins can manage inventory and approve orders in their regions
  - Life changer codes are publicly readable but admin-only writable
*/

-- Add region to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'region'
  ) THEN
    ALTER TABLE profiles ADD COLUMN region text;
  END IF;
END $$;

-- Create product_inventory table
CREATE TABLE IF NOT EXISTS product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  region text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  max_quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 10,
  managed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, region)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  currency_code text NOT NULL,
  region text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  life_changer_code text,
  payment_transaction_id uuid REFERENCES payment_transactions(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  admin_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create life_changer_codes table
CREATE TABLE IF NOT EXISTS life_changer_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  bonus_pv numeric DEFAULT 0 CHECK (bonus_pv >= 0),
  commission_rate numeric DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  usage_limit integer,
  times_used integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  region text NOT NULL,
  action text NOT NULL CHECK (action IN ('restock', 'order', 'adjustment', 'reservation', 'release')),
  quantity_change integer NOT NULL,
  quantity_after integer NOT NULL,
  reference_id uuid,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_inventory_region ON product_inventory(region);
CREATE INDEX IF NOT EXISTS idx_product_inventory_product ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_region ON orders(region);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_life_changer_codes_code ON life_changer_codes(code);
CREATE INDEX IF NOT EXISTS idx_life_changer_codes_owner ON life_changer_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_region ON inventory_logs(product_id, region);

-- Enable RLS
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_changer_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_inventory

-- Users can view inventory for their region
CREATE POLICY "Users can view inventory in their region"
  ON product_inventory FOR SELECT
  TO authenticated
  USING (
    region IN (
      SELECT p.region FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Admins can manage all inventory
CREATE POLICY "Admins can view all inventory"
  ON product_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert inventory"
  ON product_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update inventory"
  ON product_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for orders

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update orders (for approval/rejection)
CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for life_changer_codes

-- All authenticated users can view active codes (to validate during checkout)
CREATE POLICY "Users can view active codes"
  ON life_changer_codes FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all codes
CREATE POLICY "Admins can insert codes"
  ON life_changer_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update codes"
  ON life_changer_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for inventory_logs

-- Admins can view all logs
CREATE POLICY "Admins can view inventory logs"
  ON inventory_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert logs (performed by admins or system)
CREATE POLICY "System can insert inventory logs"
  ON inventory_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  counter := (SELECT COUNT(*) FROM orders) + 1;
  new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update order timestamps
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order timestamps
DROP TRIGGER IF EXISTS update_orders_timestamp ON orders;
CREATE TRIGGER update_orders_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamp();

-- Function to update inventory timestamps
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory timestamps
DROP TRIGGER IF EXISTS update_inventory_timestamp ON product_inventory;
CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_timestamp();
