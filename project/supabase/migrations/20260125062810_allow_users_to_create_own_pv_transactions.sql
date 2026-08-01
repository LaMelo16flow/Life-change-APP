/*
  # Allow Users to Create Their Own PV Transactions

  1. Changes
    - Add INSERT policy allowing users to create PV transactions for themselves
    - This enables the shop purchase flow to work for regular users
    
  2. Security
    - Users can ONLY create transactions for themselves (user_id = auth.uid())
    - Users cannot create transactions for other users
    - Maintains data integrity and security
*/

CREATE POLICY "Users can create own PV transactions"
  ON pv_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
