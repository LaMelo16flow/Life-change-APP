/*
  # Assign Prospect Rank by Default

  1. Changes
    - Updates handle_new_user trigger to assign 'Prospect' rank to new users
    - Updates existing profiles with null current_rank_id to have Prospect rank
    - Sets default value on current_rank_id column

  2. Details
    - Every new user will automatically start as a Prospect
    - No more N/A or null ranks displayed
*/

-- Get the Prospect rank ID and update existing null profiles
DO $$
DECLARE
  prospect_rank_id uuid;
BEGIN
  SELECT id INTO prospect_rank_id FROM ranks WHERE name = 'Prospect' LIMIT 1;
  
  IF prospect_rank_id IS NOT NULL THEN
    UPDATE profiles 
    SET current_rank_id = prospect_rank_id 
    WHERE current_rank_id IS NULL;
  END IF;
END $$;

-- Update the handle_new_user function to assign Prospect rank
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prospect_rank_id uuid;
BEGIN
  SELECT id INTO prospect_rank_id FROM ranks WHERE name = 'Prospect' LIMIT 1;
  
  INSERT INTO public.profiles (id, email, full_name, country_code, role, account_status, current_rank_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country_code', ''), 'CA'),
    'user',
    'pending',
    prospect_rank_id
  );
  RETURN NEW;
END;
$$;
