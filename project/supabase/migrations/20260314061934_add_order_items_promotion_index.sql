/*
  # Add Index for Order Items Promotion Foreign Key
  
  1. Changes
    - Add index on order_items.promotion_id to improve query performance
    - This covers the foreign key relationship to product_promotions table
    
  2. Performance
    - Improves JOIN performance between order_items and product_promotions
    - Prevents full table scans when querying by promotion_id
*/

CREATE INDEX IF NOT EXISTS idx_order_items_promotion_id ON public.order_items(promotion_id);