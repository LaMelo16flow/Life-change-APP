/*
  # Add admin/manager INSERT, UPDATE, DELETE policies on order_items

  1. New Policies on `order_items`
    - Admins and master can insert order items (needed for merging orders)
    - Admins and master can delete order items (needed for merging orders)
    - Admins and master can update order items (needed for promotions)
    - Managers with manage_orders permission can insert/delete/update order items in their regions

  2. Important Notes
    - These policies use the existing is_admin_or_master() helper function
    - Manager policies check region via the parent orders table
    - Required for the order merge feature where admin consolidates multiple pending orders
*/

CREATE POLICY "Admins can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_master());

CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (is_admin_or_master());

CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (is_admin_or_master())
  WITH CHECK (is_admin_or_master());

CREATE POLICY "Managers can insert order items in permitted regions"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      JOIN orders o ON o.id = order_items.order_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR o.region = ANY(mp.regions))
    )
  );

CREATE POLICY "Managers can delete order items in permitted regions"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      JOIN orders o ON o.id = order_items.order_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR o.region = ANY(mp.regions))
    )
  );

CREATE POLICY "Managers can update order items in permitted regions"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      JOIN orders o ON o.id = order_items.order_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR o.region = ANY(mp.regions))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manager_permissions mp
      JOIN profiles p ON p.id = mp.user_id
      JOIN orders o ON o.id = order_items.order_id
      WHERE mp.user_id = auth.uid()
      AND mp.permission = 'manage_orders'
      AND p.role = 'manager'
      AND (mp.regions IS NULL OR o.region = ANY(mp.regions))
    )
  );