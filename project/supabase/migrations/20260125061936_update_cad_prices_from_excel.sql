/*
  # Update CAD Prices from Excel Data

  1. Changes
    - Updates all product prices in CAD currency (country_code = 'CA') with actual values from the Excel file
    - Maps 27 products to their correct CAD pricing
    
  2. Products Updated
    - Beauty/Personal Care products (CAD $5 - $25)
    - Feminine hygiene products (CAD $130)
    - Supplements (CAD $25 - $180)
    - Kitchen items (CAD $110 - $450)
*/

UPDATE product_prices SET price = 15 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Savon au Charbon de Bambou' LIMIT 1);
UPDATE product_prices SET price = 10 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Savon au Thé Blanc' LIMIT 1);
UPDATE product_prices SET price = 15 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Gel Douche' LIMIT 1);
UPDATE product_prices SET price = 25 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Gel Olive' LIMIT 1);
UPDATE product_prices SET price = 15 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Gel de Serpent' LIMIT 1);
UPDATE product_prices SET price = 15 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Lait SOD' LIMIT 1);
UPDATE product_prices SET price = 15 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Lotion Rajeunissante' LIMIT 1);
UPDATE product_prices SET price = 25 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Acide Hyaluronique' LIMIT 1);
UPDATE product_prices SET price = 10 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Crème de Mains' LIMIT 1);
UPDATE product_prices SET price = 10 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Antisudorifique' LIMIT 1);
UPDATE product_prices SET price = 10 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Pâte Dentifrice au Thé Blanc 200g' LIMIT 1);
UPDATE product_prices SET price = 5 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Pâte Dentifrice au Thé Blanc 100g' LIMIT 1);
UPDATE product_prices SET price = 10 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Spray de Bouche' LIMIT 1);
UPDATE product_prices SET price = 130 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Protèges Slips' LIMIT 1);
UPDATE product_prices SET price = 130 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Serviettes Hygiéniques' LIMIT 1);
UPDATE product_prices SET price = 180 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Cordyceps Militaris' LIMIT 1);
UPDATE product_prices SET price = 45 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Vitamine C' LIMIT 1);
UPDATE product_prices SET price = 60 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Arthro' LIMIT 1);
UPDATE product_prices SET price = 25 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Thé' LIMIT 1);
UPDATE product_prices SET price = 25 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Café Cordyceps' LIMIT 1);
UPDATE product_prices SET price = 80 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Berry Oil' LIMIT 1);
UPDATE product_prices SET price = 70 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Menquian' LIMIT 1);
UPDATE product_prices SET price = 45 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Calcium' LIMIT 1);
UPDATE product_prices SET price = 70 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Libao' LIMIT 1);
UPDATE product_prices SET price = 55 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Vin de Santé' LIMIT 1);
UPDATE product_prices SET price = 110 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Gobelet Alcalin' LIMIT 1);
UPDATE product_prices SET price = 450 WHERE country_code = 'CA' AND product_id = (SELECT id FROM products WHERE name = 'Marmite' LIMIT 1);
