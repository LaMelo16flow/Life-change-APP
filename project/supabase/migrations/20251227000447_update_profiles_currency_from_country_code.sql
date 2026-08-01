/*
  # Update Currency Setting Function

  1. Changes
    - Create a function to automatically set currency based on country_code when profile is created
    - Update existing profiles to have proper currency based on their country_code

  2. Notes
    - Uses a comprehensive country-to-currency mapping
    - Eurozone countries automatically get EUR
    - Defaults to USD if country is not found
*/

CREATE OR REPLACE FUNCTION get_currency_for_country(country_code text)
RETURNS text AS $$
DECLARE
  eurozone_countries text[] := ARRAY['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 
                                      'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR'];
  currency_code text;
BEGIN
  IF country_code = ANY(eurozone_countries) THEN
    RETURN 'EUR';
  END IF;

  currency_code := CASE country_code
    WHEN 'US' THEN 'USD'
    WHEN 'GB' THEN 'GBP'
    WHEN 'JP' THEN 'JPY'
    WHEN 'CN' THEN 'CNY'
    WHEN 'IN' THEN 'INR'
    WHEN 'CA' THEN 'CAD'
    WHEN 'AU' THEN 'AUD'
    WHEN 'CH' THEN 'CHF'
    WHEN 'SE' THEN 'SEK'
    WHEN 'NO' THEN 'NOK'
    WHEN 'DK' THEN 'DKK'
    WHEN 'NZ' THEN 'NZD'
    WHEN 'SG' THEN 'SGD'
    WHEN 'HK' THEN 'HKD'
    WHEN 'KR' THEN 'KRW'
    WHEN 'MX' THEN 'MXN'
    WHEN 'BR' THEN 'BRL'
    WHEN 'ZA' THEN 'ZAR'
    WHEN 'RU' THEN 'RUB'
    WHEN 'TR' THEN 'TRY'
    WHEN 'PL' THEN 'PLN'
    WHEN 'TH' THEN 'THB'
    WHEN 'ID' THEN 'IDR'
    WHEN 'MY' THEN 'MYR'
    WHEN 'PH' THEN 'PHP'
    WHEN 'CZ' THEN 'CZK'
    WHEN 'IL' THEN 'ILS'
    WHEN 'CL' THEN 'CLP'
    WHEN 'AE' THEN 'AED'
    WHEN 'SA' THEN 'SAR'
    WHEN 'AR' THEN 'ARS'
    WHEN 'CO' THEN 'COP'
    WHEN 'EG' THEN 'EGP'
    WHEN 'NG' THEN 'NGN'
    WHEN 'KE' THEN 'KES'
    WHEN 'VN' THEN 'VND'
    WHEN 'BD' THEN 'BDT'
    WHEN 'PK' THEN 'PKR'
    WHEN 'PE' THEN 'PEN'
    ELSE 'USD'
  END;

  RETURN currency_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_profile_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.currency IS NULL OR NEW.currency = 'USD' THEN
    NEW.currency := get_currency_for_country(NEW.country_code);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_profile_currency ON profiles;
CREATE TRIGGER trigger_set_profile_currency
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_currency();

UPDATE profiles
SET currency = get_currency_for_country(country_code)
WHERE currency = 'USD' OR currency IS NULL;