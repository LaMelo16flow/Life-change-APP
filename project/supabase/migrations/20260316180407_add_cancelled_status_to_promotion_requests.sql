/*
  # Add cancelled status to promotion requests

  1. Changes to `promotion_requests` table
    - Add 'cancelled' to the allowed status values
    - This allows auto-cancellation when a user's PV drops below the required threshold

  2. Important Notes
    - Existing promotion requests are not affected
    - The cancelled status is used when PV no longer meets requirements
    - Users can also manually cancel their own pending requests
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'promotion_requests_status_check'
  ) THEN
    ALTER TABLE promotion_requests DROP CONSTRAINT promotion_requests_status_check;
  END IF;
END $$;

ALTER TABLE promotion_requests
  ADD CONSTRAINT promotion_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

CREATE POLICY "Users can cancel own pending promotion requests"
  ON promotion_requests
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );