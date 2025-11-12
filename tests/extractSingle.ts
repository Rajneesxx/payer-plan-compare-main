#!/usr/bin/env node
/**
 * Single extraction script - extracts data from a PDF without comparing to expected results
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { extractDataApi } from '../src/services/extractionApi.new';
import { ALKOOT_FIELDS, PAYER_PLANS } from '../src/constants/fields';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const pdfArg = args.find(arg => arg.startsWith('--pdf='));
const pdfPath = pdfArg ? pdfArg.split('=')[1] : 'test.pdf';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}

async function main() {
  const fullPdfPath = path.resolve(__dirname, '..', pdfPath);
  
  console.log('\n============================================================');
  console.log('SINGLE EXTRACTION TEST');
  console.log('============================================================');
  console.log(`PDF: ${pdfPath}`);
  console.log(`Full path: ${fullPdfPath}`);
  console.log('============================================================\n');

  if (!fs.existsSync(fullPdfPath)) {
    console.error(`Error: PDF file not found at ${fullPdfPath}`);
    process.exit(1);
  }

  try {
    // Read PDF file
    const pdfBuffer = fs.readFileSync(fullPdfPath);
    const pdfFile = new File([pdfBuffer], path.basename(pdfPath), { type: 'application/pdf' });

    console.log('Starting extraction...\n');
    
    const startTime = Date.now();
    
    const extractedData = await extractDataApi({
      file: pdfFile,
      apiKey: OPENAI_API_KEY as string,
      fields: ALKOOT_FIELDS,
      payerPlan: PAYER_PLANS.ALKOOT,
      payerPlanName: PAYER_PLANS.ALKOOT,
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n============================================================');
    console.log('EXTRACTION COMPLETE');
    console.log('============================================================');
    console.log(`Time: ${duration}s`);
    console.log('\nExtracted Data:\n');
    console.log(JSON.stringify(extractedData, null, 2));
    
    // Save to file
    const outputPath = path.resolve(__dirname, '..', pdfPath.replace('.pdf', '.extracted.json'));
    fs.writeFileSync(outputPath, JSON.stringify(extractedData, null, 2));
    console.log(`\n✓ Saved extracted data to: ${outputPath}`);
    
    // Count fields
    const totalFields = ALKOOT_FIELDS.length;
    const extractedCount = Object.values(extractedData).filter(v => v !== null).length;
    
    console.log(`\nFields extracted: ${extractedCount}/${totalFields}`);
    
    console.log('\n============================================================');
    console.log('Next steps:');
    console.log(`1. Review the extracted data in: ${outputPath}`);
    console.log(`2. Verify the values are correct by checking the PDF`);
    console.log(`3. If correct, rename to: ${pdfPath.replace('.pdf', '.expected.json')}`);
    console.log(`4. Run: npm run test:extraction -- --pdf=${pdfPath} --expected=${pdfPath.replace('.pdf', '.expected.json')}`);
    console.log('============================================================\n');

  } catch (error: any) {
    console.error('\n❌ Extraction failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

