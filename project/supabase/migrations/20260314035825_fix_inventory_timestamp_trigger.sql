/*
  # Fix Inventory Timestamp Trigger

  1. Changes
    - Remove reference to non-existent 'price' column in update_inventory_timestamp function
    - Replace with 'reserved_quantity' which is a valid column on product_inventory

  2. Notes
    - The trigger was referencing OLD.price which doesn't exist, causing errors on any inventory update
*/

CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD IS NULL THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF (OLD.quantity IS DISTINCT FROM NEW.quantity)
     OR (OLD.reserved_quantity IS DISTINCT FROM NEW.reserved_quantity)
     OR (OLD.max_quantity IS DISTINCT FROM NEW.max_quantity) THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
