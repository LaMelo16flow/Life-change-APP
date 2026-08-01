import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileData = fs.readFileSync('data/lifechangers_canada_longrich_final_goldheader_4(1).xlsx');
const workbook = XLSX.read(fileData);

const worksheet = workbook.Sheets['Life Changers Canada'];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

console.log('=== EXTRACTING CAD PRICES ===\n');

const products = [];

for (const row of jsonData) {
  const productName = row['Nom de la personne :WILFRIED NAWOUSSI TEZEKUI'];
  const cadPrice = row['__EMPTY'];
  const pv = row['__EMPTY_2'];

  if (productName &&
      productName !== 'Nom du produit' &&
      typeof cadPrice === 'number' &&
      typeof pv === 'number') {
    products.push({
      name: productName,
      cad_price: cadPrice,
      pv: pv
    });
  }
}

console.log(`Found ${products.length} products with CAD prices:\n`);
products.forEach(p => {
  console.log(`${p.name}: CAD $${p.cad_price} (PV: ${p.pv})`);
});

console.log('\n=== SQL UPDATE STATEMENTS ===\n');

products.forEach(p => {
  const safeName = p.name.replace(/'/g, "''");
  console.log(`UPDATE product_prices SET price_cad = ${p.cad_price} WHERE product_id = (SELECT id FROM products WHERE name = '${safeName}' LIMIT 1);`);
});
