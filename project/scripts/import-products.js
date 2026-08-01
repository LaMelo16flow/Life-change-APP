import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function importProducts() {
  try {
    const file = readFileSync('lifechangers_canada_longrich_final_goldheader_4.xlsx');
    const workbook = XLSX.read(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Found', jsonData.length, 'rows in Excel file');
    console.log('Sample row:', jsonData[0]);

    const productsToImport = jsonData.map((row) => ({
      name: row['Product Name'] || row['name'] || row['Name'] || row['PRODUCT NAME'] || '',
      product_type: row['Type'] || row['type'] || row['Product Type'] || row['CATEGORY'] || 'General',
      pv_value: parseFloat(row['PV'] || row['pv'] || row['PV Value'] || row['pv_value'] || row['PV VALUE'] || 0),
      description: row['Description'] || row['description'] || row['DESCRIPTION'] || '',
      is_active: true,
    })).filter(p => p.name && p.pv_value > 0);

    console.log('Products to import:', productsToImport.length);

    if (productsToImport.length === 0) {
      console.error('No valid products found. Available columns:', Object.keys(jsonData[0] || {}));
      return;
    }

    const { data, error } = await supabase.from('products').insert(productsToImport);

    if (error) {
      console.error('Failed to import products:', error);
      return;
    }

    console.log(`Successfully imported ${productsToImport.length} products`);
  } catch (error) {
    console.error('Error:', error);
  }
}

importProducts();
