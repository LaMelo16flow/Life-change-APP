/*
  # Enforce real pricing/PV on orders and block order self-approval

  1. Problem
    - orders/order_items INSERT policies only check row ownership, never
      validating unit_price/total_amount/subtotal/pv_value against the
      real product_prices/products.pv_value. A user could bypass the app
      UI and POST an order with unit_price:0.01 and order_items with
      pv_value:999999 directly to the REST API; an admin later verifying
      payment would credit the forged PV straight to profiles.total_pv,
      trusting the client-supplied value verbatim.
    - Separately, "Users can update their orders with payment proof"
      (region-scoped only by user_id = auth.uid()) lets a user PATCH
      their own order's status/approved_by/total_amount/etc directly,
      self-approving or self-completing an order without any admin
      action.

  2. Fix
    - order_items gets a BEFORE INSERT trigger that overwrites
      unit_price/pv_value with the real values from product_prices/
      products and recomputes subtotal, regardless of what the client
      submitted. This is promotion-safe: unit price is never
      promotion-dependent (promotions only add free_quantity, which
      order_items already tracks separately), so this is an exact fix,
      not an approximation.
    - orders.total_amount is kept in sync via an AFTER trigger on
      order_items that recomputes it as SUM(subtotal) across the order's
      items - every order (single-product or cart) always has matching
      order_items rows, so this covers both checkout paths.
    - orders gets a BEFORE UPDATE trigger that reverts status/approval/
      financial/admin fields to their previous values unless the caller
      is admin/master or a manager with manage_orders - the legitimate
      user-initiated payment-proof fields (payment_screenshot_url,
      payment_submitted_at, payment_notes) are left untouched.
*/

CREATE OR REPLACE FUNCTION enforce_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region text;
  v_real_price numeric;
  v_real_pv numeric;
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_item_pricing_trigger ON order_items;
CREATE TRIGGER enforce_order_item_pricing_trigger
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_order_item_pricing();

CREATE OR REPLACE FUNCTION sync_order_total_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_sum numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_sum FROM order_items WHERE order_id = v_order_id;

  UPDATE orders SET total_amount = v_sum WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_order_total_after_items_trigger ON order_items;
CREATE TRIGGER sync_order_total_after_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_total_from_items();

CREATE OR REPLACE FUNCTION protect_order_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_admin_or_master() OR is_manager_with_permission('manage_orders') THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_order_privileged_fields_trigger ON orders;
CREATE TRIGGER protect_order_privileged_fields_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION protect_order_privileged_fields();
