/*
  # Seed Initial Data
  
  ## Overview
  Populates the database with initial configuration data
  
  ## 1. Ranks
  Seeds the 11 ranks as specified:
  - Prospect (starting rank)
  - Networkeur Bronze, Silver, Gold
  - D1 through D7
  
  Each rank includes:
  - Display order for hierarchy
  - Required PV for eligibility
  - Required branches
  - Approval requirements
  - Visual styling (color, icon)
  
  ## 2. Rank Requirements
  Defines branch requirements for each rank
  - From Gold onwards: minimum 2 active branches
  - Each branch must meet minimum rank requirements
  
  ## 3. Countries
  Seeds initial country data with:
  - Major countries (US, UK, CA, NG, KE, GH, ZA)
  - Currency codes and symbols
  - Tax rates where applicable
  
  ## 4. Payment Methods
  Associates payment providers with countries:
  - Stripe: US, UK, CA, EU countries
  - PayPal: All countries
  - Paystack/Flutterwave: African countries
*/

-- =====================================================
-- INSERT RANKS (IN ORDER)
-- =====================================================
DO $$
DECLARE
  prospect_id uuid;
  bronze_id uuid;
  silver_id uuid;
  gold_id uuid;
  d1_id uuid;
  d2_id uuid;
  d3_id uuid;
  d4_id uuid;
  d5_id uuid;
  d6_id uuid;
  d7_id uuid;
