/*
  # Allow users to insert their own profile during signup
  
  ## Changes
    - Add INSERT policy for profiles table
    - Allows authenticated users to insert their own profile record
    - Required for the signup flow to work correctly
  
  ## Security
    - Users can only insert a profile with their own auth.uid()
    - This is critical for the registration process
*/

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);