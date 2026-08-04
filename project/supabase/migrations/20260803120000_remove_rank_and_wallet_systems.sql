/*
  # Remove Rank system and Wallet/balance payment system

  1. Changes
    - Rewrite `handle_new_user()` to stop assigning a default "Prospect" rank on
      signup, since the `ranks` table is being dropped in this migration.
    - Replace the rank-gated "Users can view eligible meetings" policy with a
      simple authenticated-visibility policy (meetings has no frontend
      consumer today, but the table itself is kept).
    - Drop rank objects: `promotion_requests`, `rank_requirements`, `ranks`,
      and `profiles.current_rank_id` (plus the dangling `min_rank_id` FK
      columns on `groups`/`meetings` that pointed at `ranks`).
    - Drop wallet objects: `transactions` (wallet ledger), `process_transaction()`,
      and `profiles.balance` / `profiles.currency`. The app's checkout flow no
      longer gates or debits a wallet balance - orders are stock-based only,
      payment is handled outside the app.

  2. Notes
    - `wallet_transactions` (referenced from the old Cart/OrderManagement code)
      has no CREATE TABLE in any tracked migration - it does not exist in this
      migration history, so there is nothing to drop for it here.
*/

-- 1. Rewrite handle_new_user() to stop assigning a default rank
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_country_code text;
  v_require_approval boolean;
  v_account_status text;
BEGIN
  v_country_code := COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CA');

  SELECT COALESCE((value->>'enabled')::boolean, true)
  INTO v_require_approval
  FROM public.admin_settings
  WHERE key = 'require_account_approval';

  IF v_require_approval IS NULL THEN
    v_require_approval := true;
  END IF;

  v_account_status := CASE WHEN v_require_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.profiles (id, email, full_name, country_code, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    v_country_code,
    'user',
    v_account_status
  );

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = '',
      confirmation_sent_at = NULL
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Replace the rank-gated meetings visibility policy
DROP POLICY IF EXISTS "Users can view eligible meetings" ON meetings;
CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (true);

-- 3. Drop rank objects
DROP TABLE IF EXISTS promotion_requests CASCADE;
DROP TABLE IF EXISTS rank_requirements CASCADE;

ALTER TABLE groups DROP COLUMN IF EXISTS min_rank_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS min_rank_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS current_rank_id;

DROP TABLE IF EXISTS ranks CASCADE;

-- 4. Drop wallet objects
DROP TABLE IF EXISTS transactions CASCADE;
DROP FUNCTION IF EXISTS process_transaction(uuid, text, numeric, text, jsonb);

ALTER TABLE profiles DROP COLUMN IF EXISTS balance;
ALTER TABLE profiles DROP COLUMN IF EXISTS currency;
