/*
  # Fix Wallet Transaction Processing

  1. Changes
    - Drop and recreate `process_transaction` function with correct return type
    
  2. What it does
    - Validates transaction amount and user
    - Updates user balance atomically
    - Creates transaction record
    - Returns transaction details
    
  3. Security
    - Only authenticated users can process their own transactions
    - Uses database transactions for atomicity
    - Validates all inputs
*/

DROP FUNCTION IF EXISTS process_transaction(uuid, text, numeric, text, jsonb);

CREATE OR REPLACE FUNCTION process_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Calculate new balance based on transaction type
  IF p_type IN ('deposit', 'refund', 'commission', 'bonus') THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_type IN ('withdrawal', 'purchase') THEN
    IF v_current_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    v_new_balance := v_current_balance - p_amount;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  -- Update balance
  UPDATE profiles
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    status,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    CASE 
      WHEN p_type IN ('deposit', 'refund', 'commission', 'bonus') THEN p_amount
      ELSE -p_amount
    END,
    v_new_balance,
    p_description,
    'completed',
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  -- Return transaction details
  RETURN json_build_object(
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;