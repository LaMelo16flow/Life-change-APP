/*
  # Add Comprehensive Country List
  
  ## Overview
  Adds all major countries worldwide with their currencies, symbols, and tax rates
  
  ## Countries Added
  - All continents covered
  - Major economies included
  - Currency codes follow ISO 4217
  - Payment methods assigned based on regional availability
*/

-- Insert comprehensive country list
INSERT INTO countries (code, name, currency_code, currency_symbol, tax_rate) VALUES
  -- North America
  ('US', 'United States', 'USD', '$', 0),
  ('CA', 'Canada', 'CAD', 'C$', 5),
  ('MX', 'Mexico', 'MXN', 'Mex$', 16),
  
  -- Europe
  ('GB', 'United Kingdom', 'GBP', '£', 20),
  ('DE', 'Germany', 'EUR', '€', 19),
  ('FR', 'France', 'EUR', '€', 20),
  ('IT', 'Italy', 'EUR', '€', 22),
  ('ES', 'Spain', 'EUR', '€', 21),
  ('NL', 'Netherlands', 'EUR', '€', 21),
  ('BE', 'Belgium', 'EUR', '€', 21),
  ('AT', 'Austria', 'EUR', '€', 20),
  ('PT', 'Portugal', 'EUR', '€', 23),
  ('IE', 'Ireland', 'EUR', '€', 23),
  ('PL', 'Poland', 'PLN', 'zł', 23),
  ('SE', 'Sweden', 'SEK', 'kr', 25),
  ('NO', 'Norway', 'NOK', 'kr', 25),
  ('DK', 'Denmark', 'DKK', 'kr', 25),
  ('FI', 'Finland', 'EUR', '€', 24),
  ('CH', 'Switzerland', 'CHF', 'Fr', 7.7),
  ('CZ', 'Czech Republic', 'CZK', 'Kč', 21),
  ('RO', 'Romania', 'RON', 'lei', 19),
  ('GR', 'Greece', 'EUR', '€', 24),
  
  -- Africa
  ('NG', 'Nigeria', 'NGN', '₦', 7.5),
  ('ZA', 'South Africa', 'ZAR', 'R', 15),
  ('KE', 'Kenya', 'KES', 'KSh', 16),
  ('GH', 'Ghana', 'GHS', 'GH₵', 12.5),
  ('EG', 'Egypt', 'EGP', 'E£', 14),
  ('MA', 'Morocco', 'MAD', 'DH', 20),
  ('TZ', 'Tanzania', 'TZS', 'TSh', 18),
  ('UG', 'Uganda', 'UGX', 'USh', 18),
  ('ET', 'Ethiopia', 'ETB', 'Br', 15),
  ('RW', 'Rwanda', 'RWF', 'FRw', 18),
  
  -- Asia
  ('CN', 'China', 'CNY', '¥', 13),
  ('IN', 'India', 'INR', '₹', 18),
  ('JP', 'Japan', 'JPY', '¥', 10),
  ('KR', 'South Korea', 'KRW', '₩', 10),
  ('SG', 'Singapore', 'SGD', 'S$', 7),
  ('MY', 'Malaysia', 'MYR', 'RM', 6),
  ('TH', 'Thailand', 'THB', '฿', 7),
  ('ID', 'Indonesia', 'IDR', 'Rp', 10),
  ('PH', 'Philippines', 'PHP', '₱', 12),
  ('VN', 'Vietnam', 'VND', '₫', 10),
  ('PK', 'Pakistan', 'PKR', '₨', 17),
  ('BD', 'Bangladesh', 'BDT', '৳', 15),
  ('AE', 'United Arab Emirates', 'AED', 'د.إ', 5),
  ('SA', 'Saudi Arabia', 'SAR', '﷼', 15),
  ('IL', 'Israel', 'ILS', '₪', 17),
  ('TR', 'Turkey', 'TRY', '₺', 18),
  ('HK', 'Hong Kong', 'HKD', 'HK$', 0),
  ('TW', 'Taiwan', 'TWD', 'NT$', 5),
  
  -- Oceania
  ('AU', 'Australia', 'AUD', 'A$', 10),
  ('NZ', 'New Zealand', 'NZD', 'NZ$', 15),
  
  -- South America
  ('BR', 'Brazil', 'BRL', 'R$', 17),
  ('AR', 'Argentina', 'ARS', '$', 21),
  ('CL', 'Chile', 'CLP', '$', 19),
  ('CO', 'Colombia', 'COP', '$', 19),
  ('PE', 'Peru', 'PEN', 'S/', 18),
  ('VE', 'Venezuela', 'VES', 'Bs', 16),
  ('EC', 'Ecuador', 'USD', '$', 12),
  
  -- Central America & Caribbean
  ('CR', 'Costa Rica', 'CRC', '₡', 13),
  ('PA', 'Panama', 'USD', '$', 7),
  ('JM', 'Jamaica', 'JMD', 'J$', 15),
  ('TT', 'Trinidad and Tobago', 'TTD', 'TT$', 12.5),
  ('BB', 'Barbados', 'BBD', 'Bds$', 17.5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  tax_rate = EXCLUDED.tax_rate;

-- Add payment methods for all countries
-- Stripe for developed markets
INSERT INTO payment_methods (country_code, provider, is_active) VALUES
  ('US', 'stripe', true),
  ('CA', 'stripe', true),
  ('GB', 'stripe', true),
  ('DE', 'stripe', true),
  ('FR', 'stripe', true),
  ('IT', 'stripe', true),
  ('ES', 'stripe', true),
  ('NL', 'stripe', true),
  ('BE', 'stripe', true),
  ('AT', 'stripe', true),
  ('PT', 'stripe', true),
  ('IE', 'stripe', true),
  ('SE', 'stripe', true),
  ('NO', 'stripe', true),
  ('DK', 'stripe', true),
  ('FI', 'stripe', true),
  ('CH', 'stripe', true),
  ('AU', 'stripe', true),
  ('NZ', 'stripe', true),
  ('SG', 'stripe', true),
  ('HK', 'stripe', true),
  ('JP', 'stripe', true)
ON CONFLICT DO NOTHING;

-- PayPal for most countries
INSERT INTO payment_methods (country_code, provider, is_active)
SELECT code, 'paypal', true
FROM countries
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Paystack for African countries
INSERT INTO payment_methods (country_code, provider, is_active) VALUES
  ('NG', 'paystack', true),
  ('GH', 'paystack', true),
  ('ZA', 'paystack', true),
  ('KE', 'paystack', true),
  ('EG', 'paystack', true)
ON CONFLICT DO NOTHING;

-- Flutterwave for African countries
INSERT INTO payment_methods (country_code, provider, is_active) VALUES
  ('NG', 'flutterwave', true),
  ('GH', 'flutterwave', true),
  ('ZA', 'flutterwave', true),
  ('KE', 'flutterwave', true),
  ('UG', 'flutterwave', true),
  ('TZ', 'flutterwave', true),
  ('RW', 'flutterwave', true)
ON CONFLICT DO NOTHING;