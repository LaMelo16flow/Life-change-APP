/*
  # Set Default Inventory to 100 for All Countries

  1. Changes
    - Update all product_inventory records to quantity = 100 where stock is low and unreserved
    - Ensure every active product has stock in every country
    - Default max_quantity set to 200

  2. Notes
    - Only updates unreserved inventory that was at default level (50 or less)
    - Inserts missing product/country combos with 100 stock
*/

UPDATE product_inventory
SET quantity = 100, max_quantity = 200
WHERE quantity <= 50 AND reserved_quantity = 0;

INSERT INTO product_inventory (product_id, region, quantity, max_quantity, low_stock_threshold)
SELECT p.id, c.code, 100, 200, 10
FROM products p
CROSS JOIN countries c
WHERE p.is_active = true
ON CONFLICT (product_id, region) DO NOTHING;
