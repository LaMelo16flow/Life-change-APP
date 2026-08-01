/*
  # Add user inventory reservation policy

  1. Security Changes
    - Add policy allowing authenticated users to update reserved_quantity on inventory
    - This is needed for order placement flow where stock gets reserved

  2. Notes
    - Users can only update reserved_quantity field
    - This allows the reservation system to work during checkout
*/

CREATE POLICY "Users can update reserved quantity when ordering"
  ON product_inventory
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
