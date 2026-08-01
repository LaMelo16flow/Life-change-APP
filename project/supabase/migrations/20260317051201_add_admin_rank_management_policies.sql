/*
  # Add Admin Rank Management Policies

  1. Security Changes
    - Add INSERT policy for admins and managers to create new ranks
    - Add UPDATE policy for admins and managers to edit ranks
    - Add DELETE policy for admins to delete ranks
    
  2. Notes
    - Only admins (role = 'admin') and managers (role = 'manager') can modify ranks
    - Delete is restricted to admins only for safety
*/

CREATE POLICY "Admins and managers can insert ranks"
  ON ranks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update ranks"
  ON ranks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete ranks"
  ON ranks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
