/*
  # Optimize RLS Policies for Better Performance
  
  1. Changes
    - Update all RLS policies to use (select auth.uid()) and (select auth.jwt()) 
      instead of direct auth.uid() and auth.jwt() calls
    - This prevents re-evaluation of auth functions for each row
    
  2. Tables affected
    - products
    - product_prices
    - payment_transactions
    - groups
    - group_memberships
    - meetings
    - meeting_participants
    - meeting_attendance
    - promotion_requests
    - group_members
    - messages
    - life_changer_codes
    - inventory_logs
    - admin_settings
    - account_approval_notifications
    - product_promotions
    
  3. Performance
    - Significant query performance improvement at scale
    - Auth functions are evaluated once per query instead of per row
*/

-- Products table policies
DROP POLICY IF EXISTS "Admins and stockists can view all products" ON public.products;
CREATE POLICY "Admins and stockists can view all products" ON public.products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master', 'stockist')
    )
  );

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

-- Product prices table policies
DROP POLICY IF EXISTS "Admins can insert product prices" ON public.product_prices;
CREATE POLICY "Admins can insert product prices" ON public.product_prices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can update product prices" ON public.product_prices;
CREATE POLICY "Admins can update product prices" ON public.product_prices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

-- Payment transactions table policies
DROP POLICY IF EXISTS "System can create payment transactions" ON public.payment_transactions;
CREATE POLICY "System can create payment transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_transactions;
CREATE POLICY "Users can view own payments" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Groups table policies
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
CREATE POLICY "Group admins can update groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = groups.id 
      AND group_members.user_id = (select auth.uid()) 
      AND group_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = groups.id 
      AND group_members.user_id = (select auth.uid()) 
      AND group_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
CREATE POLICY "Users can view groups they are members of" ON public.groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = groups.id 
      AND group_members.user_id = (select auth.uid())
    )
  );

-- Group memberships table policies
DROP POLICY IF EXISTS "Users can join groups" ON public.group_memberships;
CREATE POLICY "Users can join groups" ON public.group_memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view group members" ON public.group_memberships;
CREATE POLICY "Users can view group members" ON public.group_memberships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm 
      WHERE gm.group_id = group_memberships.group_id 
      AND gm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own memberships" ON public.group_memberships;
CREATE POLICY "Users can view own memberships" ON public.group_memberships
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Meetings table policies
DROP POLICY IF EXISTS "Admins can delete meetings" ON public.meetings;
CREATE POLICY "Admins can delete meetings" ON public.meetings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Hosts can create meetings" ON public.meetings;
CREATE POLICY "Hosts can create meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (host_id = (select auth.uid()));

DROP POLICY IF EXISTS "Hosts can update own meetings" ON public.meetings;
CREATE POLICY "Hosts can update own meetings" ON public.meetings
  FOR UPDATE TO authenticated
  USING (host_id = (select auth.uid()))
  WITH CHECK (host_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view eligible meetings" ON public.meetings;
CREATE POLICY "Users can view eligible meetings" ON public.meetings
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR host_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

-- Meeting participants table policies
DROP POLICY IF EXISTS "Admins can remove participants" ON public.meeting_participants;
CREATE POLICY "Admins can remove participants" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all participants" ON public.meeting_participants;
CREATE POLICY "Admins can view all participants" ON public.meeting_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Users can join meetings" ON public.meeting_participants;
CREATE POLICY "Users can join meetings" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Users can view meeting participants" ON public.meeting_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meeting_participants mp 
      WHERE mp.meeting_id = meeting_participants.meeting_id 
      AND mp.user_id = (select auth.uid())
    )
  );

-- Meeting attendance table policies
DROP POLICY IF EXISTS "Admins can update attendance records" ON public.meeting_attendance;
CREATE POLICY "Admins can update attendance records" ON public.meeting_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can view all attendance records" ON public.meeting_attendance;
CREATE POLICY "Admins can view all attendance records" ON public.meeting_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "System can record attendance" ON public.meeting_attendance;
CREATE POLICY "System can record attendance" ON public.meeting_attendance
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own attendance" ON public.meeting_attendance;
CREATE POLICY "Users can view own attendance" ON public.meeting_attendance
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Promotion requests table policies
DROP POLICY IF EXISTS "Eligible users can review promotions" ON public.promotion_requests;
CREATE POLICY "Eligible users can review promotions" ON public.promotion_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Users can create promotion requests" ON public.promotion_requests;
CREATE POLICY "Users can create promotion requests" ON public.promotion_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own promotion requests" ON public.promotion_requests;
CREATE POLICY "Users can view own promotion requests" ON public.promotion_requests
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Group members table policies
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
CREATE POLICY "Group admins can add members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = (select auth.uid()) 
      AND gm.role = 'admin'
    )
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;
CREATE POLICY "Group admins can remove members" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = (select auth.uid()) 
      AND gm.role = 'admin'
    )
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Group admins can update member roles" ON public.group_members;
CREATE POLICY "Group admins can update member roles" ON public.group_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = (select auth.uid()) 
      AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = (select auth.uid()) 
      AND gm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON public.group_members;
CREATE POLICY "Users can view members of groups they belong to" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = (select auth.uid())
    )
  );

-- Messages table policies
DROP POLICY IF EXISTS "Group members can send messages" ON public.messages;
CREATE POLICY "Group members can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = messages.group_id 
      AND group_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Group members can view messages in their groups" ON public.messages;
CREATE POLICY "Group members can view messages in their groups" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = messages.group_id 
      AND group_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Life changer codes table policies
DROP POLICY IF EXISTS "Admins can insert codes" ON public.life_changer_codes;
CREATE POLICY "Admins can insert codes" ON public.life_changer_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can update codes" ON public.life_changer_codes;
CREATE POLICY "Admins can update codes" ON public.life_changer_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

-- Inventory logs table policies
DROP POLICY IF EXISTS "Admins can view inventory logs in their region" ON public.inventory_logs;
CREATE POLICY "Admins can view inventory logs in their region" ON public.inventory_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master', 'manager')
    )
  );

-- Admin settings table policies
DROP POLICY IF EXISTS "Admins can manage all settings" ON public.admin_settings;
CREATE POLICY "Admins can manage all settings" ON public.admin_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

-- Account approval notifications table policies
DROP POLICY IF EXISTS "Admins can insert approval notifications" ON public.account_approval_notifications;
CREATE POLICY "Admins can insert approval notifications" ON public.account_approval_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Users can view own approval notifications" ON public.account_approval_notifications;
CREATE POLICY "Users can view own approval notifications" ON public.account_approval_notifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Product promotions table policies
DROP POLICY IF EXISTS "Admins can delete product promotions" ON public.product_promotions;
CREATE POLICY "Admins can delete product promotions" ON public.product_promotions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can insert product promotions" ON public.product_promotions;
CREATE POLICY "Admins can insert product promotions" ON public.product_promotions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can update product promotions" ON public.product_promotions;
CREATE POLICY "Admins can update product promotions" ON public.product_promotions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins can view all promotions including inactive" ON public.product_promotions;
CREATE POLICY "Admins can view all promotions including inactive" ON public.product_promotions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'master')
    )
  );