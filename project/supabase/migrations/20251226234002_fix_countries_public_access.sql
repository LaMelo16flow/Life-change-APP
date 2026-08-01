/*
  # Fix public access to countries table
  
  The RLS policy needs to allow the 'anon' role specifically, which is used by unauthenticated users.
  
  1. Changes
    - Update the countries SELECT policy to use 'anon' role
    - This allows users to load countries during signup before they're authenticated
*/

DROP POLICY IF EXISTS "Anyone can view countries" ON countries;

CREATE POLICY "Anyone can view countries"
  ON countries
  FOR SELECT
  TO anon
  USING (is_active = true);