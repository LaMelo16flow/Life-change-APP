/*
  # Fix set_profile_currency trigger function

  1. Bug Fix
    - The `set_profile_currency` trigger was referencing `NEW.currency_code` 
      but the actual column on `profiles` is named `currency`
    - This caused all new user signups to fail with "Database error saving new user"
      because the trigger crashed on INSERT into profiles

  2. Changes
    - Updated `set_profile_currency()` to set `NEW.currency` instead of `NEW.currency_code`
*/

CREATE OR REPLACE FUNCTION public.set_profile_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.country_code IS NOT NULL AND (OLD IS NULL OR OLD.country_code IS DISTINCT FROM NEW.country_code) THEN
    NEW.currency := get_currency_for_country(NEW.country_code);
  END IF;
  RETURN NEW;
END;
$function$;
