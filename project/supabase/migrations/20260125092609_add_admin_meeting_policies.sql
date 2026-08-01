/*
  # Add Admin Meeting Management Policies

  1. Overview
    - Allows admins to manage meeting participants and attendance
    - Admins can delete meetings

  2. New Policies
    - Admins can view all meeting data
    - Admins can manage participants and attendance
    - Admins can delete meetings

  3. Security
    - Only users with role='admin' can perform these actions
*/

-- Allow admins to delete meetings
CREATE POLICY "Admins can delete meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to view all meeting participants
CREATE POLICY "Admins can view all participants"
  ON meeting_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to delete meeting participants
CREATE POLICY "Admins can remove participants"
  ON meeting_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to view all attendance
CREATE POLICY "Admins can view all attendance records"
  ON meeting_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update attendance
CREATE POLICY "Admins can update attendance records"
  ON meeting_attendance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
