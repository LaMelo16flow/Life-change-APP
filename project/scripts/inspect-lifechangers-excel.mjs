import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileData = fs.readFileSync('data/lifechangers_canada_longrich_final_goldheader_4(1).xlsx');
const workbook = XLSX.read(fileData);

console.log('=== LIFECHANGERS EXCEL INSPECTION ===\n');
console.log('Available sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Sheet: ${sheetName}`);
  console.log('='.repeat(60));

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  if (jsonData.length > 0) {
    console.log('\nAll Columns:', Object.keys(jsonData[0]));
    console.log(`\nTotal rows: ${jsonData.length}`);

    console.log('\nFirst 10 rows:');
    jsonData.slice(0, 10).forEach((row, idx) => {
      console.log(`\n--- Row ${idx + 1} ---`);
      console.log(JSON.stringify(row, null, 2));
    });
  } else {
    console.log('(Empty sheet)');
  }
});
