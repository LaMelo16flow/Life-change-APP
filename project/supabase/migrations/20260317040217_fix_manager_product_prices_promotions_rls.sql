/*
  # Fix Manager RLS for Product Prices and Promotions

  Managers with 'manage_products' permission could not insert/update product prices
  or manage product promotions (deals) because the RLS policies only checked for admin/master role.

  1. Product Prices
    - Replace admin-only INSERT policy to include managers with 'manage_products'
    - Replace admin-only UPDATE policy to include managers with 'manage_products'

  2. Product Promotions (Deals)
    - Replace admin-only INSERT policy to include managers with 'manage_products'
    - Replace admin-only UPDATE policy to include managers with 'manage_products'
    - Replace admin-only DELETE policy to include managers with 'manage_products'
*/

-- ============================================================
-- 1. PRODUCT PRICES: Allow managers with 'manage_products' to insert/update
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert product prices" ON product_prices;
CREATE POLICY "Admins and managers can insert product prices"
  ON product_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

DROP POLICY IF EXISTS "Admins can update product prices" ON product_prices;
CREATE POLICY "Admins and managers can update product prices"
  ON product_prices FOR UPDATE
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
-- 2. PRODUCT PROMOTIONS: Allow managers with 'manage_products' to manage deals
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert product promotions" ON product_promotions;
CREATE POLICY "Admins and managers can insert product promotions"
  ON product_promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

DROP POLICY IF EXISTS "Admins can update product promotions" ON product_promotions;
CREATE POLICY "Admins and managers can update product promotions"
  ON product_promotions FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

DROP POLICY IF EXISTS "Admins can delete product promotions" ON product_promotions;
CREATE POLICY "Admins and managers can delete product promotions"
  ON product_promotions FOR DELETE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );
