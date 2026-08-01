/*
  # Fix foreign key constraints for safe account deletion

  1. Changes
    - Update `orders.user_id` FK referencing `profiles` from NO ACTION to SET NULL
      so that deleting a profile doesn't fail due to existing orders
    - Update `manager_permissions.granted_by` FK referencing `profiles` from NO ACTION to SET NULL
      so that deleting an admin who granted permissions doesn't fail
    - Make `orders.user_id` nullable (for referencing profiles table)
    
  2. Reason
    - When deleting user accounts, cascading deletes from auth.users handle most tables,
      but certain NO ACTION constraints would block deletion
    - Orders should be preserved for audit trail with user_id set to NULL
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_user_profile_fkey' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_user_profile_fkey;
    ALTER TABLE orders ADD CONSTRAINT orders_user_profile_fkey 
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manager_permissions_granted_by_fkey'
  ) THEN
    ALTER TABLE manager_permissions DROP CONSTRAINT manager_permissions_granted_by_fkey;
    ALTER TABLE manager_permissions ADD CONSTRAINT manager_permissions_granted_by_fkey 
      FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
