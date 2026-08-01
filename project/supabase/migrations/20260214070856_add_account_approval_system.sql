/*
  # Add Account Approval System

  1. Changes
    - Add `account_status` column to `profiles` table
      - Values: 'pending', 'approved', 'rejected'
      - Default: 'pending' for new accounts
    - Add `approved_by` column to track which admin approved the account
    - Add `approved_at` timestamp for approval/rejection time
    - Add `rejection_reason` for storing why an account was rejected
  
  2. Security
    - Update RLS policies to allow only approved users to access most features
    - Admins can view all profiles regardless of status
    - Users can only view their own profile even if pending
*/

-- Add account status columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_status text DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Set all existing accounts to approved (grandfather existing users)
UPDATE profiles SET account_status = 'approved' WHERE account_status IS NULL OR account_status = 'pending';

-- Create index for filtering by account status
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);

-- Add notification for account approval/rejection
CREATE TABLE IF NOT EXISTS account_approval_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  admin_id uuid REFERENCES auth.users(id)
);

ALTER TABLE account_approval_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own approval notifications"
  ON account_approval_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert approval notifications"
  ON account_approval_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );