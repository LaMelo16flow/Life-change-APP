/*
  # Add Manager Role, Master Account, Permissions System, and Fix RLS

  1. Profile Changes
    - Expand role CHECK to include 'manager' in addition to 'user' and 'admin'
    - Add 'is_master' boolean flag (only one master account - full control)
    - Set the existing admin (wilfriednawoussi4@gmail.com) as the master account

  2. New Tables
    - `manager_permissions` - stores which permissions each manager has
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `permission` (text) - e.g., 'manage_orders', 'manage_inventory', 'manage_users', 'manage_accounts', 'manage_products'
      - `regions` (text[]) - which regions the manager can operate in (NULL = all regions)
      - `granted_by` (uuid) - who gave this permission
      - `created_at` (timestamptz)

  3. RLS Policy Fixes
    - Fix orders policies: master/admin can see ALL orders (not just region-scoped)
    - Fix product_inventory policies: master/admin can manage ALL inventory
    - Fix profiles update policy: master can update any profile
    - Add manager-level policies scoped by their permissions and regions

  4. Security
    - RLS enabled on manager_permissions
    - Only master can manage permissions
    - Managers can view their own permissions
*/

-- 1. Expand profile role constraint to include 'manager'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'manager'::text]));

-- 2. Add is_master column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_master'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_master boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- 3. Set the master account
UPDATE profiles SET is_master = true, role = 'admin'
WHERE email = 'wilfriednawoussi4@gmail.com';

-- 4. Create manager_permissions table
CREATE TABLE IF NOT EXISTS manager_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN (
    'manage_orders',
    'manage_inventory',
    'manage_users',
    'manage_accounts',
    'manage_products',
    'manage_promotions',
    'manage_codes'
  )),
  regions text[] DEFAULT NULL,
  granted_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, permission)
);

ALTER TABLE manager_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can manage all permissions"
  ON manager_permissions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_master = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_master = true
  ));

CREATE POLICY "Users can view own permissions"
  ON manager_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Fix orders RLS - drop broken policies and recreate
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Regional admins can view orders in their region" ON orders;
DROP POLICY IF EXISTS "Regional admins can update orders in their region" ON orders;

CREATE POLICY "Admins and master can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_master = true
        OR (profiles.role = 'admin')
      )
    )
  );

CREATE POLICY "Admins and master can update all orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_master = true
        OR (profiles.role = 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_master = true
        OR (profiles.role = 'admin')
      )
    )
  );

CREATE POLICY "Managers can view orders in permitted regions"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR orders.region = ANY(mp.regions))
    )
  );

CREATE POLICY "Managers can update orders in permitted regions"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR orders.region = ANY(mp.regions))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR orders.region = ANY(mp.regions))
    )
  );

-- 6. Fix product_inventory RLS
DROP POLICY IF EXISTS "Regional admins can view inventory in their region" ON product_inventory;
DROP POLICY IF EXISTS "Regional admins can update inventory in their region" ON product_inventory;
DROP POLICY IF EXISTS "Regional admins can insert inventory in their region" ON product_inventory;

CREATE POLICY "Admins and master can view all inventory"
  ON product_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_master = true OR profiles.role = 'admin')
    )
  );

CREATE POLICY "Admins and master can update all inventory"
  ON product_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_master = true OR profiles.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_master = true OR profiles.role = 'admin')
    )
  );

CREATE POLICY "Admins and master can insert inventory"
  ON product_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_master = true OR profiles.role = 'admin')
    )
  );

CREATE POLICY "Managers can view inventory in permitted regions"
  ON product_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_inventory'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR product_inventory.region = ANY(mp.regions))
    )
  );

CREATE POLICY "Managers can update inventory in permitted regions"
  ON product_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_inventory'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR product_inventory.region = ANY(mp.regions))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_inventory'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR product_inventory.region = ANY(mp.regions))
    )
  );

CREATE POLICY "Managers can insert inventory in permitted regions"
  ON product_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_inventory'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR product_inventory.region = ANY(mp.regions))
    )
  );

-- 7. Fix profiles update policy - master can update any profile
DROP POLICY IF EXISTS "Regional admins can update profiles in their region" ON profiles;

CREATE POLICY "Master can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_master = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_master = true
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
