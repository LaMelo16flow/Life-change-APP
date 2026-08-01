/*
  # Allow public access to countries table
  
  Users are not authenticated during signup, so they need public access to view available countries.
*/

DROP POLICY IF EXISTS "Anyone can view countries" ON countries;

CREATE POLICY "Anyone can view countries"
  ON countries
  FOR SELECT
  TO public
  USING (is_active = true);
