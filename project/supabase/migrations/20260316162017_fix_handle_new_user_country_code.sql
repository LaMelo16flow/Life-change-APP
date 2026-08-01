/*
  # Fix handle_new_user trigger to use country_code from metadata
  
  ## Problem
  The trigger was hardcoding 'CA' as the country_code instead of using the 
  value passed from the signup form via raw_user_meta_data.
  
  ## Solution
  - Read country_code from NEW.raw_user_meta_data->>'country_code'
  - Default to 'CA' only if no country_code is provided
  
  ## Changes
  - Updated handle_new_user function to use metadata country_code
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
  RETURN NEW;
END;
$$;
