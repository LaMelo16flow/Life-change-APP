/*
  # Make product deletion actually delete everything, atomically

  1. Problem
    - ProductManagement.tsx deletes a product by running 7 separate client-side
      DELETE statements (cart_items, order_items, product_prices,
      product_inventory, inventory_logs, product_promotions, orders) followed
      by a DELETE on products, all as the logged-in admin's `authenticated`
      role.
    - Auditing every migration in this repo shows RLS is enabled on `orders`,
      `product_inventory`, and `inventory_logs` but none of them has ever had
      a DELETE policy - and `cart_items` only has a DELETE policy for a user
      deleting their own row. A DELETE that matches zero rows under RLS does
      not raise an error in Postgres/PostgREST, it just silently affects 0
      rows. So those cleanup deletes were always silently no-ops for any
      order/cart item belonging to another user.
    - Net effect: the product row itself (which does have a DELETE policy as
      of 20260811120000) gets removed, but dependent orders/inventory/cart
      rows referencing it can survive, and the live-sync `postgres_changes`
      subscription's refetch can make it look like the deleted product
      "regenerated" whenever any of this leftover, orphaned-looking state is
      touched.

  2. Fix
    - Add the missing admin/manager DELETE policies on orders, product_inventory,
      inventory_logs, and cart_items (defense in depth, consistent with the
      existing "Admins and managers can delete products" policy).
    - Add a SECURITY DEFINER function `delete_product_cascade` that performs
      the entire cascade delete as one atomic, privilege-checked transaction
      instead of 8 separate client round-trips gated by per-table RLS. This
      is the same pattern already used by `reserve_inventory` for the same
      class of bug (RLS silently no-opping a write the client assumed
      succeeded).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins and managers can delete orders'
  ) THEN
    CREATE POLICY "Admins and managers can delete orders"
      ON orders FOR DELETE
      TO authenticated
      USING (
        is_admin_or_master()
        OR is_manager_with_permission('manage_products')
        OR is_manager_with_permission('manage_orders')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_inventory' AND policyname = 'Admins and managers can delete inventory'
  ) THEN
    CREATE POLICY "Admins and managers can delete inventory"
      ON product_inventory FOR DELETE
      TO authenticated
      USING (
        is_admin_or_master()
        OR is_manager_with_permission('manage_products')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_logs' AND policyname = 'Admins and managers can delete inventory logs'
  ) THEN
    CREATE POLICY "Admins and managers can delete inventory logs"
      ON inventory_logs FOR DELETE
      TO authenticated
      USING (
        is_admin_or_master()
        OR is_manager_with_permission('manage_products')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cart_items' AND policyname = 'Admins and managers can delete any cart item'
  ) THEN
    CREATE POLICY "Admins and managers can delete any cart item"
      ON cart_items FOR DELETE
      TO authenticated
      USING (
        is_admin_or_master()
        OR is_manager_with_permission('manage_products')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION delete_product_cascade(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin_or_master() OR is_manager_with_permission('manage_products')) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete products';
  END IF;

  DELETE FROM cart_items WHERE product_id = p_product_id;
  DELETE FROM order_items WHERE product_id = p_product_id;
  DELETE FROM orders WHERE product_id = p_product_id;
  DELETE FROM product_inventory WHERE product_id = p_product_id;
  DELETE FROM inventory_logs WHERE product_id = p_product_id;
  DELETE FROM product_promotions WHERE product_id = p_product_id;
  DELETE FROM product_prices WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_product_cascade(uuid) TO authenticated;
