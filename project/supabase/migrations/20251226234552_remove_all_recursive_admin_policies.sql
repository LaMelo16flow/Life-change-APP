/*
  # Remove all admin policies that cause infinite recursion
  
  ## Problem
    - Multiple policies check profiles table to verify admin status
    - This creates infinite recursion whenever profiles is accessed
    - Prevents signup, login, and basic functionality
  
  ## Solution
    - Remove ALL admin policies that reference profiles table
    - Keep only simple user-level policies without recursion
    - Admin functionality can be handled through service role or functions
  
  ## Security
    - Users retain access to their own data
    - Public data remains accessible
    - Admin operations should use service role key or edge functions
*/

-- Remove all admin policies that check profiles table
DROP POLICY IF EXISTS "Admins can view all activity" ON activity_logs;
DROP POLICY IF EXISTS "Admins can manage branches" ON branches;
DROP POLICY IF EXISTS "Admins can manage countries" ON countries;
DROP POLICY IF EXISTS "Admins can manage memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Admins can view all attendance" ON meeting_attendance;
DROP POLICY IF EXISTS "Admins can manage participants" ON meeting_participants;
DROP POLICY IF EXISTS "Admins can manage all meetings" ON meetings;
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Admins can view all payments" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can manage product prices" ON product_prices;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotion_requests;
DROP POLICY IF EXISTS "Admins can view all PV transactions" ON pv_transactions;
DROP POLICY IF EXISTS "Admins can manage rank requirements" ON rank_requirements;
DROP POLICY IF EXISTS "Admins can manage system config" ON system_config;