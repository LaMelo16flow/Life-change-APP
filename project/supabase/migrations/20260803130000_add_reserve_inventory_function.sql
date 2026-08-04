/*
  # Add reserve_inventory() for checkout stock reservation

  1. Problem
    - `product_inventory` only grants UPDATE via RLS to admins ("Admins can
      update inventory"). Cart.tsx and Shop.tsx checkout both run as a
      regular authenticated user and directly UPDATE reserved_quantity -
      RLS silently blocks the write (0 rows affected, no error thrown), so
      orders are created fine but stock is never actually reserved. This
      lets available-stock numbers drift and the stockist can approve more
      than is really in stock.

  2. Fix
    - Add a SECURITY DEFINER function `reserve_inventory` that atomically
      locks the inventory row, re-validates available stock, increments
      reserved_quantity, and logs the reservation - callable by any
      authenticated user for their own checkout, without opening broad
      UPDATE access to the table.
*/

CREATE OR REPLACE FUNCTION reserve_inventory(
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
  v_quantity integer;
  v_reserved integer;
BEGIN
  SELECT quantity, reserved_quantity INTO v_quantity, v_reserved
  FROM product_inventory
  WHERE product_id = p_product_id AND region = p_region
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory not found for this product in this region';
  END IF;

  IF (v_quantity - v_reserved) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock available';
  END IF;

  UPDATE product_inventory
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE product_id = p_product_id AND region = p_region;

  INSERT INTO inventory_logs (product_id, region, action, quantity_change, quantity_after, performed_by, notes)
  VALUES (p_product_id, p_region, 'reservation', -p_quantity, v_quantity, auth.uid(), p_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_inventory(uuid, text, integer, text) TO authenticated;
