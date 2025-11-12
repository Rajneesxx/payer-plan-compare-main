#!/usr/bin/env node
/**
 * CLI Test Runner with Auto-Improvement Engine
 * 
 * Usage:
 *   npm run test:extraction
 *   npm run test:extraction -- --max-iterations=5
 *   npm run test:extraction -- --pdf=custom.pdf --expected=custom.expected.json
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  loadExpectedResults,
  runExtraction,
  compareResults,
  calculateAccuracy,
  generateImprovements,
  saveCheckpoint,
  generateIterationReport,
  generateFinalReport,
  type TestConfig,
  type IterationReport
} from './extractionTest';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs(): {
  pdfPath: string;
  expectedPath: string;
  maxIterations: number;
  apiKey?: string;
} {
  const args = process.argv.slice(2);
  let pdfPath = 'test.pdf';
  let expectedPath = 'test.expected.json';
  let maxIterations = 10;
  let apiKey: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--pdf=')) {
      pdfPath = arg.split('=')[1];
    } else if (arg.startsWith('--expected=')) {
      expectedPath = arg.split('=')[1];
    } else if (arg.startsWith('--max-iterations=')) {
      maxIterations = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--api-key=')) {
      apiKey = arg.split('=')[1];
    }
  }
  
  return { pdfPath, expectedPath, maxIterations, apiKey };
}

/**
 * Apply improvements by logging them
 * Note: Actual prompt modification would require code generation
 * For now, we log improvements for manual application
 */
async function applyImprovements(improvements: string[], iteration: number): Promise<void> {
  console.log(`\n--- Applying Improvements for Next Iteration ---`);
  if (improvements.length === 0) {
    console.log('No new improvements to apply');
    return;
  }
  
  improvements.forEach((imp, idx) => {
    console.log(`${idx + 1}. ${imp}`);
  });
  
  // Log improvements to a file for tracking
  const improvementLog = path.resolve('test-reports', 'improvements-log.txt');
  const logEntry = `\n=== Iteration ${iteration} ===\n${new Date().toISOString()}\n${improvements.join('\n')}\n`;
  fs.appendFileSync(improvementLog, logEntry);
  
  console.log(`\nImprovements logged to: ${improvementLog}`);
  console.log('Note: Review and manually apply critical improvements to extractionApi.new.ts\n');
}

/**
 * Main recursive test function
 */
async function recursiveTest(): Promise<void> {
  const { pdfPath, expectedPath, maxIterations, apiKey: argApiKey } = parseArgs();
  
  // Get API key from args or environment
  const apiKey = argApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OpenAI API key required');
    console.error('Set OPENAI_API_KEY environment variable or use --api-key=YOUR_KEY');
    process.exit(1);
  }
  
  // Resolve paths
  const projectRoot = path.resolve(__dirname, '..');
  const fullPdfPath = path.resolve(projectRoot, pdfPath);
  const fullExpectedPath = path.resolve(projectRoot, expectedPath);
  const reportDir = path.resolve(projectRoot, 'test-reports');
  const apiPath = path.resolve(projectRoot, 'src/services/extractionApi.new.ts');
  
  // Verify files exist
  if (!fs.existsSync(fullPdfPath)) {
    console.error(`Error: PDF not found at ${fullPdfPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(fullExpectedPath)) {
    console.error(`Error: Expected results not found at ${fullExpectedPath}`);
    process.exit(1);
  }
  
  // Ensure report directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EXTRACTION TEST - RECURSIVE IMPROVEMENT`);
  console.log(`${'='.repeat(60)}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Expected Results: ${expectedPath}`);
  console.log(`Max Iterations: ${maxIterations}`);
  console.log(`API: extractionApi.new.ts`);
  console.log(`Reports: test-reports/`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Load expected results
  const expected = loadExpectedResults(fullExpectedPath);
  console.log(`Loaded expected results for ${expected.pdfName}`);
  console.log(`Payer Plan: ${expected.payerPlan}`);
  console.log(`Total fields: ${Object.keys(expected.expectedFields).length}\n`);
  
  // Track all reports
  const allReports: IterationReport[] = [];
  let bestAccuracy = 0;
  let iteration = 0;
  
  // Recursive testing loop
  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ITERATION ${iteration}/${maxIterations}`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    
    try {
      // Run extraction
      console.log('Running extraction...');
      const actual = await runExtraction(
        fullPdfPath,
        expected.payerPlan as any,
        apiKey,
        apiPath
      );
      
      // Compare results
      console.log('Comparing with expected results...');
      const results = compareResults(expected.expectedFields, actual);
      const metrics = calculateAccuracy(results);
      
      const timeMs = Date.now() - startTime;
      
      // Display results
      console.log(`\n✓ Extraction complete`);
      console.log(`Accuracy: ${metrics.accuracy.toFixed(1)}% (${metrics.correct}/${metrics.total} fields)`);
      
      // Check if this is best accuracy so far
      if (metrics.accuracy > bestAccuracy) {
        bestAccuracy = metrics.accuracy;
        saveCheckpoint(results, metrics.accuracy, reportDir);
      }
      
      // Check for 100% success
      if (metrics.accuracy === 100) {
        console.log(`\n🎉 SUCCESS! 100% accuracy achieved in ${iteration} iteration(s)!`);
        
        const improvements: string[] = [];
        generateIterationReport(iteration, results, improvements, timeMs, reportDir);
        allReports.push({
          iteration,
          timestamp: new Date().toISOString(),
          accuracy: metrics.accuracy,
          fieldsTotal: metrics.total,
          fieldsCorrect: metrics.correct,
          fieldsFailed: 0,
          failures: [],
          improvementsApplied: improvements,
          timeMs
        });
        
        generateFinalReport(allReports, true, reportDir);
        process.exit(0);
      }
      
      // Generate improvements
      const improvements = generateImprovements(metrics.failed);
      
      // Generate iteration report
      generateIterationReport(iteration, results, improvements, timeMs, reportDir);
      
      // Store report
      allReports.push({
        iteration,
        timestamp: new Date().toISOString(),
        accuracy: metrics.accuracy,
        fieldsTotal: metrics.total,
        fieldsCorrect: metrics.correct,
        fieldsFailed: metrics.failed.length,
        failures: metrics.failed,
        improvementsApplied: improvements,
        timeMs
      });
      
      // Apply improvements for next iteration
      if (iteration < maxIterations) {
        await applyImprovements(improvements, iteration);
        
        // Show prompt to continue
        console.log(`\n⏸  Iteration ${iteration} complete. Review improvements above.`);
        console.log(`   Next iteration will run automatically...\n`);
        
        // Small delay to allow review
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`\n❌ Error in iteration ${iteration}:`, error);
      console.error('Stack:', (error as Error).stack);
      
      // Save error report
      const errorReport = {
        iteration,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
        stack: (error as Error).stack
      };
      fs.writeFileSync(
        path.join(reportDir, `error-iteration-${iteration}.json`),
        JSON.stringify(errorReport, null, 2)
      );
      
      break;
    }
  }
  
  // Max iterations reached
  if (iteration >= maxIterations) {
    console.log(`\n⚠ Maximum iterations (${maxIterations}) reached`);
    console.log(`Best accuracy achieved: ${bestAccuracy.toFixed(1)}%`);
    generateFinalReport(allReports, false, reportDir);
  }
}

// Run the test
recursiveTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

