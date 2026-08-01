/*
  # Fix all foreign key constraints blocking account deletion

  ## Problem
  Multiple tables have NO ACTION foreign key constraints referencing both
  `profiles(id)` and `auth.users(id)`. When deleting a user account via
  `auth.admin.deleteUser()`, these constraints cause the operation to fail
  if the user has any related records (orders, notifications, logs, etc.).

  ## Solution
  Update all blocking FK constraints to use SET NULL so that:
  - Audit trail records are preserved (orders, logs, etc.)
  - The user reference is simply nullified rather than blocking deletion
  - Only the profile cascade from auth.users remains as CASCADE

  ## Tables affected
  1. `orders.user_id` -> profiles(id): NO ACTION -> SET NULL (make nullable)
  2. `orders.approved_by` -> auth.users(id): NO ACTION -> SET NULL
  3. `account_approval_notifications.user_id` -> auth.users(id): NO ACTION -> CASCADE
  4. `account_approval_notifications.admin_id` -> auth.users(id): NO ACTION -> SET NULL
  5. `admin_settings.updated_by` -> auth.users(id): NO ACTION -> SET NULL
  6. `groups.created_by` -> auth.users(id): NO ACTION -> SET NULL
  7. `inventory_logs.performed_by` -> auth.users(id): NO ACTION -> SET NULL
  8. `life_changer_codes.created_by` -> auth.users(id): NO ACTION -> SET NULL
  9. `meetings.host_id` -> auth.users(id): NO ACTION -> SET NULL
  10. `product_inventory.managed_by` -> auth.users(id): NO ACTION -> SET NULL
  11. `product_promotions.created_by` -> auth.users(id): NO ACTION -> SET NULL
  12. `profiles.approved_by` -> auth.users(id): NO ACTION -> SET NULL
  13. `profiles.referred_by` -> auth.users(id): NO ACTION -> SET NULL
  14. `promotion_requests.reviewed_by` -> auth.users(id): NO ACTION -> SET NULL
  15. `pv_transactions.created_by` -> auth.users(id): NO ACTION -> SET NULL
  16. `system_config.updated_by` -> auth.users(id): NO ACTION -> SET NULL

  ## Security
  - No RLS changes
  - Data integrity preserved: records are kept, user references are nullified
*/

-- 1. Fix orders.user_id -> profiles(id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_profile_fkey') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_user_id_profile_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE orders ADD CONSTRAINT orders_user_id_profile_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Fix orders.approved_by -> auth.users(id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_approved_by_fkey') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_approved_by_fkey;
    ALTER TABLE orders ADD CONSTRAINT orders_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Fix account_approval_notifications.user_id -> CASCADE (delete notifications when user is deleted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_approval_notifications_user_id_fkey') THEN
    ALTER TABLE account_approval_notifications DROP CONSTRAINT account_approval_notifications_user_id_fkey;
    ALTER TABLE account_approval_notifications ADD CONSTRAINT account_approval_notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Fix account_approval_notifications.admin_id -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_approval_notifications_admin_id_fkey') THEN
    ALTER TABLE account_approval_notifications DROP CONSTRAINT account_approval_notifications_admin_id_fkey;
    ALTER TABLE account_approval_notifications ALTER COLUMN admin_id DROP NOT NULL;
    ALTER TABLE account_approval_notifications ADD CONSTRAINT account_approval_notifications_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Fix admin_settings.updated_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_settings_updated_by_fkey') THEN
    ALTER TABLE admin_settings DROP CONSTRAINT admin_settings_updated_by_fkey;
    ALTER TABLE admin_settings ADD CONSTRAINT admin_settings_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Fix groups.created_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_created_by_fkey') THEN
    ALTER TABLE groups DROP CONSTRAINT groups_created_by_fkey;
    ALTER TABLE groups ADD CONSTRAINT groups_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Fix inventory_logs.performed_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_logs_performed_by_fkey') THEN
    ALTER TABLE inventory_logs DROP CONSTRAINT inventory_logs_performed_by_fkey;
    ALTER TABLE inventory_logs ALTER COLUMN performed_by DROP NOT NULL;
    ALTER TABLE inventory_logs ADD CONSTRAINT inventory_logs_performed_by_fkey
      FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Fix life_changer_codes.created_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'life_changer_codes_created_by_fkey') THEN
    ALTER TABLE life_changer_codes DROP CONSTRAINT life_changer_codes_created_by_fkey;
    ALTER TABLE life_changer_codes ADD CONSTRAINT life_changer_codes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. Fix meetings.host_id -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_host_id_fkey') THEN
    ALTER TABLE meetings DROP CONSTRAINT meetings_host_id_fkey;
    ALTER TABLE meetings ADD CONSTRAINT meetings_host_id_fkey
      FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 10. Fix product_inventory.managed_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_inventory_managed_by_fkey') THEN
    ALTER TABLE product_inventory DROP CONSTRAINT product_inventory_managed_by_fkey;
    ALTER TABLE product_inventory ADD CONSTRAINT product_inventory_managed_by_fkey
      FOREIGN KEY (managed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 11. Fix product_promotions.created_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_promotions_created_by_fkey') THEN
    ALTER TABLE product_promotions DROP CONSTRAINT product_promotions_created_by_fkey;
    ALTER TABLE product_promotions ADD CONSTRAINT product_promotions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 12. Fix profiles.approved_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_approved_by_fkey') THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_approved_by_fkey;
    ALTER TABLE profiles ADD CONSTRAINT profiles_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 13. Fix profiles.referred_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referred_by_fkey') THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_referred_by_fkey;
    ALTER TABLE profiles ADD CONSTRAINT profiles_referred_by_fkey
      FOREIGN KEY (referred_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 14. Fix promotion_requests.reviewed_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_requests_reviewed_by_fkey') THEN
    ALTER TABLE promotion_requests DROP CONSTRAINT promotion_requests_reviewed_by_fkey;
    ALTER TABLE promotion_requests ADD CONSTRAINT promotion_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 15. Fix pv_transactions.created_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pv_transactions_created_by_fkey') THEN
    ALTER TABLE pv_transactions DROP CONSTRAINT pv_transactions_created_by_fkey;
    ALTER TABLE pv_transactions ADD CONSTRAINT pv_transactions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 16. Fix system_config.updated_by -> SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_config_updated_by_fkey') THEN
    ALTER TABLE system_config DROP CONSTRAINT system_config_updated_by_fkey;
    ALTER TABLE system_config ADD CONSTRAINT system_config_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
