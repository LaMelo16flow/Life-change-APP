import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileData = fs.readFileSync('data/book2.xlsx');
const workbook = XLSX.read(fileData);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

const products = jsonData
  .map(row => {
    const name = row['Product Name'] || row['Name'] || row['PRODUCT NAME'] || row['Product'] || row['name'];
    const pv = row['PV'] || row['pv'] || row['PV Value'] || row['Points'] || row['pv_value'];
    const type = row['Type'] || row['Category'] || row['CATEGORY'] || row['type'] || row['Product Type'];
    const description = row['Description'] || row['description'] || row['DESCRIPTION'] || '';

    return {
      name: name?.toString().trim() || '',
      pv_value: parseFloat(pv) || 0,
      product_type: type?.toString().trim() || 'General',
      description: description?.toString().trim() || ''
    };
  })
  .filter(p => p.name && p.pv_value > 0);

// Generate SQL INSERT statements
const sqlValues = products.map(p => {
  const name = p.name.replace(/'/g, "''");
  const description = p.description.replace(/'/g, "''");
  const type = p.product_type.replace(/'/g, "''");
  return `('${name}', '${type}', ${p.pv_value}, '${description}', true)`;
}).join(',\n  ');

const sqlStatement = `INSERT INTO products (name, product_type, pv_value, description, is_active) VALUES\n  ${sqlValues};`;

fs.writeFileSync('scripts/products-insert.sql', sqlStatement);
console.log(`Generated SQL for ${products.length} products`);
console.log('\nSQL file created: scripts/products-insert.sql');
