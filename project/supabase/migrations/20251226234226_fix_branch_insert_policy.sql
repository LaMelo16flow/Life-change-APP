/*
  # Fix branch insert policy for signup
  
  ## Changes
    - Update branch INSERT policy to allow new users to create their referral relationship
    - During signup, the new user (child_id) creates the branch, not the parent
    - This allows the signup flow to properly record referral relationships
  
  ## Security
    - Users can only insert branches where they are the child (new user)
    - Prevents users from falsely claiming to be someone else's referrer
*/

DROP POLICY IF EXISTS "Users can create branches" ON branches;

CREATE POLICY "Users can create branches"
  ON branches
  FOR INSERT
  TO authenticated
  WITH CHECK (child_id = auth.uid());