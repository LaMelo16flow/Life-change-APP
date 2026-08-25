/*
  # Fix manager_permissions visibility for admins + add inventory alert recipients lookup

  1. Problem
    - manager_permissions only has a SELECT policy of `user_id = auth.uid()`
      (from 20260314040813_add_manager_role_permissions_and_fix_rls.sql).
      Admins/master have INSERT/UPDATE/DELETE on this table but never got a
      SELECT-all policy, so ManagerManagement.tsx - which lists and edits
      every manager's permissions - has been silently seeing only the
      logged-in admin's own row (if any) for every "other manager"
      permission query, via RLS filtering rather than an error.
    - Separately, a low-stock email alert needs to look up which admins/
      managers should be notified when a product drops below its
      threshold, and that check can be triggered by a plain customer's
      checkout (Cart/Shop) - a customer has no business reading
      manager_permissions or full profile rows directly, so this can't
      just reuse the fix above.

  2. Fix
    - Add "Master and admins can view all manager permissions" SELECT
      policy, matching the existing insert/update/delete admin policies.
    - Add get_inventory_alert_recipients(), a SECURITY DEFINER function
      returning the (id, email) of every admin/master plus every manager
      holding the manage_inventory permission - callable by any
      authenticated user so the low-stock check works uniformly whether
      it's triggered by an admin action or a customer purchase, without
      granting broad table visibility to customers.
*/

CREATE POLICY "Master and admins can view all manager permissions"
  ON manager_permissions FOR SELECT
  TO authenticated
  USING (is_admin_or_master());

CREATE OR REPLACE FUNCTION get_inventory_alert_recipients()
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM profiles p
  WHERE p.role = 'admin' OR p.is_master = true

  UNION

  SELECT p.id, p.email
  FROM profiles p
  JOIN manager_permissions mp ON mp.user_id = p.id
  WHERE mp.permission = 'manage_inventory';
$$;

GRANT EXECUTE ON FUNCTION get_inventory_alert_recipients() TO authenticated;
