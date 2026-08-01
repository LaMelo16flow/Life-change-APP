/*
  # Add Product Images

  1. Changes
    - Add `image_url` column to products table
    - Update all existing products with appropriate stock images from Pexels
    
  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add image_url column
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

-- Update products with stock images
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg' WHERE name = 'Savon au Charbon de Bambou';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465831/pexels-photo-4465831.jpeg' WHERE name = 'Savon au Thé Blanc';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465828/pexels-photo-4465828.jpeg' WHERE name = 'Gel Douche';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621447/pexels-photo-6621447.jpeg' WHERE name = 'Gel Olive';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621336/pexels-photo-6621336.jpeg' WHERE name = 'Gel de Serpent';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621335/pexels-photo-6621335.jpeg' WHERE name = 'Lait SOD';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465825/pexels-photo-4465825.jpeg' WHERE name = 'Crème au Ginseng';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621212/pexels-photo-6621212.jpeg' WHERE name = 'Crème pour le Corps';
UPDATE products SET image_url = 'https://images.pexels.com/photos/3018845/pexels-photo-3018845.jpeg' WHERE name = 'Savon Anti-Acné';
UPDATE products SET image_url = 'https://images.pexels.com/photos/7428102/pexels-photo-7428102.jpeg' WHERE name = 'Dentifrice au Charbon';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465828/pexels-photo-4465828.jpeg' WHERE name = 'Shampoing Revitalisant';
UPDATE products SET image_url = 'https://images.pexels.com/photos/3738388/pexels-photo-3738388.jpeg' WHERE name = 'Énergie Revitalisante';
UPDATE products SET image_url = 'https://images.pexels.com/photos/3683041/pexels-photo-3683041.jpeg' WHERE name = 'Huile Essentielle';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465125/pexels-photo-4465125.jpeg' WHERE name = 'Savon Nettoyant';
UPDATE products SET image_url = 'https://images.pexels.com/photos/8142019/pexels-photo-8142019.jpeg' WHERE name = 'Pi Cup Pads';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4046718/pexels-photo-4046718.jpeg' WHERE name = 'Serviettes Hygiéniques';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621218/pexels-photo-6621218.jpeg' WHERE name = 'Crème de Jour';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621220/pexels-photo-6621220.jpeg' WHERE name = 'Crème de Nuit';
UPDATE products SET image_url = 'https://images.pexels.com/photos/7428029/pexels-photo-7428029.jpeg' WHERE name = 'Dentifrice Blanchissant';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg' WHERE name = 'Brosse à Dents';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg' WHERE name = 'Baume à Lèvres';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621334/pexels-photo-6621334.jpeg' WHERE name = 'Lotion Corporelle';
UPDATE products SET image_url = 'https://images.pexels.com/photos/5069432/pexels-photo-5069432.jpeg' WHERE name = 'Masque Facial';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465120/pexels-photo-4465120.jpeg' WHERE name = 'Crème Anti-Rides';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465829/pexels-photo-4465829.jpeg' WHERE name = 'Sérum Visage';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621447/pexels-photo-6621447.jpeg' WHERE name = 'Tonique Visage';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4465831/pexels-photo-4465831.jpeg' WHERE name = 'Nettoyant Visage';
UPDATE products SET image_url = 'https://images.pexels.com/photos/6621335/pexels-photo-6621335.jpeg' WHERE name = 'Crème Hydratante';
UPDATE products SET image_url = 'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg' WHERE name = 'Brosse de Massage';
UPDATE products SET image_url = 'https://images.pexels.com/photos/7428107/pexels-photo-7428107.jpeg' WHERE name = 'Kit de Blanchiment';
