/*
  # Security fix: close two vulnerabilities found in review

  1. release_inventory() had no authorization check at all - it trusted
     whatever product_id/region/quantity the caller passed and decremented
     reserved_quantity accordingly. Since it's SECURITY DEFINER and (as
     verified live) reachable even by a fully anonymous caller via the
     public anon key, anyone could zero out ANY product's reserved_quantity
     regardless of who actually holds the reservation - making stock
     legitimately held by other customers' pending/awaiting-payment orders
     look available again, enabling overselling and griefing of other
     customers' orders.

     Fix: reserve_inventory now returns a single-use `token` recording
     exactly what it reserved and for which caller. release_inventory
     takes ONLY that token - the quantity released is read from the
     token row server-side, never trusted from the client, and a token
     can only be consumed once and only by the user (or an admin) who
     was issued it. This preserves the legitimate use case (rolling back
     a reservation made moments earlier in the same checkout attempt,
     before any order row exists to tie it to) without trusting
     client-supplied release amounts.

  2. get_inventory_alert_recipients(), added in the previous migration,
     leaks every admin/inventory-manager's email address to any caller,
     verified reachable by a fully anonymous request. It was never
     actually wired into the app (the low-stock alert code path uses its
     own RLS-respecting queries instead), so it's dead code purely
     exposing PII for phishing/targeting. Revoking public access removes
     the exposure; nothing in the app calls it.

  3. Both reserve_inventory and release_inventory are explicitly revoked
     from `anon` (Supabase's public schema grants EXECUTE to anon by
     default for new functions unless revoked) - these were only ever
     meant for a logged-in user's own checkout per their original design
     comment, not anonymous callers.
*/

REVOKE EXECUTE ON FUNCTION get_inventory_alert_recipients() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS reservation_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  region text NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed boolean NOT NULL DEFAULT false
);

ALTER TABLE reservation_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the SECURITY DEFINER functions below
-- (running as table owner, bypassing RLS) ever touch this table.

CREATE OR REPLACE FUNCTION reserve_inventory(
  p_product_id uuid,
  p_region text,
  p_quantity integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity integer;
  v_reserved integer;
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to reserve stock';
  END IF;

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

  INSERT INTO reservation_tokens (user_id, product_id, region, quantity)
  VALUES (auth.uid(), p_product_id, p_region, p_quantity)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION release_inventory(
  p_token uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservation_tokens%ROWTYPE;
  v_reserved integer;
BEGIN
  SELECT * INTO v_row
  FROM reservation_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or already-used reservation token';
  END IF;

  IF v_row.consumed THEN
    RAISE EXCEPTION 'This reservation was already released';
  END IF;

  IF v_row.user_id != auth.uid() AND NOT is_admin_or_master() THEN
    RAISE EXCEPTION 'Not authorized to release this reservation';
  END IF;

  UPDATE reservation_tokens SET consumed = true WHERE token = p_token;

  SELECT reserved_quantity INTO v_reserved
  FROM product_inventory
  WHERE product_id = v_row.product_id AND region = v_row.region
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE product_inventory
  SET reserved_quantity = GREATEST(0, reserved_quantity - v_row.quantity)
  WHERE product_id = v_row.product_id AND region = v_row.region;

  INSERT INTO inventory_logs (product_id, region, action, quantity_change, quantity_after, performed_by, notes)
  VALUES (v_row.product_id, v_row.region, 'release', v_row.quantity, GREATEST(0, v_reserved - v_row.quantity), auth.uid(), p_notes);
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_inventory(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION release_inventory(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reserve_inventory(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION release_inventory(uuid, text) TO authenticated;
