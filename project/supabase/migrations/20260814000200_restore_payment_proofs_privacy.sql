/*
  # Restore payment-proofs storage bucket to private

  1. Problem
    - 20260314061201_create_payment_proofs_storage.sql set the
      payment-proofs bucket to public=true and added a SELECT policy
      scoped `TO public USING (bucket_id = 'payment-proofs')` with no
      folder/ownership restriction. Since that policy also governs the
      Storage list() API (not just direct object GET), any anonymous
      caller could enumerate every user's upload folder and every order's
      proof filename, then download each file with no authentication -
      exposing every user's bank/e-transfer payment confirmation
      screenshots.

  2. Fix
    - Set the bucket back to private and drop the unscoped public SELECT
      policy, restoring folder-scoped access (owner, or admin/manager
      with manage_orders). The app switches to signed URLs
      (createSignedUrl) for displaying proofs instead of public URLs.
*/

UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

DROP POLICY IF EXISTS "Public can view payment proofs" ON storage.objects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Users and admins can view payment proofs'
  ) THEN
    CREATE POLICY "Users and admins can view payment proofs"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR is_admin_or_master()
          OR is_manager_with_permission('manage_orders')
        )
      );
  END IF;
END $$;
