/**
 * Extraction Test Harness
 * 
 * Comprehensive testing system that:
 * - Runs extractions and compares with expected results
 * - Calculates accuracy metrics
 * - Identifies failures and patterns
 * - Auto-generates improvements
 * - Iteratively improves until 100% accuracy or max iterations
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PayerPlan, ExtractedData } from '../src/constants/fields';

// Import the extraction API (dynamically to allow switching)
let extractionApi: any;

export interface TestConfig {
  testCases: Array<{
    pdfPath: string;
    expectedPath: string;
    payerPlan: PayerPlan;
    payerPlanName?: string;
  }>;
  extractionApiPath: string;
  apiKey: string;
  maxIterations: number;
  stopOnSuccess: boolean;
}

export interface TestResult {
  field: string;
  expected: string | null;
  actual: string | null;
  match: boolean;
  reason?: string;
}

export interface IterationReport {
  iteration: number;
  timestamp: string;
  accuracy: number;
  fieldsTotal: number;
  fieldsCorrect: number;
  fieldsFailed: number;
  failures: TestResult[];
  improvementsApplied: string[];
  timeMs: number;
}

export interface ExpectedResults {
  context: string;
  payerPlan: string;
  pdfName: string;
  expectedFields: Record<string, string | null>;
  notes?: Record<string, string>;
}

/**
 * Load expected results from JSON file
 */
