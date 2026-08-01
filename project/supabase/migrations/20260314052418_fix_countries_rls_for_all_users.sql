/*
  # Fix countries table access for all users
  
  ## Problem
  The countries table RLS policy only allows 'anon' role to view countries.
  Authenticated users cannot see the country list, which breaks the signup form
  and any other feature that needs country data.
  
  ## Solution
  Update the policy to allow both anonymous and authenticated users to view
  active countries.
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view countries" ON countries;

-- Create new policy that allows both anon and authenticated users
CREATE POLICY "Anyone can view active countries"
  ON countries
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
