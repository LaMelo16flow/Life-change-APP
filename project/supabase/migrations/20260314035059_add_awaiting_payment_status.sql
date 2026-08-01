/*
  # Add awaiting_payment status to orders

  1. Changes
    - Add 'awaiting_payment' to the orders status check constraint
    - This enables a new workflow step: pending -> approved -> awaiting_payment -> completed
    - When admin approves, stock is reserved and order moves to awaiting_payment
    - User sees the admin email as the payment address and submits payment proof

  2. Notes
    - Existing orders with 'approved' status are unaffected
    - The new status sits between 'approved' and 'completed' in the workflow
*/

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'approved'::text,
    'awaiting_payment'::text,
    'rejected'::text,
    'completed'::text,
    'cancelled'::text
  ]));
