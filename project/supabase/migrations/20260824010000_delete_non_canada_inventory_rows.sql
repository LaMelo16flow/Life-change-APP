/*
  # Delete stale non-Canada product_inventory rows

  1. Problem
    - 20260803140000_delete_non_canada_countries.sql removed every country
      except Canada, but product_inventory.region is a free-text column with
      no FK to countries, so it was never cascaded or cleaned up. Every
      product still has one product_inventory row per country that used to
      be supported (US, MX, GB, etc. alongside CA).
    - InventoryManagement.tsx's admin listing loads product_inventory with
      no region filter and no pagination. With thousands of stale rows
      still in the table, that query silently hits PostgREST's default
      1000-row cap - so recently-updated Canada rows can be pushed out of
      the result entirely and never show up in the admin UI at all. This
      was caught live: a product's CA inventory row had reserved_quantity
      (108) exceeding quantity (100) - a real stock-reservation corruption
      blocking order approval - and the admin had no way to see or fix it
      because the row wasn't in the (truncated) list.

  2. Fix
    - Delete every product_inventory row where region <> 'CA'. The app is
      Canada-only now (Shop.tsx/Cart.tsx/checkout all hardcode region:
      'CA'), so these rows are pure dead weight, not historical data
      anything reads.
    - inventory_logs is left alone - it's an append-only audit trail, not
      queried unfiltered anywhere, so old regions' log rows are harmless.
*/

DELETE FROM product_inventory WHERE region <> 'CA';
