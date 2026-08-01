/*
  # Add account approval toggle setting

  1. New Settings
    - `require_account_approval` in `admin_settings` table
      - Controls whether new accounts need admin approval before they can sign in
      - Default: enabled (true)

  2. Changes
    - Insert new admin_settings row with key `require_account_approval`
    - Update `handle_new_user` trigger to check this setting
      - If approval is required, account_status = 'pending'
      - If approval is not required, account_status = 'approved'

  3. Security
    - Add UPDATE policy on admin_settings for admins/master
    - Existing SELECT policy already allows non-private keys to be read by all
*/

INSERT INTO admin_settings (key, value, description)
VALUES (
  'require_account_approval',
  '{"enabled": true}'::jsonb,
  'Controls whether new accounts require admin approval before sign-in'
)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_settings' AND policyname = 'Admins can update admin settings'
  ) THEN
    CREATE POLICY "Admins can update admin settings"
      ON admin_settings
      FOR UPDATE
      TO authenticated
      USING (is_admin_or_master())
      WITH CHECK (is_admin_or_master());
  END IF;
END $$;

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
  RETURN NEW;
END;
$$;
