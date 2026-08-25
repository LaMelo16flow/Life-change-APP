/*
  # Add English translation for product category (product_type)

  1. Problem
    - `products.product_type` is free text entered by the admin (usually in
      French) and is used as the shop's category filter. `name`/`description`
      already got optional `_en` columns (see
      20260811140000_add_product_bilingual_fields.sql) but `product_type`
      was missed, so category labels stayed in the admin's input language
      even when a shopper switched the site to English.

  2. Fix
    - Add a nullable `product_type_en` column, following the same pattern:
      optional, only shown when present, frontend falls back to
      `product_type` otherwise.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type_en text;
