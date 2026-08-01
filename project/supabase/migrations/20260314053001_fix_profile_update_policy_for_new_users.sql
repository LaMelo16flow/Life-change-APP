/*
  # Fix profile update policy for newly signed up users
  
  ## Problem
  When a user signs up, they are immediately authenticated but need to update
  their profile with full_name and country_code. The current policies work,
  but we need to ensure the update can happen reliably.
  
  ## Solution
  Recreate the user update policy to ensure it's correct and not conflicting
  with other policies. Also ensure the policy allows updating key fields.
  
  ## Changes
  - Drop and recreate user self-update policy with explicit permissions
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update own profile only" ON profiles;

-- Create clear policy for users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
