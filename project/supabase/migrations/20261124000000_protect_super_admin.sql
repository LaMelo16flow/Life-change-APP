/*
  # Protect the super admin account

  1. Problem
    - The super admin (is_master = true, wilfriednawoussi4@gmail.com) could
      be demoted from the admin "Users" tab: the Promote/Demote button was
      shown for every row, and the database accepted the change from any
      admin. Nothing at the database level stopped another admin from
      demoting, deactivating, un-mastering or deleting him.
    - Any admin could also grant is_master to themselves or anyone else.

  2. Fix (enforced in the database, so it holds even if the UI is bypassed)
    - BEFORE UPDATE trigger on profiles:
        * a master row cannot lose is_master, cannot leave role 'admin',
          cannot be set inactive and cannot leave account_status 'approved'
        * only an existing master can grant is_master to someone else
    - BEFORE DELETE trigger on profiles: a master row cannot be deleted
      (this also blocks the cascade from deleting the auth user).
    - Re-asserts that wilfriednawoussi4@gmail.com is the master admin.

  3. Escape hatch
    - Changes made from the Supabase SQL editor / service role
      (auth.uid() IS NULL) are allowed for UPDATE, so the owner can still
      fix data by hand. DELETE of a master always requires running
      `SET LOCAL app.allow_master_delete = 'on';` in the same transaction.
*/

CREATE OR REPLACE FUNCTION protect_master_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_master boolean;
BEGIN
  -- Direct database access (SQL editor, service role): allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.is_master = true AND (
       NEW.is_master IS DISTINCT FROM true
    OR NEW.role IS DISTINCT FROM 'admin'
    OR NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.is_active = false
    OR NEW.account_status IS DISTINCT FROM OLD.account_status AND NEW.account_status IS DISTINCT FROM 'approved'
  ) THEN
    RAISE EXCEPTION 'The super admin account is protected and cannot be demoted, deactivated or removed'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(OLD.is_master, false) = false AND NEW.is_master = true THEN
    SELECT COALESCE(p.is_master, false) INTO caller_is_master
    FROM profiles p WHERE p.id = auth.uid();
    IF NOT COALESCE(caller_is_master, false) THEN
      RAISE EXCEPTION 'Only the super admin can grant super admin rights'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_master_profile_update ON profiles;
CREATE TRIGGER a_protect_master_profile_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_master_profile_update();

CREATE OR REPLACE FUNCTION protect_master_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_master = true
     AND COALESCE(current_setting('app.allow_master_delete', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The super admin account is protected and cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_master_profile_delete ON profiles;
CREATE TRIGGER a_protect_master_profile_delete
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_master_profile_delete();

-- Make sure the intended account is the master admin (runs as owner, so
-- auth.uid() is NULL and the trigger above lets it through).
UPDATE profiles
SET is_master = true,
    role = 'admin',
    account_status = 'approved',
    is_active = true
WHERE lower(email) = 'wilfriednawoussi4@gmail.com';
