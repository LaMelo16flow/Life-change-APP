/*
  # Fix infinite recursion in profiles policies
  
  ## Problem
    - The admin policy checks profiles table to verify admin role
    - This creates infinite recursion when accessing profiles
  
  ## Solution
    - Remove the recursive admin policy
    - Keep simple user-level policies that work without recursion
    - Admins can be granted elevated access through service role if needed
  
  ## Security
    - Users can view all profiles (needed for team/referral features)
    - Users can only modify their own profile
    - Users can insert their own profile during signup
*/

DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Simplified policies without recursion
CREATE POLICY "Users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile only"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
  
-- Clean up duplicate policies
DROP POLICY IF EXISTS "Users can view other profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;