export function loadExpectedResults(expectedPath: string): ExpectedResults {
  const fullPath = path.resolve(expectedPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Run extraction using specified API
 */
export async function runExtraction(
  pdfPath: string,
  payerPlan: PayerPlan,
  apiKey: string,
  apiPath: string
): Promise<ExtractedData> {
  // Dynamically import the extraction API
  if (!extractionApi) {
    extractionApi = await import(apiPath);
  }
  
  // Read PDF file
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfFile = new File([pdfBuffer], path.basename(pdfPath), { type: 'application/pdf' });
  
  // Run extraction
  console.log(`Running extraction with API: ${apiPath}`);
  const result = await extractionApi.extractDataApi({
    file: pdfFile,
    apiKey,
    payerPlan,
    payerPlanName: payerPlan
  });
  
  return result;
}

/**
 * Compare actual results with expected
 */
export function compareResults(
  expected: Record<string, string | null>,
  actual: ExtractedData
): TestResult[] {
  const results: TestResult[] = [];
  
  for (const [field, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[field] || null;
    const match = normalizeValue(expectedValue) === normalizeValue(actualValue);
    
    const result: TestResult = {
      field,
      expected: expectedValue,
      actual: actualValue,
      match
    };
    
    if (!match) {
      result.reason = getReason(expectedValue, actualValue);
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Normalize values for comparison
 */
function normalizeValue(value: string | null): string {
  if (value === null || value === undefined) return 'null';
  return value.trim().toLowerCase();
}

/**
 * Determine reason for mismatch
 */
function getReason(expected: string | null, actual: string | null): string {
  if (actual === null || actual === undefined) {
    return 'Field not found in extraction';
  }
  if (expected === null) {
    return 'Field should not have been extracted';
  }
  
  const expNorm = normalizeValue(expected);
  const actNorm = normalizeValue(actual);
  
  if (actNorm.includes(expNorm) || expNorm.includes(actNorm)) {
    return 'Partial match - formatting difference';
  }
  
  return 'Completely different value';
}

/**
 * Calculate accuracy metrics
 */
export function calculateAccuracy(results: TestResult[]): {
  accuracy: number;
  correct: number;
  total: number;
  failed: TestResult[];
} {
  const total = results.length;
  const correct = results.filter(r => r.match).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;
  const failed = results.filter(r => !r.match);
  
  return { accuracy, correct, total, failed };
}

/**
 * Identify discrepancies
 */
export function identifyDiscrepancies(results: TestResult[]): TestResult[] {
  return results.filter(r => !r.match);
}

/**
 * Analyze failure patterns
 */
export function analyzeFailurePatterns(failures: TestResult[]): {
  notFound: string[];
  wrongValue: string[];
  formattingIssue: string[];
  patterns: string[];
} {
  const notFound: string[] = [];
  const wrongValue: string[] = [];
  const formattingIssue: string[] = [];
  const patterns: string[] = [];
  
  for (const failure of failures) {
    if (failure.reason?.includes('not found')) {
      notFound.push(failure.field);
    } else if (failure.reason?.includes('formatting')) {
      formattingIssue.push(failure.field);
    } else {
      wrongValue.push(failure.field);
    }
  }
  
  // Identify patterns
  if (notFound.length > 0) {
    patterns.push(`${notFound.length} field(s) not found in document`);
  }
  if (wrongValue.length > 0) {
    patterns.push(`${wrongValue.length} field(s) extracted with wrong value`);
  }
  if (formattingIssue.length > 0) {
    patterns.push(`${formattingIssue.length} field(s) have formatting differences`);
  }
  
  // Check for specific patterns
  const opdFields = failures.filter(f => 
    f.field.toLowerCase().includes('consultation') || 
    f.field.toLowerCase().includes('outpatient')
  );
  if (opdFields.length > 0) {
    patterns.push('OPD/consultation fields failing - may need better prioritization');
  }
  
  const dentalOptical = failures.filter(f => 
    f.field.toLowerCase().includes('dental') || 
    f.field.toLowerCase().includes('optical')
  );
  if (dentalOptical.length > 0) {
    patterns.push('Dental/Optical fields failing - may need complete value extraction');
  }
  
  return { notFound, wrongValue, formattingIssue, patterns };
}

/**
 * Generate improvement suggestions based on failures
 */
export function generateImprovements(failures: TestResult[]): string[] {
  const improvements: string[] = [];
  const analysis = analyzeFailurePatterns(failures);
  
  // Generate specific improvements for not found fields
  for (const field of analysis.notFound) {
    improvements.push(`Add more field variations for "${field}" in field hints`);
    improvements.push(`Improve search instructions for "${field}" in prompt`);
  }
  
  // Generate improvements for wrong values
  for (const field of analysis.wrongValue) {
    const failure = failures.find(f => f.field === field);
    if (failure) {
      if (field.toLowerCase().includes('dental') && failure.actual && !failure.actual.includes(',')) {
        improvements.push(`For "${field}": Extract complete value with all components (limit + co-insurance + deductible)`);
      } else if (field === 'Category' && failure.actual) {
        improvements.push(`For "${field}": Extract plan name only, not coverage category (CAT 1, etc.)`);
      } else if (field === 'Al Ahli Hospital' && failure.actual && failure.actual.length > 20) {
        improvements.push(`For "${field}": Return simple value "Nil", not the full provider list`);
      } else {
        improvements.push(`For "${field}": Review extraction logic - expected "${failure.expected}" but got "${failure.actual}"`);
      }
    }
  }
  
  // Add pattern-based improvements
  if (analysis.patterns.some(p => p.includes('OPD'))) {
    improvements.push('Emphasize OUTPATIENT priority in prompt for co-insurance and deductible fields');
  }
  
  return improvements;
}

/**
 * Save checkpoint of best results
 */
export function saveCheckpoint(
  results: TestResult[],
  accuracy: number,
  reportDir: string
): void {
  const checkpoint = {
    timestamp: new Date().toISOString(),
    accuracy,
    results: results.map(r => ({
      field: r.field,
      expected: r.expected,
      actual: r.actual,
      match: r.match
    }))
  };
  
  const checkpointPath = path.join(reportDir, 'best-checkpoint.json');
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  console.log(`✓ Saved checkpoint with ${accuracy}% accuracy`);
}

/**
 * Generate iteration report
 */
export function generateIterationReport(
  iteration: number,
  results: TestResult[],
  improvements: string[],
  timeMs: number,
  reportDir: string
): void {
  const { accuracy, correct, total, failed } = calculateAccuracy(results);
  
  const report: IterationReport = {
    iteration,
    timestamp: new Date().toISOString(),
    accuracy: Math.round(accuracy * 10) / 10,
    fieldsTotal: total,
    fieldsCorrect: correct,
    fieldsFailed: failed.length,
    failures: failed,
    improvementsApplied: improvements,
    timeMs
  };
  
  const reportPath = path.join(reportDir, `iteration-${iteration}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n=== Iteration ${iteration} Report ===`);
  console.log(`Accuracy: ${report.accuracy}%`);
  console.log(`Correct: ${correct}/${total} fields`);
  console.log(`Time: ${timeMs}ms`);
  
  if (failed.length > 0) {
    console.log(`\nFailed fields:`);
    failed.forEach(f => {
      console.log(`  - ${f.field}: expected "${f.expected}", got "${f.actual}"`);
      if (f.reason) console.log(`    Reason: ${f.reason}`);
    });
  }
  
  if (improvements.length > 0) {
    console.log(`\nImprovements to apply:`);
    improvements.forEach(imp => console.log(`  - ${imp}`));
  }
}

/**
 * Generate final summary report
 */
export function generateFinalReport(
  allReports: IterationReport[],
  success: boolean,
  reportDir: string
): void {
  const summary = {
    success,
    totalIterations: allReports.length,
    finalAccuracy: allReports[allReports.length - 1]?.accuracy || 0,
    bestAccuracy: Math.max(...allReports.map(r => r.accuracy)),
    totalTime: allReports.reduce((sum, r) => sum + r.timeMs, 0),
    iterationSummaries: allReports.map(r => ({
      iteration: r.iteration,
      accuracy: r.accuracy,
      fieldsCorrect: r.fieldsCorrect,
      fieldsFailed: r.fieldsFailed
    })),
    allImprovements: allReports.flatMap(r => r.improvementsApplied),
    remainingIssues: success ? [] : allReports[allReports.length - 1]?.failures || []
  };
  
  const summaryPath = path.join(reportDir, 'final-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FINAL SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Status: ${success ? '✓ SUCCESS' : '✗ INCOMPLETE'}`);
  console.log(`Final Accuracy: ${summary.finalAccuracy}%`);
  console.log(`Best Accuracy: ${summary.bestAccuracy}%`);
  console.log(`Total Iterations: ${summary.totalIterations}`);
  console.log(`Total Time: ${Math.round(summary.totalTime / 1000)}s`);
  console.log(`\nReports saved to: ${reportDir}`);
}

export default {
  loadExpectedResults,
  runExtraction,
  compareResults,
  calculateAccuracy,
  identifyDiscrepancies,
  analyzeFailurePatterns,
  generateImprovements,
  saveCheckpoint,
  generateIterationReport,
  generateFinalReport
};

