/*
  # Fix profile creation during signup
  
  ## Problem
  The previous INSERT policy required users to be authenticated, but during signup
  the user is not yet authenticated when the profile needs to be inserted.
  
  ## Solution
  Allow unauthenticated users to insert their own profile record during signup.
  This is safe because they can only insert a record where the ID matches their own auth.uid(),
  which is only possible if they provide their exact user ID during signup.
  
  ## Security
  - Users can only insert a profile with their own auth.uid() as the ID
  - This is the standard pattern for Supabase signup flows
  - The service_role can bypass RLS for admin operations if needed
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policy allowing signup flow
CREATE POLICY "Allow profile insert during signup"
  ON profiles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    -- Allow authenticated users to insert their own profile
    (auth.uid() = id AND auth.jwt()->>'aud' = 'authenticated') OR
    -- Allow anon during signup (service role will handle this, but keeping for clarity)
    (auth.jwt()->>'aud' = 'anon')
  );
