/*
  # Prevent self-privilege-escalation on profiles

  1. Problem
    - The active "Update profiles" / "Users can update own profile" RLS
      policies only check row ownership (id = auth.uid()). RLS is row-level
      only - it cannot restrict which COLUMNS a self-updating user may
      change. Since `profiles` includes `role`, `is_master`,
      `account_status`, and `total_pv`, any signed-up user could PATCH
      their own row directly via the REST API (bypassing the app UI
      entirely) to set role='admin', is_master=true,
      account_status='approved', instantly granting themselves full
      admin/master privileges across every is_admin_or_master()-gated
      policy in the schema.

  2. Fix
    - Add a BEFORE UPDATE trigger that reverts role/is_master/
      account_status/total_pv to their previous values whenever the
      caller is not an admin/master (or, for role/account_status only,
      a manager with the 'manage_users' permission - the same trust
      level the existing RLS policy already grants them for managing
      OTHER users). This closes the hole regardless of which RLS policy
      let the UPDATE through, and doesn't change any legitimate admin/
      manager workflow (AccountApprovals, UserManagement role toggle,
      PV adjustment all still work since those run as admin/manager).
*/

CREATE OR REPLACE FUNCTION protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_master IS DISTINCT FROM OLD.is_master AND NOT is_admin_or_master() THEN
    NEW.is_master := OLD.is_master;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users')) THEN
    NEW.role := OLD.role;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users') OR is_manager_with_permission('manage_accounts')) THEN
    NEW.account_status := OLD.account_status;
  END IF;

  IF NEW.total_pv IS DISTINCT FROM OLD.total_pv
     AND NOT (is_admin_or_master() OR is_manager_with_permission('manage_users')) THEN
    NEW.total_pv := OLD.total_pv;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields_trigger ON profiles;
CREATE TRIGGER protect_profile_privileged_fields_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_privileged_fields();
