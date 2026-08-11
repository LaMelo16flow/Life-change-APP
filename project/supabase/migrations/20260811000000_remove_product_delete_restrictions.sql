-- Remove every product foreign-key restriction that blocks product deletion.
-- This makes deleting a product from the admin list actually delete the row instead of failing.

ALTER TABLE IF EXISTS public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE IF EXISTS public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.orders
  DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE IF EXISTS public.orders
  ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_product_id_fkey;
ALTER TABLE IF EXISTS public.payment_transactions
  ADD CONSTRAINT payment_transactions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.product_inventory
  DROP CONSTRAINT IF EXISTS product_inventory_product_id_fkey;
ALTER TABLE IF EXISTS public.product_inventory
  ADD CONSTRAINT product_inventory_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.inventory_logs
  DROP CONSTRAINT IF EXISTS inventory_logs_product_id_fkey;
ALTER TABLE IF EXISTS public.inventory_logs
  ADD CONSTRAINT inventory_logs_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.product_promotions
  DROP CONSTRAINT IF EXISTS product_promotions_product_id_fkey;
ALTER TABLE IF EXISTS public.product_promotions
  ADD CONSTRAINT product_promotions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;
ALTER TABLE IF EXISTS public.cart_items
  ADD CONSTRAINT cart_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.product_prices
  DROP CONSTRAINT IF EXISTS product_prices_product_id_fkey;
ALTER TABLE IF EXISTS public.product_prices
  ADD CONSTRAINT product_prices_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
