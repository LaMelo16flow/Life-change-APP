import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Read env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function importFromExcel() {
  try {
    // Read the Excel file
    const fileData = fs.readFileSync('data/book2.xlsx');
    const workbook = XLSX.read(fileData);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${jsonData.length} rows in Excel file`);
    console.log('Columns:', Object.keys(jsonData[0] || {}));
    console.log('\nFirst few rows:');
    console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));

    // Map the Excel data to product records
    const products = jsonData
      .map(row => {
        // Try different possible column names
        const name = row['Product Name'] || row['Name'] || row['PRODUCT NAME'] || row['Product'] || row['name'];
        const pv = row['PV'] || row['pv'] || row['PV Value'] || row['Points'] || row['pv_value'];
        const type = row['Type'] || row['Category'] || row['CATEGORY'] || row['type'] || row['Product Type'];
        const description = row['Description'] || row['description'] || row['DESCRIPTION'] || '';

        return {
          name: name?.toString().trim() || '',
          pv_value: parseFloat(pv) || 0,
          product_type: type?.toString().trim() || 'General',
          description: description?.toString().trim() || '',
          is_active: true
        };
      })
      .filter(p => p.name && p.pv_value > 0);

    console.log(`\nPrepared ${products.length} valid products for import`);
    console.log('\nSample products:');
    console.log(JSON.stringify(products.slice(0, 3), null, 2));

    if (products.length === 0) {
      console.error('No valid products found in Excel file');
      return;
    }

    // Clear existing products
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('\nCleared existing products');

    // Insert new products
    const { data, error } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (error) {
      console.error('Error inserting products:', error);
      return;
    }

    console.log(`\n✓ Successfully imported ${data.length} products!`);
  } catch (error) {
    console.error('Error:', error);
  }
}

importFromExcel();
