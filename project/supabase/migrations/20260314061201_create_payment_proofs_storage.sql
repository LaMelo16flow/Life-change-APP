/*
  # Create Payment Proofs Storage Bucket

  1. Storage
    - Create payment-proofs bucket for order payment screenshots
    - Enable public read access so admins can view uploaded proofs
    - Users can only upload to their own folder

  2. Security Policies
    - Users can upload payment proofs to their own folder
    - Users can update/delete their own uploads
    - Public read access for admins to view payment proofs
*/

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view payment proofs" ON storage.objects;

-- Allow authenticated users to upload payment proofs to their own folder
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Allow authenticated users to update their own payment proofs
CREATE POLICY "Users can update own payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Allow authenticated users to delete their own payment proofs
CREATE POLICY "Users can delete own payment proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Allow public read access to payment proofs (for admins to view)
CREATE POLICY "Public can view payment proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');
