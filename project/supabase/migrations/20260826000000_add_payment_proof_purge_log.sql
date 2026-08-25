/*
  # Periodic payment-proof cleanup: keep a log, drop the image

  1. Problem
    - Payment screenshot proofs (storage bucket `payment-proofs`) are kept
      forever once uploaded, even long after an order is completed/
      rejected/cancelled and the proof no longer serves any purpose -
      pure storage cost with no offsetting value.

  2. Fix
    - `payment_proof_logs`: a lightweight audit record (order, original
      storage path, when it was submitted, when it was purged) created
      right before the actual image is deleted, so the fact that a proof
      was submitted and verified/rejected is never lost even after the
      image itself is gone.
    - `orders.payment_proof_purged`: flag so the UI can show "proof was
      submitted, now archived" instead of a broken image link once
      `payment_screenshot_url` is nulled out.
    - `admins_can_view_payment_proof_logs`: admins/master can read the
      log for audit purposes.

  3. Notes
    - This migration only adds the bookkeeping. The actual Storage
      object deletion happens in the purge-old-payment-proofs edge
      function (Storage deletion is an API operation, not a plain SQL
      DELETE) - see supabase/functions/purge-old-payment-proofs.
*/

CREATE TABLE IF NOT EXISTS payment_proof_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  original_path text NOT NULL,
  submitted_at timestamptz,
  purged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_purged boolean NOT NULL DEFAULT false;

ALTER TABLE payment_proof_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and master can view payment proof logs"
  ON payment_proof_logs FOR SELECT
  TO authenticated
  USING (is_admin_or_master());
