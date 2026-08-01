/*
  # Add Orders-to-Profiles Foreign Key

  1. Changes
    - Add a new foreign key constraint from orders.user_id to profiles.id
    - This enables PostgREST (Supabase) to join orders with profiles directly
    - The existing FK to auth.users remains intact

  2. Notes
    - PostgREST cannot traverse cross-schema relationships (auth.users -> profiles)
    - A direct FK to profiles in the public schema is required for Supabase .select() joins
*/

ALTER TABLE orders
ADD CONSTRAINT orders_user_id_profile_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id);
