/*
  # Fix infinite recursion in ranks policies
  
  ## Problem
    - Admin policy checks profiles table causing infinite recursion
    - Prevents signup flow from reading Prospect rank
  
  ## Solution
    - Remove recursive admin policy
    - Keep simple read access for all authenticated users
  
  ## Security
    - All authenticated users can view ranks (needed for signup and UI)
    - Admin modifications can be handled through service role
*/

DROP POLICY IF EXISTS "Admins can manage ranks" ON ranks;