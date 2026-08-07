/*
  # Fix Security Advisor Warnings

  1. Add SET search_path = '' to update_timestamp() function
  2. Revoke EXECUTE from anon role on all SECURITY DEFINER functions
     (handle_new_user is trigger-only, generate_order_number and reserve_inventory
     are authenticated-only)
*/

-- Fix update_timestamp search_path
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke anon execute on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer, text) FROM anon;

-- Ensure only authenticated can call the user-facing functions
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(uuid, text, integer, text) TO authenticated;
