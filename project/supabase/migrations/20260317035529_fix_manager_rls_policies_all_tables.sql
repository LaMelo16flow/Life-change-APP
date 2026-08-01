/*
  # Fix Manager Role RLS Policies Across All Tables

  The manager role was only enforced at the frontend level for most tables.
  Database-level RLS policies were missing, causing managers to get empty results
  or permission denied errors when accessing data they should be allowed to manage.

  1. Profiles Table
    - Add UPDATE policy for managers with 'manage_users' permission
    - Allows managers to edit user profiles

  2. Products Table
    - Replace admin-only INSERT/UPDATE policies with ones that include managers with 'manage_products'

  3. Promotion Requests Table
    - Replace admin-only SELECT policy with one that includes managers with 'manage_promotions'
    - Replace admin-only UPDATE policy with one that includes managers with 'manage_promotions'

  4. Life Changer Codes Table
    - Replace admin-only INSERT/UPDATE policies with ones that include managers with 'manage_codes'

  5. Payment Transactions Table
    - Add SELECT policy for managers with 'manage_orders' so they can view payment info on orders

  6. Notifications Table
    - Update INSERT policy so managers can send notifications
*/

-- ============================================================
-- 1. PROFILES: Allow managers with 'manage_users' to update profiles
-- ============================================================
DROP POLICY IF EXISTS "Update profiles" ON profiles;
CREATE POLICY "Update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_users')
  )
  WITH CHECK (
    id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_users')
  );

-- Drop old overlapping policies from previous migration
DROP POLICY IF EXISTS "Master can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

-- ============================================================
-- 2. PRODUCTS: Allow managers with 'manage_products' to insert/update
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert products" ON products;
CREATE POLICY "Admins and managers can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins and managers can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

-- ============================================================
-- 3. PROMOTION REQUESTS: Allow managers with 'manage_promotions' to view and review
-- ============================================================

-- Fix SELECT: managers need to see all promotion requests, not just their own
DROP POLICY IF EXISTS "Users can view own promotion requests" ON promotion_requests;
CREATE POLICY "Users can view promotion requests"
  ON promotion_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_promotions')
  );

-- Fix UPDATE: managers need to approve/reject promotions
DROP POLICY IF EXISTS "Eligible users can review promotions" ON promotion_requests;
CREATE POLICY "Admins and managers can review promotions"
  ON promotion_requests FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_promotions')
    OR (user_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_promotions')
    OR (user_id = auth.uid() AND status = 'cancelled')
  );

-- Drop the separate cancel policy since it's merged above
DROP POLICY IF EXISTS "Users can cancel own pending promotion requests" ON promotion_requests;

-- ============================================================
-- 4. LIFE CHANGER CODES: Allow managers with 'manage_codes' to insert/update
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert codes" ON life_changer_codes;
CREATE POLICY "Admins and managers can insert codes"
  ON life_changer_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_codes')
  );

DROP POLICY IF EXISTS "Admins can update codes" ON life_changer_codes;
CREATE POLICY "Admins and managers can update codes"
  ON life_changer_codes FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_codes')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_codes')
  );

-- Also let managers with manage_codes see all codes (not just active ones)
DROP POLICY IF EXISTS "Users can view active codes" ON life_changer_codes;
CREATE POLICY "View life changer codes"
  ON life_changer_codes FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_codes')
  );

-- ============================================================
-- 5. PAYMENT TRANSACTIONS: Allow managers with 'manage_orders' to view payments
-- ============================================================
DROP POLICY IF EXISTS "Users can view own payments" ON payment_transactions;
CREATE POLICY "View payment transactions"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_orders')
  );

-- Also allow managers to update payment status (e.g., mark as verified)
CREATE POLICY "Admins and managers can update payments"
  ON payment_transactions FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_orders')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_orders')
  );

-- ============================================================
-- 6. NOTIFICATIONS: Allow managers to insert notifications
-- ============================================================
DROP POLICY IF EXISTS "Insert notifications" ON notifications;
CREATE POLICY "Insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_users')
    OR is_manager_with_permission('manage_orders')
    OR is_manager_with_permission('manage_promotions')
    OR is_manager_with_permission('manage_accounts')
  );

-- ============================================================
-- 7. Clean up old duplicate order policies from earlier migration
-- ============================================================
DROP POLICY IF EXISTS "Admins and master can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins and master can update all orders" ON orders;
DROP POLICY IF EXISTS "Managers can view orders in permitted regions" ON orders;
DROP POLICY IF EXISTS "Managers can update orders in permitted regions" ON orders;
