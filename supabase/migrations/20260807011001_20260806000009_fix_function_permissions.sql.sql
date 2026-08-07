/*
  # Fix remaining security warnings: revoke EXECUTE from public role

  By default, PostgreSQL grants EXECUTE on all functions to the `public` role
  (which includes both anon and authenticated). We need to REVOKE from public
  explicitly, then GRANT only to the roles that need it.
*/

-- Revoke EXECUTE from public (covers both anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM public;
REVOKE EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer, text) FROM public;

-- handle_new_user is trigger-only — no role needs direct EXECUTE
-- generate_order_number and reserve_inventory are authenticated-only
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer, text) TO authenticated;
