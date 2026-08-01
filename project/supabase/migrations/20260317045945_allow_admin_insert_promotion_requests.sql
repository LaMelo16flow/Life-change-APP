/*
  # Allow admins to create promotion requests on behalf of users

  1. New Policy on `promotion_requests`
    - Admins and master can insert promotion requests for any user
    - Needed for auto-creating rank promotion requests when admin verifies payments or adjusts PV

  2. Important Notes
    - Uses existing is_admin_or_master() helper function
    - Managers with manage_promotions permission can also insert on behalf of users
*/

CREATE POLICY "Admins can create promotion requests for users"
  ON promotion_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_master()
    OR is_manager_with_permission('manage_promotions')
  );
