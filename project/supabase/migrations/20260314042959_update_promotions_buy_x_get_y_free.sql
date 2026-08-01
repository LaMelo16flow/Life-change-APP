/*
  # Update Product Promotions to Buy-X-Get-Y-Free Model

  1. Changes to `product_promotions` table
    - Add `buy_quantity` (integer) - the quantity a customer must buy
    - Add `free_quantity` (integer) - the quantity they get for free
    - Remove old `discount_type` and `discount_value` columns

  2. Notes
    - Example: Buy 3 get 1 free means buy_quantity=3, free_quantity=1
    - Promotions can be global (country_code NULL) or country-specific
    - Existing RLS policies are kept as-is
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_promotions' AND column_name = 'buy_quantity'
  ) THEN
    ALTER TABLE product_promotions ADD COLUMN buy_quantity integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_promotions' AND column_name = 'free_quantity'
  ) THEN
    ALTER TABLE product_promotions ADD COLUMN free_quantity integer NOT NULL DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_promotions' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE product_promotions DROP COLUMN discount_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_promotions' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE product_promotions DROP COLUMN discount_value;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_promotions' AND constraint_name = 'buy_quantity_positive'
  ) THEN
    ALTER TABLE product_promotions ADD CONSTRAINT buy_quantity_positive CHECK (buy_quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_promotions' AND constraint_name = 'free_quantity_non_negative'
  ) THEN
    ALTER TABLE product_promotions ADD CONSTRAINT free_quantity_non_negative CHECK (free_quantity >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_promotions_active
  ON product_promotions (product_id, is_active, starts_at, ends_at);
