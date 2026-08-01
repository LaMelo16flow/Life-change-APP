/*
  # Fix handle_new_user trigger function
  
  ## Problem
  The existing trigger has invalid SQL syntax:
  `NEW.raw_user_meta_data->>'full_name' OR NEW.email`
  This is not valid SQL - OR is a boolean operator, not a fallback operator.
  
  ## Solution
  Use COALESCE to properly handle the fallback from full_name metadata to email.
  Also use NULLIF to handle empty strings properly.
  
  ## Changes
  - Fix syntax: Use COALESCE instead of OR for fallback logic
  - Handle empty full_name strings with NULLIF
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, country_code, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    'CA',
    'user',
    'pending'
  );
  RETURN NEW;
END;
$$;
