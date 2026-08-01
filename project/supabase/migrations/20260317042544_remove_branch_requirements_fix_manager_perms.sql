/*
  # Remove branch requirements from ranking & Fix manager permission policies

  1. Changes to `ranks` table
    - Set `required_branches` to 0 for all ranks
    - Branches are no longer required for rank progression; only PV matters

  2. New RLS Policies on `manager_permissions`
    - Master/admin can INSERT new permission records
    - Master/admin can DELETE permission records
    - Master/admin can UPDATE permission records
    - These were missing, causing permission updates to fail silently

  3. Important Notes
    - The is_admin_or_master() and is_manager_with_permission() functions already exist
    - Only the missing INSERT/UPDATE/DELETE policies are added here
*/

UPDATE ranks SET required_branches = 0;

CREATE POLICY "Master and admins can insert manager permissions"
  ON manager_permissions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_master());

CREATE POLICY "Master and admins can update manager permissions"
  ON manager_permissions FOR UPDATE
  TO authenticated
  USING (is_admin_or_master())
  WITH CHECK (is_admin_or_master());

CREATE POLICY "Master and admins can delete manager permissions"
  ON manager_permissions FOR DELETE
  TO authenticated
  USING (is_admin_or_master());
