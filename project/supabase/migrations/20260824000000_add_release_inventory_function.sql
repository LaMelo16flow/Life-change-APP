/*
  # Add release_inventory() to undo a reservation made by the current user

  1. Problem
    - reserve_inventory() lets a regular user atomically reserve stock at
      checkout, but there is no symmetric function to undo it. If checkout
      fails partway through (e.g. a second item's reservation fails because
      someone else took the last units, or the order/order_items insert
      fails after reservation succeeded), the client has no way to release
      the reservation it just made - a direct UPDATE on product_inventory
      is blocked by RLS for non-admins. That reservation then leaks
      permanently: it's not tied to any order_items row an admin can later
      reject/cancel to release it.

  2. Fix
    - Add a SECURITY DEFINER function `release_inventory`, mirroring
      reserve_inventory, that atomically locks the row and decrements
      reserved_quantity (floored at 0), logging the release - callable by
      any authenticated user to compensate their own failed checkout.
*/

CREATE OR REPLACE FUNCTION release_inventory(
  p_product_id uuid,
  p_region text,
  p_quantity integer,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved integer;
BEGIN
  SELECT reserved_quantity INTO v_reserved
  FROM product_inventory
  WHERE product_id = p_product_id AND region = p_region
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE product_inventory
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity)
  WHERE product_id = p_product_id AND region = p_region;

  INSERT INTO inventory_logs (product_id, region, action, quantity_change, quantity_after, performed_by, notes)
  VALUES (p_product_id, p_region, 'release', p_quantity, GREATEST(0, v_reserved - p_quantity), auth.uid(), p_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION release_inventory(uuid, text, integer, text) TO authenticated;
