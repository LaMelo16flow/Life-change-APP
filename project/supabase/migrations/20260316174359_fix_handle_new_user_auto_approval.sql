/*
  # Fix handle_new_user trigger to respect auto-approval setting

  1. Changes
    - Restore the approval-check logic in `handle_new_user()` trigger function
    - The function now reads `require_account_approval` from `admin_settings`
    - If approval is NOT required (`enabled = false`), new users get `account_status = 'approved'`
    - If approval IS required (`enabled = true` or setting missing), new users get `account_status = 'pending'`

  2. Important Notes
    - The previous version of this trigger always hardcoded `account_status = 'pending'`
    - This fix restores the intended behavior from the approval toggle migration
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_country_code text;
  v_prospect_rank_id uuid;
  v_require_approval boolean;
  v_account_status text;
BEGIN
  v_country_code := COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CA');

  SELECT id INTO v_prospect_rank_id FROM public.ranks WHERE name = 'Prospect' LIMIT 1;

  SELECT COALESCE((value->>'enabled')::boolean, true)
  INTO v_require_approval
  FROM public.admin_settings
  WHERE key = 'require_account_approval';

  IF v_require_approval IS NULL THEN
    v_require_approval := true;
  END IF;

  v_account_status := CASE WHEN v_require_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.profiles (id, email, full_name, country_code, role, account_status, current_rank_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    v_country_code,
    'user',
    v_account_status,
    v_prospect_rank_id
  );

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = '',
      confirmation_sent_at = NULL
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;