/*
  # Auto-confirm users on signup

  ## Problem
  Supabase has email confirmation enabled by default. When users sign up,
  they get an "Email not confirmed" error when trying to log in because
  this application does not use email confirmation flow.

  ## Solution
  Update the handle_new_user trigger to auto-confirm users by setting
  email_confirmed_at in auth.users when a new user is created.

  ## Changes
  - Updated handle_new_user function to also confirm the user's email
  - Sets email_confirmed_at to now() so the user can immediately log in
  - Maintains all existing profile creation logic

  ## Security
  - This is appropriate because the app uses admin account approval instead
    of email confirmation as its verification mechanism
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_country_code text;
  v_prospect_rank_id uuid;
BEGIN
  v_country_code := COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CA');
  
  SELECT id INTO v_prospect_rank_id FROM public.ranks WHERE name = 'Prospect' LIMIT 1;
  
  INSERT INTO public.profiles (id, email, full_name, country_code, role, account_status, current_rank_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    v_country_code,
    'user',
    'pending',
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
