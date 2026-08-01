import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// First, let's delete the sample products I added
async function clearSampleProducts() {
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared existing products');
}

// The Excel file data from the document
const excelBase64Data = 'UEsDBBQAAAAIAAAAIQDXl0RIXwEAALACAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbKyRzU7DMBCE7yK9Q+R7qhoi1FQ9gsSBCxUXxJ+0VmI7st2Gty9JUZFQVVWHD5vVrmeHmdmv7r+vx/Y4hRKpw4LPEh5SYmUMphqaBsWFIH1MKYTLMBdYaojT0+iTMUMz5XZJzN8pMXAYmSm+R4uJoWBLAP7eJMuV5LZq7gS4y2H2h0X5Mv8MNt9Fv8FT5eOvBqF0UZrIoNGpSQ8bEE2lDCKYgM6w6Z7OhADq/8aQZg+mYZvqK8F3Wt7j2/1QBT8E0bshbCKKH6eN7qLH0Aj0b9zIj5ue5Gj7MYCKIFxJKJCrqrGRg7BqxBVnBD6RxXfwCQAA//8DAFBLAwQUAAAACAAAAAEAo9M8sJEBAADLAgAAEwAAAGRvY1Byb3BzL2FwcC54bWyMks1OwzAQhO8i3qHyPXWbCiGlUXpBQhyQUC9cUJxNY+rY1nqTtm9PnKZUpYBAtxuz/mb8b8TdyV5u+hR9wjvLLp8HKXVZJ7MpT0VqXz+mjzO+QK1t3u/uXlvU6M3sGvHvlZXvIKJ8fHiZd5vnYz7H+vjY2F3TFdpC2Z3V8xN+fzfj7+fHq9vJZDp/1h7a5vKJ9vly+fz0/HTJPx/W/Pr+erHCvXw+/vjx+/qHYxQF9L9N+zt+p0Oc5SX+JF'; 

async function importProducts() {
  try {
    await clearSampleProducts();
    
    // Try to read the file if it exists
    const fs = await import('fs');
    
    console.log('Looking for Excel file...');
    
    // Check if file exists in current directory or parent
    const possiblePaths = [
      'lifechangers_canada_longrich_final_goldheader_4.xlsx',
      '../lifechangers_canada_longrich_final_goldheader_4.xlsx',
      '../../lifechangers_canada_longrich_final_goldheader_4.xlsx'
    ];
    
    let fileData = null;
    let foundPath = null;
    
    for (const path of possiblePaths) {
      try {
        if (fs.existsSync(path)) {
          fileData = fs.readFileSync(path);
          foundPath = path;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!fileData) {
      console.error('Excel file not found. Please ensure lifechangers_canada_longrich_final_goldheader_4.xlsx is in the project directory');
      return;
    }
    
    console.log('Reading file from:', foundPath);
    
    const workbook = XLSX.read(fileData);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Found', jsonData.length, 'rows in Excel file');
    console.log('First row columns:', Object.keys(jsonData[0] || {}));
    console.log('Sample row:', jsonData[0]);

    const productsToImport = jsonData.map((row) => ({
      name: row['Product Name'] || row['name'] || row['Name'] || row['PRODUCT NAME'] || row['Product'] || '',
      product_type: row['Type'] || row['type'] || row['Product Type'] || row['CATEGORY'] || row['Category'] || 'General',
      pv_value: parseFloat(row['PV'] || row['pv'] || row['PV Value'] || row['pv_value'] || row['PV VALUE'] || row['Points'] || 0),
      description: row['Description'] || row['description'] || row['DESCRIPTION'] || '',
      is_active: true,
    })).filter(p => p.name && p.pv_value > 0);

    console.log('Products to import:', productsToImport.length);
    console.log('Sample product:', productsToImport[0]);

    if (productsToImport.length === 0) {
      console.error('No valid products found. Available columns:', Object.keys(jsonData[0] || {}));
      return;
    }

    const { data, error } = await supabase.from('products').insert(productsToImport);

    if (error) {
      console.error('Failed to import products:', error);
      return;
    }

    console.log(`Successfully imported ${productsToImport.length} products from ${foundPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

importProducts();
