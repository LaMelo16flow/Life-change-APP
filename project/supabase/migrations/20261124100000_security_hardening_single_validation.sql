-- Security hardening + one-step order validation (order is sent with its payment proof)

-- 1. Helpers --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (role IN ('admin', 'manager') OR is_master = true)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_orders()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT is_admin_or_master() OR is_manager_with_permission('manage_orders');
$$;

-- 2. Dangerous SECURITY DEFINER functions were callable by anyone via /rpc ----
-- process_transaction(p_user_id, 'bonus', ...) let any visitor add balance to any account.
REVOKE EXECUTE ON FUNCTION public.process_transaction(uuid, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_inventory(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_inventory_alert_recipients() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_product_cascade(uuid) FROM PUBLIC, anon;
ALTER FUNCTION public.process_transaction(uuid, text, numeric, text, jsonb) SET search_path TO 'public';
ALTER FUNCTION public.process_transaction() SET search_path TO 'public';
ALTER FUNCTION public.update_country_payment_info_timestamp() SET search_path TO 'public';

-- Trigger functions are not meant to be called directly.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- 3. Inventory: any signed-in user could change stock --------------------------
DROP POLICY IF EXISTS "Update product inventory" ON public.product_inventory;
CREATE POLICY "Update product inventory" ON public.product_inventory FOR UPDATE
  USING (is_admin_or_master() OR is_manager_with_permission('manage_inventory') OR is_manager_with_permission('manage_orders'))
  WITH CHECK (is_admin_or_master() OR is_manager_with_permission('manage_inventory') OR is_manager_with_permission('manage_orders'));

-- 4. PV: users could insert PV transactions for themselves --------------------
DROP POLICY IF EXISTS "Insert pv transactions" ON public.pv_transactions;
CREATE POLICY "Insert pv transactions" ON public.pv_transactions FOR INSERT
  WITH CHECK (can_manage_orders());

-- Credit the PV of a completed order once, computed on the server.
CREATE OR REPLACE FUNCTION public.credit_order_pv(p_order_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_raw numeric;
  v_pv integer;
BEGIN
  IF NOT can_manage_orders() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Order is not completed';
  END IF;

  IF EXISTS (SELECT 1 FROM pv_transactions WHERE reference_id = p_order_id AND transaction_type = 'purchase') THEN
    RETURN 0; -- already credited
  END IF;

  SELECT COALESCE(SUM(pv_value * (quantity + free_quantity)), 0) INTO v_raw
  FROM order_items WHERE order_id = p_order_id;
  IF v_raw = 0 AND v_order.product_id IS NOT NULL THEN
    SELECT COALESCE(pv_value, 0) * v_order.quantity INTO v_raw FROM products WHERE id = v_order.product_id;
  END IF;

  v_pv := (floor(v_raw / 30) * 30)::integer;

  INSERT INTO pv_transactions (user_id, amount, transaction_type, reference_id, reference_type, description, created_by)
  VALUES (v_order.user_id, v_pv, 'purchase', p_order_id, 'product',
          format('Order %s (raw PV %s, rounded %s)', v_order.order_number, v_raw, v_pv), auth.uid());

  PERFORM set_config('lc.trusted', 'on', true);
  UPDATE profiles SET total_pv = COALESCE(total_pv, 0) + v_pv WHERE id = v_order.user_id;
  PERFORM set_config('lc.trusted', 'off', true);

  RETURN v_pv;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.credit_order_pv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_order_pv(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('lc.trusted', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_master IS DISTINCT FROM OLD.is_master AND NOT is_admin_or_master() THEN
    NEW.is_master := OLD.is_master;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users')) THEN
    NEW.role := OLD.role;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users') OR is_manager_with_permission('manage_accounts')) THEN
    NEW.account_status := OLD.account_status;
  END IF;

  IF NEW.total_pv IS DISTINCT FROM OLD.total_pv
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users')) THEN
    NEW.total_pv := OLD.total_pv;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance AND NOT is_admin_or_master() THEN
    NEW.balance := OLD.balance;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Profiles: every user could read every customer's email, phone and address --
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Select profiles" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_staff()
    -- customers only need the staff accounts (to notify them of orders)
    OR role IN ('admin', 'manager') OR is_master = true
  );

-- 6. Orders: server decides status, totals and who can attach which proof -----
CREATE OR REPLACE FUNCTION public.guard_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF can_manage_orders() THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  NEW.approved_by := NULL;
  NEW.approved_at := NULL;
  NEW.payment_verified_at := NULL;
  NEW.rejection_reason := NULL;
  NEW.admin_notes := NULL;
  IF NEW.payment_screenshot_url IS NOT NULL
     AND split_part(NEW.payment_screenshot_url, '/', 1) <> auth.uid()::text THEN
    NEW.payment_screenshot_url := NULL;
    NEW.payment_submitted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_order_insert_trigger ON public.orders;
CREATE TRIGGER guard_order_insert_trigger BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_insert();
REVOKE EXECUTE ON FUNCTION public.guard_order_insert() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_order_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('lc.trusted', true) = 'on' OR can_manage_orders() THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.admin_notes := OLD.admin_notes;
  NEW.admin_email := OLD.admin_email;
  NEW.payment_verified_at := OLD.payment_verified_at;
  NEW.total_amount := OLD.total_amount;
  NEW.unit_price := OLD.unit_price;
  NEW.quantity := OLD.quantity;
  NEW.product_id := OLD.product_id;
  NEW.items_count := OLD.items_count;

  -- A customer can only attach a proof stored in their own folder,
  -- and cannot touch the proof of a completed/rejected order.
  IF NEW.payment_screenshot_url IS DISTINCT FROM OLD.payment_screenshot_url THEN
    IF OLD.status NOT IN ('pending', 'awaiting_payment')
       OR (NEW.payment_screenshot_url IS NOT NULL
           AND split_part(NEW.payment_screenshot_url, '/', 1) <> auth.uid()::text) THEN
      NEW.payment_screenshot_url := OLD.payment_screenshot_url;
      NEW.payment_submitted_at := OLD.payment_submitted_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Totals computed from the (server-priced) items must not be reverted by the guard above.
CREATE OR REPLACE FUNCTION public.sync_order_total_from_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order_id uuid;
  v_sum numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(subtotal), 0) INTO v_sum FROM order_items WHERE order_id = v_order_id;
  PERFORM set_config('lc.trusted', 'on', true);
  UPDATE orders SET total_amount = v_sum WHERE id = v_order_id;
  PERFORM set_config('lc.trusted', 'off', true);
  RETURN NULL;
END;
$$;

-- Free items only as the active promotion allows (customers could claim any number).
CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_region text;
  v_real_price numeric;
  v_real_pv numeric;
  v_promo record;
  v_allowed integer := 0;
BEGIN
  SELECT region INTO v_region FROM orders WHERE id = NEW.order_id;

  SELECT price INTO v_real_price FROM product_prices
  WHERE product_id = NEW.product_id AND country_code = v_region;

  SELECT pv_value INTO v_real_pv FROM products WHERE id = NEW.product_id;

  IF v_real_price IS NOT NULL THEN
    NEW.unit_price := v_real_price;
    NEW.subtotal := v_real_price * NEW.quantity;
  END IF;

  IF v_real_pv IS NOT NULL THEN
    NEW.pv_value := v_real_pv;
  END IF;

  IF NOT can_manage_orders() THEN
    SELECT id, buy_quantity, free_quantity INTO v_promo FROM product_promotions
    WHERE product_id = NEW.product_id AND is_active
      AND starts_at <= now() AND ends_at > now()
      AND (country_code IS NULL OR country_code = v_region)
    ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_promo.buy_quantity > 0 THEN
      v_allowed := (NEW.quantity / v_promo.buy_quantity) * v_promo.free_quantity;
      NEW.promotion_id := v_promo.id;
    ELSE
      NEW.promotion_id := NULL;
    END IF;
    NEW.free_quantity := LEAST(COALESCE(NEW.free_quantity, 0), v_allowed);
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Promotions: one admin section ("Promotions") for both permissions --------
DROP POLICY IF EXISTS "Admins and managers can delete product promotions" ON public.product_promotions;
DROP POLICY IF EXISTS "Admins and managers can insert product promotions" ON public.product_promotions;
DROP POLICY IF EXISTS "Admins and managers can update product promotions" ON public.product_promotions;
DROP POLICY IF EXISTS "Select product promotions" ON public.product_promotions;
CREATE POLICY "Select product promotions" ON public.product_promotions FOR SELECT
  USING (is_active = true OR is_admin_or_master() OR is_manager_with_permission('manage_promotions') OR is_manager_with_permission('manage_products'));
CREATE POLICY "Insert product promotions" ON public.product_promotions FOR INSERT
  WITH CHECK (is_admin_or_master() OR is_manager_with_permission('manage_promotions') OR is_manager_with_permission('manage_products'));
CREATE POLICY "Update product promotions" ON public.product_promotions FOR UPDATE
  USING (is_admin_or_master() OR is_manager_with_permission('manage_promotions') OR is_manager_with_permission('manage_products'))
  WITH CHECK (is_admin_or_master() OR is_manager_with_permission('manage_promotions') OR is_manager_with_permission('manage_products'));
CREATE POLICY "Delete product promotions" ON public.product_promotions FOR DELETE
  USING (is_admin_or_master() OR is_manager_with_permission('manage_promotions') OR is_manager_with_permission('manage_products'));

-- 8. Payment proofs: managers handling orders must be able to open them ------
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON storage.objects;

-- 9. Customers notify the staff when they order: allow notifications addressed to staff
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_with_permission('manage_users')
    OR is_manager_with_permission('manage_orders')
    OR is_manager_with_permission('manage_promotions')
    OR is_manager_with_permission('manage_accounts')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = notifications.user_id AND (p.role IN ('admin', 'manager') OR p.is_master = true))
  );

-- 10. Promotion emails opt-out (CASL)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promo_emails boolean NOT NULL DEFAULT true;
