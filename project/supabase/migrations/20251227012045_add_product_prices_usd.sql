/*
  # Add Product Prices for USD

  1. Overview
    - Populates product_prices table with USD prices for all products
    - Uses a simple conversion: price = pv_value * 10 USD
    - This allows users in USD regions to purchase products immediately

  2. Changes
    - Inserts product prices for all active products in USD currency
    - Prices are based on PV values for consistency
*/

INSERT INTO product_prices (product_id, country_code, price)
SELECT 
  p.id,
  'US' as country_code,
  p.pv_value * 10 as price
FROM products p
WHERE p.is_active = true
ON CONFLICT (product_id, country_code) DO NOTHING;
