/*
  # Add Admin Product Management Policies

  1. Overview
    - Allows admins to insert, update products and product prices
    - Admins can manage all product data including images, PV values, and prices

  2. New Policies
    - `products` table:
      - Admins can insert new products
      - Admins can update all products (including inactive ones)
    - `product_prices` table:
      - Admins can insert new product prices
      - Admins can update product prices

  3. Security
    - All policies check that the user is an admin via profiles.role = 'admin'
    - Non-admins can only view products (existing SELECT policies)
*/

-- Allow admins to view all products (including inactive ones)
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to insert products
CREATE POLICY "Admins can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update products
CREATE POLICY "Admins can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to insert product prices
CREATE POLICY "Admins can insert product prices"
  ON product_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update product prices
CREATE POLICY "Admins can update product prices"
  ON product_prices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
