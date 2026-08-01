/*
  # Add Payment Proof Workflow and Email Notifications

  1. Changes to orders table
    - Add payment_screenshot_url column for storing payment proof
    - Add payment_submitted_at timestamp for when user submits proof
    - Add payment_verified_at timestamp for when admin verifies payment
    - Add payment_notes text field for transaction details from user
    - Add admin_email text field to store which admin should receive notifications
    
  2. New Tables
    - `admin_settings` - Store admin contact information and payment instructions
      - `key` (text, primary key) - Setting identifier
      - `value` (jsonb) - Setting value
      - `description` (text) - Setting description
      - `updated_by` (uuid) - Admin who last updated
      - `updated_at` (timestamptz) - Last update timestamp
    
  3. Storage
    - Create payment-proofs bucket for payment screenshots
    
  4. Security
    - Enable RLS on admin_settings
    - Add policies for admins to manage settings
    - Add policies for users to read certain settings (like payment instructions)
    - Add storage policies for payment-proofs bucket
*/

-- Add payment proof columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_screenshot_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_screenshot_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_submitted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_submitted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_verified_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'admin_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN admin_email text;
  END IF;
END $$;

-- Create admin_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin settings policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Admins can manage all settings'
  ) THEN
    CREATE POLICY "Admins can manage all settings"
      ON admin_settings FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Users can read public settings'
  ) THEN
    CREATE POLICY "Users can read public settings"
      ON admin_settings FOR SELECT
      TO authenticated
      USING (
        key IN ('payment_instructions', 'admin_contact_email', 'support_email')
      );
  END IF;
END $$;

-- Insert default admin settings
INSERT INTO admin_settings (key, value, description)
VALUES 
  ('admin_contact_email', '{"email": "admin@lifechangers.com"}', 'Primary admin email for order notifications')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value, description)
VALUES 
  ('payment_instructions', '{"instructions": "Please send e-transfer to the admin email provided. Include your order number in the message."}', 'Payment instructions shown to users')
ON CONFLICT (key) DO NOTHING;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-proofs bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can upload their own payment proofs'
  ) THEN
    CREATE POLICY "Users can upload their own payment proofs"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'payment-proofs' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can view their own payment proofs'
  ) THEN
    CREATE POLICY "Users can view their own payment proofs"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-proofs' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can view all payment proofs'
  ) THEN
    CREATE POLICY "Admins can view all payment proofs"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-proofs' AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can delete payment proofs'
  ) THEN
    CREATE POLICY "Admins can delete payment proofs"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'payment-proofs' AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Update order policies to allow users to update payment proof
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users can update their orders with payment proof'
  ) THEN
    CREATE POLICY "Users can update their orders with payment proof"
      ON orders FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
