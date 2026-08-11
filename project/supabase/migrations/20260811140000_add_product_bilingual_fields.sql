/*
  # Add bilingual (English) fields to products

  1. Problem
    - Product `name`/`description` are single-language columns (currently
      entered in French). The site's EN/FR language toggle only translates
      static UI chrome (LanguageContext.t()), never product content.

  2. Fix
    - Add nullable `name_en`/`description_en` columns. The existing
      `name`/`description` stay as the always-present primary fields;
      English is optional and only shown when present (frontend falls back
      to the primary field otherwise). No RLS/grant changes needed - RLS
      here is row-scoped, not column-scoped.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en text;
