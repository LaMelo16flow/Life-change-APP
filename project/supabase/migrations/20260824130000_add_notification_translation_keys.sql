/*
  # Add translation-key columns to notifications

  1. Problem
    - Notification `title`/`message` are plain text, rendered once (in
      whatever language was active for whoever triggered the event) and
      stored verbatim. A French-speaking admin approving an order writes
      French text into a notification for an English-speaking customer,
      and it never re-translates if that customer later flips the
      language toggle - unlike every other piece of UI text in the app,
      which re-renders live in the viewer's own language.

  2. Fix
    - Add nullable `title_key`, `message_key` (LanguageContext dictionary
      keys) and `message_params` (jsonb, interpolation values for the
      message template). When present, the frontend renders these via
      t(key, params) in the CURRENT VIEWER's language instead of the
      frozen `title`/`message` columns. `title`/`message` stay NOT NULL
      and keep being written as a fallback for rows that don't set a key
      (older rows, or notification types not worth converting).
*/

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_params jsonb;