BEGIN
  -- Insert Prospect
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, color, icon)
  VALUES ('Prospect', 1, 0, 0, false, '#9CA3AF', 'user')
  ON CONFLICT (name) DO UPDATE SET display_order = 1
  RETURNING id INTO prospect_id;

  -- Insert Networkeur Bronze
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, color, icon)
  VALUES ('Networkeur Bronze', 2, 100, 0, false, '#CD7F32', 'award')
  ON CONFLICT (name) DO UPDATE SET display_order = 2
  RETURNING id INTO bronze_id;

  -- Insert Networkeur Silver
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('Networkeur Silver', 3, 300, 1, true, NULL, '#C0C0C0', 'medal')
  ON CONFLICT (name) DO UPDATE SET display_order = 3
  RETURNING id INTO silver_id;

  -- Insert Networkeur Gold
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('Networkeur Gold', 4, 500, 2, true, NULL, '#FFD700', 'crown')
  ON CONFLICT (name) DO UPDATE SET display_order = 4
  RETURNING id INTO gold_id;

  -- Insert D1
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D1', 5, 1000, 2, true, NULL, '#3B82F6', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 5
  RETURNING id INTO d1_id;

  -- Insert D2
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D2', 6, 2000, 2, true, NULL, '#8B5CF6', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 6
  RETURNING id INTO d2_id;

  -- Insert D3
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D3', 7, 4000, 2, true, NULL, '#EC4899', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 7
  RETURNING id INTO d3_id;

  -- Insert D4
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D4', 8, 8000, 2, true, NULL, '#F59E0B', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 8
  RETURNING id INTO d4_id;

  -- Insert D5
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D5', 9, 16000, 2, true, NULL, '#EF4444', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 9
  RETURNING id INTO d5_id;

  -- Insert D6
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D6', 10, 32000, 2, true, NULL, '#10B981', 'star')
  ON CONFLICT (name) DO UPDATE SET display_order = 10
  RETURNING id INTO d6_id;

  -- Insert D7
  INSERT INTO ranks (name, display_order, required_pv, required_branches, requires_approval, approved_by_min_rank_id, color, icon)
  VALUES ('D7', 11, 64000, 2, true, NULL, '#6366F1', 'trophy')
  ON CONFLICT (name) DO UPDATE SET display_order = 11
  RETURNING id INTO d7_id;

  -- Now update approved_by_min_rank_id for ranks that need approval
  -- Silver approved by D1+
  UPDATE ranks SET approved_by_min_rank_id = d1_id WHERE name = 'Networkeur Silver';
  -- Gold approved by D2+
  UPDATE ranks SET approved_by_min_rank_id = d2_id WHERE name = 'Networkeur Gold';
  -- D1 approved by D3+
  UPDATE ranks SET approved_by_min_rank_id = d3_id WHERE name = 'D1';
  -- D2 approved by D4+
  UPDATE ranks SET approved_by_min_rank_id = d4_id WHERE name = 'D2';
  -- D3 approved by D5+
  UPDATE ranks SET approved_by_min_rank_id = d5_id WHERE name = 'D3';
  -- D4 approved by D6+
  UPDATE ranks SET approved_by_min_rank_id = d6_id WHERE name = 'D4';
  -- D5 approved by D7
  UPDATE ranks SET approved_by_min_rank_id = d7_id WHERE name = 'D5';
  -- D6 approved by D7
  UPDATE ranks SET approved_by_min_rank_id = d7_id WHERE name = 'D6';
  -- D7 approved by admin (NULL means admin only)

  -- Insert rank requirements (branch requirements)
  -- Gold: 2 branches, each must be Bronze+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (gold_id, 1, bronze_id),
    (gold_id, 2, bronze_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D1: 2 branches, each must be Silver+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d1_id, 1, silver_id),
    (d1_id, 2, silver_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D2: 2 branches, each must be Gold+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d2_id, 1, gold_id),
    (d2_id, 2, gold_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D3: 2 branches, each must be D1+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d3_id, 1, d1_id),
    (d3_id, 2, d1_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D4: 2 branches, each must be D2+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d4_id, 1, d2_id),
    (d4_id, 2, d2_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D5: 2 branches, each must be D3+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d5_id, 1, d3_id),
    (d5_id, 2, d3_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D6: 2 branches, each must be D4+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d6_id, 1, d4_id),
    (d6_id, 2, d4_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;

  -- D7: 2 branches, each must be D5+
  INSERT INTO rank_requirements (rank_id, branch_position, min_branch_rank_id)
  VALUES 
    (d7_id, 1, d5_id),
    (d7_id, 2, d5_id)
  ON CONFLICT (rank_id, branch_position) DO NOTHING;
END $$;

-- =====================================================
-- INSERT COUNTRIES
-- =====================================================
INSERT INTO countries (code, name, currency_code, currency_symbol, tax_rate)
VALUES
  ('US', 'United States', 'USD', '$', 0),
  ('GB', 'United Kingdom', 'GBP', '£', 20),
  ('CA', 'Canada', 'CAD', 'C$', 0),
  ('NG', 'Nigeria', 'NGN', '₦', 7.5),
  ('KE', 'Kenya', 'KES', 'KSh', 16),
  ('GH', 'Ghana', 'GHS', 'GH₵', 0),
  ('ZA', 'South Africa', 'ZAR', 'R', 15),
  ('DE', 'Germany', 'EUR', '€', 19),
  ('FR', 'France', 'EUR', '€', 20),
  ('AU', 'Australia', 'AUD', 'A$', 10)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- INSERT PAYMENT METHODS
-- =====================================================
-- Stripe for US, UK, CA, EU
INSERT INTO payment_methods (country_code, provider, is_active)
VALUES
  ('US', 'stripe', true),
  ('GB', 'stripe', true),
  ('CA', 'stripe', true),
  ('DE', 'stripe', true),
  ('FR', 'stripe', true),
  ('AU', 'stripe', true)
ON CONFLICT DO NOTHING;

-- PayPal for all countries
INSERT INTO payment_methods (country_code, provider, is_active)
VALUES
  ('US', 'paypal', true),
  ('GB', 'paypal', true),
  ('CA', 'paypal', true),
  ('NG', 'paypal', true),
  ('KE', 'paypal', true),
  ('GH', 'paypal', true),
  ('ZA', 'paypal', true),
  ('DE', 'paypal', true),
  ('FR', 'paypal', true),
  ('AU', 'paypal', true)
ON CONFLICT DO NOTHING;

-- Paystack for African countries
INSERT INTO payment_methods (country_code, provider, is_active)
VALUES
  ('NG', 'paystack', true),
  ('GH', 'paystack', true),
  ('ZA', 'paystack', true),
  ('KE', 'paystack', true)
ON CONFLICT DO NOTHING;

-- Flutterwave for African countries
INSERT INTO payment_methods (country_code, provider, is_active)
VALUES
  ('NG', 'flutterwave', true),
  ('GH', 'flutterwave', true),
  ('ZA', 'flutterwave', true),
  ('KE', 'flutterwave', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INSERT SYSTEM CONFIG DEFAULTS
-- =====================================================
INSERT INTO system_config (key, value, description)
VALUES
  ('platform_name', '"Community Leadership Platform"', 'Name of the platform'),
  ('max_meeting_participants', '1000', 'Maximum participants per meeting'),
  ('meeting_pv_base_reward', '10', 'Base PV reward for meeting attendance'),
  ('promotion_auto_approve_below_rank', '2', 'Auto-approve promotions below this rank order'),
  ('circular_branch_check_enabled', 'true', 'Enable circular branch detection')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;