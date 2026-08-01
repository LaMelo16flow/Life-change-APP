/*
  # Enable RLS on Orders Table

  1. Changes
    - Enable Row Level Security on the `orders` table
    - This activates the existing RLS policies that allow:
      - Public read access to all orders
      - Admins to view and update all orders
      - Users to view and update their own orders
  
  2. Security
    - Existing policies will now be enforced
    - Public can read all orders (via "Allow read orders" policy)
    - Authenticated users can view their own orders
    - Admins can view and manage all orders
*/

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
