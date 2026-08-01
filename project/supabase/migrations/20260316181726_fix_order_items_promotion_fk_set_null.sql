/*
  # Fix order_items promotion_id foreign key to SET NULL on delete

  1. Changes to `order_items` table
    - Drop existing FK constraint on promotion_id that prevents deleting product promotions
    - Re-create it with ON DELETE SET NULL so deleting a promotion sets the reference to null
      instead of blocking the delete

  2. Important Notes
    - This preserves existing order data (promotion_id becomes NULL instead of blocking)
    - No data loss occurs
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_promotion_id_fkey'
    AND table_name = 'order_items'
  ) THEN
    ALTER TABLE order_items DROP CONSTRAINT order_items_promotion_id_fkey;
  END IF;
END $$;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_promotion_id_fkey
  FOREIGN KEY (promotion_id) REFERENCES product_promotions(id) ON DELETE SET NULL;