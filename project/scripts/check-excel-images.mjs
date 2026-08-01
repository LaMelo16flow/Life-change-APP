import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileData = fs.readFileSync('data/lifechangers_canada_longrich_final_goldheader_4(1).xlsx');
const workbook = XLSX.read(fileData, { cellStyles: true });

console.log('=== CHECKING FOR IMAGES IN EXCEL ===\n');

workbook.SheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];

  console.log(`Sheet: ${sheetName}`);

  if (worksheet['!images']) {
    console.log('Found embedded images:', worksheet['!images'].length);
    worksheet['!images'].forEach((img, idx) => {
      console.log(`Image ${idx + 1}:`, img);
    });
  } else {
    console.log('No embedded images found');
  }

  if (worksheet['!drawing']) {
    console.log('Found drawings:', worksheet['!drawing']);
  }

  if (worksheet['!links']) {
    console.log('Found hyperlinks:', worksheet['!links']);
  }

  console.log('\n');
});

const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
console.log('Sample data from sheet:');
console.log(JSON.stringify(jsonData.slice(4, 8), null, 2));
