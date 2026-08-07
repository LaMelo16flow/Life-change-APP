/*
  # Seed Products, Prices, Images, and Inventory

  27 products with CAD prices, Pexels images, and default inventory (100 units).
*/

DO $$
DECLARE
  p uuid;
BEGIN
  -- Products with images, prices, and inventory in one pass
  -- Each block: INSERT product -> INSERT price -> INSERT inventory

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Savon au Charbon de Bambou', 'Physical', 6, 'Soap made with bamboo charcoal', '/bamboo_soap.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 15) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Savon au Thé Blanc', 'Physical', 2.8, 'White tea soap', '/tea_white.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 10) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Gel Douche', 'Physical', 6, 'Body wash gel', '/tea_green.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 15) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Gel Olive', 'Physical', 8, 'Olive-based shower gel', '/tea_pink.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 25) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Gel de Serpent', 'Physical', 3, 'Herbal gel', '/tea_brown.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 15) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Lait SOD', 'Physical', 4, 'Skin care milk', '/sod_milk_body_cream.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 15) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Lotion Rajeunissante', 'Physical', 3.8, 'Rejuvenating lotion', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 15) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Acide Hyaluronique', 'Supplement', 5, 'Hyaluronic acid supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 25) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Crème de Mains', 'Physical', 3.5, 'Hand cream', '/hand_cream.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 10) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Antisudorifique', 'Physical', 3.5, 'Anti-perspirant product', '/deodorant_rollon.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 10) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Pâte Dentifrice au Thé Blanc 200g', 'Physical', 3.5, 'White tea toothpaste (200g)', '/tea_white.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 10) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Pâte Dentifrice au Thé Blanc 100g', 'Physical', 1.2, 'White tea toothpaste (100g)', '/tea_white.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 5) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Spray de Bouche', 'Physical', 3, 'Oral spray', '/tea_green.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 10) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Protèges Slips', 'Physical', 50, 'Sanitary liners', '/panty_liner.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 130) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Serviettes Hygiéniques', 'Physical', 50, 'Sanitary pads', '/sanitary_napkin_night.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 130) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Cordyceps Militaris', 'Supplement', 70, 'Cordyceps mushroom supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 180) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Vitamine C', 'Supplement', 8, 'Vitamin C supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 45) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Arthro', 'Supplement', 20, 'Joint health supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 60) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Thé', 'Beverage', 5, 'Herbal tea', '/tea_green.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 25) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Café Cordyceps', 'Beverage', 3, 'Coffee with cordyceps', '/tea_brown.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 25) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Berry Oil', 'Supplement', 30, 'Berry-based oil', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 80) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Menquian', 'Supplement', 20, 'Herbal supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 70) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Calcium', 'Supplement', 11, 'Calcium supplement', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 45) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Libao', 'Supplement', 20, 'Herbal health product', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 70) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Vin de Santé', 'Beverage', 9, 'Health wine', '/tea_pink.jpg', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 55) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Gobelet Alcalin', 'Accessory', 45, 'Alkaline cup', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 110) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;

  INSERT INTO products (name, product_type, pv_value, description, image_url, is_active)
  VALUES ('Marmite', 'Accessory', 170, 'Cooking pot', '/rejuvenating_body_lotion.png', true)
  ON CONFLICT DO NOTHING RETURNING id INTO p;
  INSERT INTO product_prices (product_id, country_code, price) VALUES (p, 'CA', 450) ON CONFLICT DO NOTHING;
  INSERT INTO product_inventory (product_id, region, quantity, max_quantity) VALUES (p, 'CA', 100, 100) ON CONFLICT DO NOTHING;
END $$;
