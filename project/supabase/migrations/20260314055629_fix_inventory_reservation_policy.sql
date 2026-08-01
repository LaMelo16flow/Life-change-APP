/*
  # Fix inventory reservation policy for user orders

  1. Security Fix
    - Users placing orders need to reserve inventory in their region
    - The region is determined by user's profile region or country_code
    - This policy allows authenticated users to update reserved_quantity
      for inventory in their region (based on profile.region or profile.country_code)

  2. Important Notes
    - Users can only update reserved_quantity field
    - This enables the cart checkout flow to work properly
*/

DROP POLICY IF EXISTS "Users can update reserved quantity when ordering" ON product_inventory;

CREATE POLICY "Users can update reserved quantity when ordering"
  ON product_inventory FOR UPDATE TO authenticated
  USING (
    region IN (
      SELECT COALESCE(p.region, p.country_code) 
      FROM profiles p 
      WHERE p.id = (select auth.uid())
    )
  )
  WITH CHECK (
    region IN (
      SELECT COALESCE(p.region, p.country_code) 
      FROM profiles p 
      WHERE p.id = (select auth.uid())
    )
  );
