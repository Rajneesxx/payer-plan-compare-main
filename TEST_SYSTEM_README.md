# Extraction Test & Improvement System

## Overview

This test system provides automated testing and iterative improvement for the insurance policy extraction system. It runs extraction tests, compares results with expected values, identifies failures, and provides actionable improvement suggestions.

## Files Created

### Core Files
- **`test.expected.json`** - Expected extraction results for test.pdf
- **`src/services/extractionApi.new.ts`** - Improved extraction API (production-ready)
- **`tests/extractionTest.ts`** - Test harness with comparison and metrics
- **`tests/runTest.ts`** - CLI runner with auto-improvement engine
- **`test-reports/`** - Generated test reports (iteration and final summaries)

### Key Improvements in extractionApi.new.ts

1. **Fixed parseMarkdownTable**
   - Handles code fences (```markdown)
   - Better header detection and skipping
   - More robust table parsing

2. **Enhanced Prompts**
   - Added Al Ahli hospital context
   - OPD/Outpatient prioritization for ambiguous fields
   - Detailed field-specific instructions
   - Better few-shot examples

3. **Field-Specific Guidance**
   - Policy Number: Generic search, any format
   - Category: Extract plan name, not coverage level
   - Al Ahli Hospital: Return "Nil", not full provider list
   - Co-insurance: Prioritize OPD sections
   - Deductible on consultation: Prioritize outpatient
   - Dental Benefit: Extract complete value (limit + co-insurance + deductible)
   - Vaccinations & immunizations: Flexible matching
   - Psychiatric: Flexible mental health coverage
   - Pregnancy: Maternity section search

4. **Expanded Field Hints**
   - More variations for each field in `src/constants/fields.ts`
   - Common misspellings and alternative phrasings
   - Better support for different document formats

## Usage

### Install Dependencies

```bash
npm install
```

This will install `tsx` for TypeScript execution.

### Set API Key

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Or pass it as an argument:

```bash
npm run test:extraction -- --api-key=your-key-here
```

### Run Tests

**Basic test (uses test.pdf and test.expected.json):**
```bash
npm run test:extraction
```

**With custom max iterations:**
```bash
npm run test:extraction -- --max-iterations=5
```

**With custom PDF:**
```bash
npm run test:extraction -- --pdf=custom.pdf --expected=custom.expected.json
```

## How It Works

### 1. Test Execution Flow

```
Start
  ↓
Load Expected Results (test.expected.json)
  ↓
For each iteration (up to maxIterations):
  ├─ Run Extraction (extractionApi.new.ts)
  ├─ Compare with Expected
  ├─ Calculate Accuracy
  ├─ If 100% → Success! Exit
  ├─ Identify Failures
  ├─ Analyze Patterns
  ├─ Generate Improvements
  ├─ Log Iteration Report
  └─ Continue to next iteration
  ↓
Max Iterations Reached
  ↓
Generate Final Summary
  ↓
End
```

### 2. Test Metrics

- **Accuracy**: Percentage of correctly extracted fields
- **Correct/Total**: Number of matching fields vs total fields
- **Failures**: Fields that don't match expected values
- **Patterns**: Common failure types (not found, wrong value, formatting)

### 3. Auto-Improvement Engine

The system analyzes failures and generates specific improvements:

**For "not found" fields:**
- Add more field variations to hints
- Improve search instructions in prompts

**For "wrong value" fields:**
- Adjust extraction logic based on field type
- Add specific examples
- Emphasize completeness (e.g., Dental with all components)

**For patterns:**
- OPD fields failing → Emphasize outpatient priority
- Dental/Optical failing → Extract complete value
- Provider fields → Return simple values, not lists

### 4. Reports Generated

**Iteration Reports** (`test-reports/iteration-N.json`):
```json
{
  "iteration": 1,
  "timestamp": "2025-11-11T12:00:00Z",
  "accuracy": 76.9,
  "fieldsTotal": 13,
  "fieldsCorrect": 10,
  "fieldsFailed": 3,
  "failures": [
    {
      "field": "Deductible on consultation",
      "expected": "Nil",
      "actual": null,
      "match": false,
      "reason": "Field not found in extraction"
    }
  ],
  "improvementsApplied": [
    "Add more field variations for Deductible on consultation",
    "Emphasize OUTPATIENT priority in prompt"
  ]
}
```

**Final Summary** (`test-reports/final-summary.json`):
- Success status
- Total iterations
- Final and best accuracy
- All improvements made
- Remaining issues (if any)

**Best Checkpoint** (`test-reports/best-checkpoint.json`):
- Saved automatically when accuracy improves
- Contains best results achieved

**Improvements Log** (`test-reports/improvements-log.txt`):
- Chronological list of all improvements suggested
- Review this to manually apply critical improvements

## Expected Results Format

The `test.expected.json` file structure:

```json
{
  "context": "Document context description",
  "payerPlan": "ALKOOT",
  "pdfName": "PDF filename",
  "expectedFields": {
    "Policy Number": "AK/HC/00064/7/1",
    "Category": "AL SAFELEYAH REAL ESTATE INVESTMENT",
    "Effective Date": "01 November 2025",
    ...
  },
  "notes": {
    "fieldName": "Special instructions or notes"
  }
}
```

## Key Principles

1. **Generic Extraction**: No hardcoded patterns - works across different insurers
2. **Flexible Matching**: Handles variations in field names and formatting
3. **OPD Priority**: Outpatient sections searched first for ambiguous fields
4. **Completeness**: Extract full field values (e.g., dental with all components)
5. **Context-Aware**: Leverages document context (Al Ahli hospital)
6. **Production-Ready**: extractionApi.new.ts can directly replace extractionApi.ts
7. **Separate Testing**: Test code isolated from extraction code

## Troubleshooting

### Test Fails to Run

**Error: "PDF not found"**
- Ensure test.pdf is in the project root
- Or specify correct path with `--pdf=path/to/pdf`

**Error: "Expected results not found"**
- Ensure test.expected.json is in the project root
- Or specify correct path with `--expected=path/to/expected.json`

**Error: "OpenAI API key required"**
- Set `OPENAI_API_KEY` environment variable
- Or pass with `--api-key=your-key`

### Low Accuracy

**Review iteration reports:**
- Check `test-reports/iteration-*.json` for failure details
- Look at `improvements-log.txt` for suggested improvements

**Common issues:**
- Fields not found → Add more field hints
- Wrong values → Adjust field-specific instructions
- Formatting differences → Review expected values format

**Manual improvements:**
- Review suggested improvements in console output
- Manually apply critical improvements to `extractionApi.new.ts`
- Re-run tests to verify improvements

### Extraction Errors

**Check error reports:**
- `test-reports/error-iteration-N.json` contains error details

**Common errors:**
- Network issues → Check API key and connectivity
- Timeout → Large PDFs may take time
- Parse errors → Check markdown table parsing

## Next Steps

1. **Run Initial Test**: `npm run test:extraction`
2. **Review Results**: Check accuracy and failures in reports
3. **Apply Improvements**: Review `improvements-log.txt` and apply manually to extractionApi.new.ts
4. **Re-run Test**: Continue iterating until 100% accuracy
5. **Replace Production**: Once satisfied, replace extractionApi.ts with extractionApi.new.ts

## Success Criteria

- ✅ 100% accuracy on all 13 ALKOOT fields
- ✅ Generic approach works for different formats
- ✅ Clear, actionable reports
- ✅ extractionApi.new.ts ready for production
- ✅ Documented improvements and learnings

## Support

For issues or questions:
1. Check iteration reports in `test-reports/`
2. Review `improvements-log.txt` for suggestions
3. Examine the specific failure reasons in reports
4. Adjust prompts and field hints based on patterns

