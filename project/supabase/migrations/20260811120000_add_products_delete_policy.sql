/*
  # Restore missing DELETE policy on products and product_prices

  1. Problem
    - 20251226234552_remove_all_recursive_admin_policies.sql dropped the
      original "Admins can manage products"/"...product prices" FOR ALL
      policies (to fix RLS infinite recursion on signup/login).
    - 20260125092020_add_admin_product_management_policies.sql and
      20260317040217_fix_manager_product_prices_promotions_rls.sql later
      restored SELECT/INSERT/UPDATE policies on both tables, but never a
      DELETE policy. Every other admin-manageable table already has one.
    - Result: DELETE statements against products/product_prices are allowed
      to execute but match zero rows under RLS - no error is raised, so the
      product silently fails to delete and reappears after refetch.

  2. Fix
    - Add a DELETE policy on both tables, matching the permission check
      already used for INSERT/UPDATE on these same tables: admin/master,
      or manager with the 'manage_products' permission.
*/

DROP POLICY IF EXISTS "Admins and managers can delete products" ON products;
CREATE POLICY "Admins and managers can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );

DROP POLICY IF EXISTS "Admins and managers can delete product prices" ON product_prices;
CREATE POLICY "Admins and managers can delete product prices"
  ON product_prices FOR DELETE
  TO authenticated
  USING (
    is_admin_or_master()
    OR is_manager_with_permission('manage_products')
  );
