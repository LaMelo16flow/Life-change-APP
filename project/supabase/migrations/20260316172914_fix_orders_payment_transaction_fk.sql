/*
  # Fix orders.payment_transaction_id FK constraint

  ## Problem
  When deleting a user, `payment_transactions` cascades from `auth.users`,
  but `orders.payment_transaction_id` has NO ACTION referencing
  `payment_transactions`, blocking the cascade.

  ## Solution
  Change `orders.payment_transaction_id` FK to SET NULL so that
  payment transaction deletion does not block user account deletion.
  Orders are preserved for audit purposes with the transaction reference nullified.

  ## Changes
  - `orders.payment_transaction_id` FK: NO ACTION -> SET NULL
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_transaction_id_fkey') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_payment_transaction_id_fkey;
    ALTER TABLE orders ADD CONSTRAINT orders_payment_transaction_id_fkey
      FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;
