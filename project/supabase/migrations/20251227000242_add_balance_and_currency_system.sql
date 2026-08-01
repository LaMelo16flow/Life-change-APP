/*
  # Add Balance and Currency System

  1. Changes to Profiles Table
    - `balance` (numeric) - User's account balance with 2 decimal precision
    - `currency` (text) - Currency code based on user's country (USD, EUR, GBP, etc.)

  2. New Tables
    - `transactions`
      - `id` (uuid, primary key) - Unique transaction identifier
      - `user_id` (uuid) - Reference to user who owns this transaction
      - `type` (text) - Transaction type (deposit, withdrawal, purchase, refund)
      - `amount` (numeric) - Transaction amount (positive or negative)
      - `balance_after` (numeric) - Balance after this transaction
      - `description` (text) - Description of the transaction
      - `status` (text) - Transaction status (pending, completed, failed)
      - `metadata` (jsonb) - Additional transaction data
      - `created_at` (timestamptz) - When the transaction was created

  3. Security
    - Enable RLS on transactions table
    - Users can only view their own transactions
    - Only authenticated users can create transactions for themselves

  4. Indexes
    - Add indexes for efficient querying of transactions by user and date
*/

-- Add balance and currency to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN balance numeric(10, 2) DEFAULT 0.00 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'currency'
  ) THEN
    ALTER TABLE profiles ADD COLUMN currency text DEFAULT 'USD' NOT NULL;
  END IF;
END $$;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'purchase', 'refund', 'commission', 'bonus')),
  amount numeric(10, 2) NOT NULL,
  balance_after numeric(10, 2) NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to update balance and create transaction
CREATE OR REPLACE FUNCTION process_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  v_new_balance := v_current_balance + p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE profiles
  SET balance = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (p_user_id, p_type, p_amount, v_new_balance, p_description, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
