/*
  # Enable Realtime replication for shop/cart/inventory/notification tables

  1. Problem
    - Shop.tsx, Cart.tsx, ProductManagement.tsx, OrderManagement.tsx, and the
      notification badge in Dashboard.tsx all subscribe to `postgres_changes`
      on products, product_prices, product_inventory, product_promotions,
      cart_items, order_items, and notifications, expecting instant live
      updates.
    - Only `orders` was ever added to the `supabase_realtime` publication
      (confirmed live: an update to `orders` pushes a postgres_changes event
      in under a second; the same test against products/product_prices/
      product_inventory/cart_items/order_items times out - no event ever
      arrives). Every other subscription is a no-op: the UI only ever
      refreshes when a component re-mounts (tab navigation), which reads as
      "refresh is slow" since nothing is actually pushing updates.

  2. Fix
    - Add every table these components subscribe to into the
      `supabase_realtime` publication. Guarded with a check against
      pg_publication_tables so it's safe to run more than once (Postgres
      has no "ADD TABLE IF NOT EXISTS" for publications).
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'product_prices', 'product_inventory', 'product_promotions', 'cart_items', 'order_items', 'notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
