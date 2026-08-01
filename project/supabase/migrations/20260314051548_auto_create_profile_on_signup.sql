/*
  # Auto-create profile on user signup
  
  ## Problem
  When users sign up via auth.signUp(), the profile isn't created because:
  1. The user isn't authenticated at that moment
  2. The frontend insert fails due to RLS policies
  
  ## Solution  
  Create a PostgreSQL trigger that automatically creates a profile record
  whenever a new user is created in auth.users. This is the standard
  Supabase pattern for handling signup flows.
  
  ## Implementation
  - Trigger fires on INSERT to auth.users
  - Auto-creates profile record with default values
  - Frontend can then update the profile with additional data like full_name and country_code
  
  ## Notes
  - Uses SECURITY DEFINER to bypass RLS during signup
  - Safely creates profile with minimal required fields
  - Profile has all required fields with sensible defaults
*/

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, country_code, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name' OR NEW.email,
    'CA',
    'user'
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
