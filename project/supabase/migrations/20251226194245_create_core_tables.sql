/*
  # Community Leadership Platform - Core Database Schema
  
  ## Overview
  This migration creates the complete database structure for a scalable community platform
  with rank progression, PV system, branch hierarchy, and multi-country payments.
  
  ## 1. New Tables
  
  ### User Management
    - `profiles` - Extended user profile data (name, country, current rank, total PV)
    - `activity_logs` - Track all user activities for audit and PV validation
  
  ### Rank System (Admin Configurable)
    - `ranks` - Rank definitions (name, order, required_pv, required_branches)
    - `rank_requirements` - Branch requirements per rank (min rank per branch)
    - `promotion_requests` - Track promotion approval workflow
  
  ### Branch & Referral System
    - `branches` - Direct referral relationships with validation
  
  ### PV (Point Value) System
    - `pv_transactions` - All PV gains/losses with source tracking
  
  ### Product System
    - `products` - Product catalog with PV values
    - `product_prices` - Country-specific pricing
  
  ### Group System
    - `groups` - Community groups with requirements
    - `group_memberships` - User group participation
  
  ### Payment System
    - `countries` - Country configurations with currency and payment methods
    - `payment_methods` - Available payment gateways per country
    - `payment_transactions` - All payment records
  
  ### Meeting System
    - `meetings` - Meeting schedules and configuration
    - `meeting_participants` - Who joined each meeting
    - `meeting_attendance` - Detailed attendance tracking for PV
  
  ### Notification System
    - `notifications` - User notifications and alerts
  
  ### System Configuration
    - `system_config` - Global admin-editable settings
  
  ## 2. Security
    - RLS enabled on all tables
    - Policies for authenticated users to access their own data
    - Admin-only policies for configuration tables
    - Restrictive policies for financial and promotion data
  
  ## 3. Important Notes
    - All timestamps use timestamptz for timezone support
    - UUIDs used for all primary keys
    - Foreign key constraints ensure data integrity
    - Circular branch detection handled via application logic
    - Real-time subscriptions enabled for live updates
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (Extended User Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  country_code text NOT NULL,
  current_rank_id uuid,
  total_pv numeric DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  referred_by uuid REFERENCES auth.users(id),
  role text DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 2. RANKS TABLE (Admin Configurable)
-- =====================================================
CREATE TABLE IF NOT EXISTS ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_order integer UNIQUE NOT NULL,
  required_pv numeric DEFAULT 0 NOT NULL,
  required_branches integer DEFAULT 0 NOT NULL,
  requires_approval boolean DEFAULT false NOT NULL,
  approved_by_min_rank_id uuid,
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'star',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 3. RANK REQUIREMENTS TABLE (Branch Requirements)
-- =====================================================
CREATE TABLE IF NOT EXISTS rank_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_id uuid REFERENCES ranks(id) ON DELETE CASCADE NOT NULL,
  branch_position integer NOT NULL,
  min_branch_rank_id uuid REFERENCES ranks(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(rank_id, branch_position)
);

-- =====================================================
-- 4. BRANCHES TABLE (Referral Relationships)
-- =====================================================
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  child_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(parent_id, child_id),
  CHECK (parent_id != child_id)
);

-- =====================================================
-- 5. PV TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pv_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'meeting', 'reward', 'adjustment', 'bonus')),
  reference_id uuid,
  reference_type text CHECK (reference_type IN ('product', 'meeting', 'payment', 'admin')),
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 6. COUNTRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  currency_code text NOT NULL,
  currency_symbol text NOT NULL,
  tax_rate numeric DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 7. PAYMENT METHODS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text REFERENCES countries(code) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'paystack', 'flutterwave')),
  is_active boolean DEFAULT true NOT NULL,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 8. PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  product_type text NOT NULL,
  pv_value numeric NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 9. PRODUCT PRICES TABLE (Country-specific)
-- =====================================================
CREATE TABLE IF NOT EXISTS product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  country_code text REFERENCES countries(code) ON DELETE CASCADE NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, country_code)
);

-- =====================================================
-- 10. PAYMENT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id),
  amount numeric NOT NULL,
  currency_code text NOT NULL,
  payment_method text NOT NULL,
  payment_provider text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  provider_transaction_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 11. GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  min_rank_id uuid REFERENCES ranks(id),
  min_pv numeric DEFAULT 0,
  auto_join boolean DEFAULT true NOT NULL,
  requires_approval boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 12. GROUP MEMBERSHIPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- =====================================================
-- 13. MEETINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60 NOT NULL,
  host_id uuid REFERENCES auth.users(id) NOT NULL,
  min_rank_id uuid REFERENCES ranks(id),
  max_participants integer DEFAULT 1000,
  meeting_link text,
  meeting_provider text CHECK (meeting_provider IN ('agora', 'daily', 'zoom', 'custom')),
  pv_reward numeric DEFAULT 0,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  enable_recording boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 14. MEETING PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'participant' CHECK (role IN ('host', 'co-host', 'participant')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(meeting_id, user_id)
);

-- =====================================================
-- 15. MEETING ATTENDANCE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz NOT NULL,
  left_at timestamptz,
  duration_minutes integer,
  participation_score numeric DEFAULT 0,
  pv_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 16. PROMOTION REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_rank_id uuid REFERENCES ranks(id),
  to_rank_id uuid REFERENCES ranks(id) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz DEFAULT now() NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb DEFAULT '{}'
);

-- =====================================================
-- 17. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('meeting', 'promotion', 'approval', 'payment', 'group', 'system')),
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 18. ACTIVITY LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 19. SYSTEM CONFIG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- ADD FOREIGN KEY TO PROFILES
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_current_rank_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_current_rank_id_fkey 
    FOREIGN KEY (current_rank_id) REFERENCES ranks(id);
  END IF;
END $$;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_profiles_rank ON profiles(current_rank_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_branches_parent ON branches(parent_id);
CREATE INDEX IF NOT EXISTS idx_branches_child ON branches(child_id);
CREATE INDEX IF NOT EXISTS idx_pv_transactions_user ON pv_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pv_transactions_created ON pv_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_promotion_requests_user ON promotion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pv_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view other profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - RANKS (READ: ALL, WRITE: ADMIN)
-- =====================================================
CREATE POLICY "Anyone can view ranks"
  ON ranks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage ranks"
  ON ranks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - RANK REQUIREMENTS
-- =====================================================
CREATE POLICY "Anyone can view rank requirements"
  ON rank_requirements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rank requirements"
  ON rank_requirements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - BRANCHES
-- =====================================================
CREATE POLICY "Users can view own branches"
  ON branches FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid() OR child_id = auth.uid());

CREATE POLICY "Users can view all branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Admins can manage branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - PV TRANSACTIONS
-- =====================================================
CREATE POLICY "Users can view own PV transactions"
  ON pv_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all PV transactions"
  ON pv_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create PV transactions"
  ON pv_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - COUNTRIES & PAYMENT METHODS
-- =====================================================
CREATE POLICY "Anyone can view countries"
  ON countries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can view payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payment methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - PRODUCTS
-- =====================================================
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - PRODUCT PRICES
-- =====================================================
CREATE POLICY "Anyone can view product prices"
  ON product_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage product prices"
  ON product_prices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - PAYMENT TRANSACTIONS
-- =====================================================
CREATE POLICY "Users can view own payments"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create payment transactions"
  ON payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - GROUPS
-- =====================================================
CREATE POLICY "Anyone can view active groups"
  ON groups FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage groups"
  ON groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - GROUP MEMBERSHIPS
-- =====================================================
CREATE POLICY "Users can view own memberships"
  ON group_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view group members"
  ON group_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm 
      WHERE gm.group_id = group_memberships.group_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join groups"
  ON group_memberships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON group_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - MEETINGS
-- =====================================================
CREATE POLICY "Users can view eligible meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    min_rank_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ranks r1 ON p.current_rank_id = r1.id
      JOIN ranks r2 ON meetings.min_rank_id = r2.id
      WHERE p.id = auth.uid() AND r1.display_order >= r2.display_order
    )
  );

CREATE POLICY "Hosts can create meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update own meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Admins can manage all meetings"
  ON meetings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - MEETING PARTICIPANTS
-- =====================================================
CREATE POLICY "Users can view meeting participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM meeting_participants mp
      WHERE mp.meeting_id = meeting_participants.meeting_id
      AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join meetings"
  ON meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage participants"
  ON meeting_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - MEETING ATTENDANCE
-- =====================================================
CREATE POLICY "Users can view own attendance"
  ON meeting_attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all attendance"
  ON meeting_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can record attendance"
  ON meeting_attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - PROMOTION REQUESTS
-- =====================================================
CREATE POLICY "Users can view own promotion requests"
  ON promotion_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create promotion requests"
  ON promotion_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Eligible users can review promotions"
  ON promotion_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ranks r1 ON p.current_rank_id = r1.id
      JOIN promotion_requests pr ON pr.id = promotion_requests.id
      JOIN ranks r2 ON pr.to_rank_id = r2.id
      JOIN ranks r3 ON r2.approved_by_min_rank_id = r3.id
      WHERE p.id = auth.uid() AND r1.display_order >= r3.display_order
    )
  )
  WITH CHECK (reviewed_by = auth.uid());

CREATE POLICY "Admins can manage promotions"
  ON promotion_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - NOTIFICATIONS
-- =====================================================
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES - ACTIVITY LOGS
-- =====================================================
CREATE POLICY "Users can view own activity"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- RLS POLICIES - SYSTEM CONFIG
-- =====================================================
CREATE POLICY "Anyone can view system config"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage system config"
  ON system_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );