# 🚀 Deployment Checklist

Use this checklist to test and deploy the improved extraction system.

---

## ✅ Pre-Deployment: Testing Phase

### 1. Install Dependencies

```bash
cd /Users/anirudhladdha/Downloads/payer-plan-compare-main
npm install
```

**Verify**:
- [ ] `pdf-parse` installed successfully
- [ ] `@types/pdf-parse` installed
- [ ] `tsx` installed
- [ ] No installation errors

---

### 2. Set API Key

```bash
export OPENAI_API_KEY="your-actual-api-key-here"
```

**Verify**:
- [ ] API key is set: `echo $OPENAI_API_KEY`
- [ ] API key starts with `sk-`

---

### 3. Run First Test

```bash
npm run test:extraction
```

**Expected Output**:
```
============================================================
EXTRACTION TEST - RECURSIVE IMPROVEMENT
============================================================
PDF: test.pdf
Expected Results: test.expected.json
Max Iterations: 10
============================================================

[PDF Conversion] Step 1: Extracting text with pdf-parse...
[PDF Conversion] Extracted XXXX characters from X pages
[PDF Conversion] Step 2: Formatting text to markdown with LLM...
[PDF Conversion] Conversion completed

============================================================
ITERATION 1/10
============================================================
Running extraction...
✓ Extraction complete
Accuracy: XX.X% (X/13 fields)
```

**Verify**:
- [ ] Test runs without errors
- [ ] Reports generated in `test-reports/`
- [ ] Accuracy percentage shown
- [ ] Failed fields listed (if any)

---

### 4. Review First Iteration Results

```bash
cat test-reports/iteration-1.json
```

**Check**:
- [ ] Accuracy percentage documented
- [ ] Failed fields identified
- [ ] Reasons for failures provided
- [ ] Improvements suggested

---

### 5. Check Improvements Log

```bash
cat test-reports/improvements-log.txt
```

**Review**:
- [ ] Specific suggestions for each failed field
- [ ] Pattern-based improvements
- [ ] Field hint additions recommended

---

### 6. Manual Improvements (If Needed)

If accuracy < 100%, apply suggested improvements:

**A. Update Field Hints** (if suggested)

Edit: `src/constants/fields.ts`

```typescript
"FieldName": [
  // Add new variations here
  "Alternative Name 1",
  "Alternative Name 2"
]
```

**B. Adjust Prompts** (if suggested)

Edit: `src/services/extractionApi.new.ts`

Look for the field-specific instructions and enhance as suggested.

**After changes**:
- [ ] Applied suggested improvements
- [ ] Saved files

---

### 7. Re-run Tests

```bash
npm run test:extraction
```

**Check**:
- [ ] Accuracy improved from iteration 1
- [ ] New checkpoint saved (if better)
- [ ] Failed fields reduced

---

### 8. Iterate Until 100%

Repeat steps 5-7 until:
- [ ] Accuracy reaches 100% (13/13 fields)
- [ ] All fields match expected values
- [ ] No failures reported

---

### 9. Review Final Summary

```bash
cat test-reports/final-summary.json
```

**Verify**:
- [ ] `"success": true`
- [ ] `"finalAccuracy": 100`
- [ ] `"remainingIssues": []`

---

## ✅ Pre-Deployment: Quality Checks

### 10. Verify PDF Parsing

Check logs for pdf-parse output:

```
[PDF Conversion] Extracted XXXX characters from X pages
[PDF Conversion] First 500 chars: [should show actual content]
```

**Verify**:
- [ ] Character count is reasonable (> 1000 for multi-page PDFs)
- [ ] First 500 chars show actual document content
- [ ] Number of pages is correct

---

### 11. Review Best Checkpoint

```bash
cat test-reports/best-checkpoint.json
```

**Verify**:
- [ ] All 13 fields present
- [ ] All fields match expected values
- [ ] Accuracy is 100%

---

### 12. Test with Additional PDFs (Optional)

If you have other test PDFs:

```bash
# Create expected results
cp test.expected.json custom.expected.json
# Edit custom.expected.json with correct values

# Run test
npm run test:extraction -- --pdf=custom.pdf --expected=custom.expected.json
```

**Verify**:
- [ ] Works with different PDF formats
- [ ] pdf-parse extracts text successfully
- [ ] Extraction accuracy is high

---

## ✅ Deployment: Production

### 13. Backup Current Production Code

```bash
cp src/services/extractionApi.ts src/services/extractionApi.backup.ts
```

**Verify**:
- [ ] Backup created successfully
- [ ] Backup file exists: `ls src/services/extractionApi.backup.ts`

---

### 14. Deploy Improved Version

```bash
cp src/services/extractionApi.new.ts src/services/extractionApi.ts
```

**Verify**:
- [ ] File copied successfully
- [ ] extractionApi.ts now contains improved code
- [ ] No file permission issues

---

### 15. Check for TypeScript Errors

```bash
npm run lint
```

**Verify**:
- [ ] No linting errors
- [ ] TypeScript compiles successfully
- [ ] `@ts-ignore` comment handles pdf-parse import

---

### 16. Build for Production

```bash
npm run build
```

**Verify**:
- [ ] Build completes successfully
- [ ] No build errors
- [ ] Dist files generated

---

### 17. Test Production Build

If you have a staging environment:

```bash
npm run preview
# Or deploy to staging
```

**Test**:
- [ ] Upload a test PDF
- [ ] Extract data
- [ ] Verify accuracy
- [ ] Check console logs for pdf-parse output

---

### 18. Monitor Production

After deployment, monitor:

**Logs to watch**:
```
[PDF Conversion] Step 1: Extracting text with pdf-parse...
[PDF Conversion] Extracted XXXX characters from X pages
[PDF Conversion] Step 2: Formatting text to markdown with LLM...
[PDF Conversion] Conversion completed
```

**Metrics to track**:
- [ ] Extraction accuracy
- [ ] Processing time
- [ ] API costs (should be lower)
- [ ] User reports of issues

---

## ✅ Post-Deployment: Validation

### 19. Validate Production Extractions

Test with real PDFs in production:

**For each PDF type**:
- [ ] Policy Number extracted correctly
- [ ] Category extracted correctly
- [ ] All benefit fields found
- [ ] Table values complete (e.g., Dental with all components)
- [ ] No missing fields

---

### 20. Compare Costs

Track API costs before/after:

**Before** (LLM-only):
- Approximate: $0.20-0.35 per PDF

**After** (pdf-parse + LLM):
- Expected: $0.02-0.05 per PDF

**Verify**:
- [ ] Cost per extraction reduced
- [ ] OpenAI API usage decreased
- [ ] Savings documented

---

### 21. Performance Metrics

**Before** (LLM-only):
- Processing time: 15-25 seconds

**After** (pdf-parse + LLM):
- Expected: 4-6 seconds

**Verify**:
- [ ] Processing time reduced
- [ ] User experience improved
- [ ] No timeout issues

---

## ✅ Rollback Plan (If Needed)

### 22. Rollback Procedure

If issues occur in production:

```bash
# Restore backup
cp src/services/extractionApi.backup.ts src/services/extractionApi.ts

# Rebuild
npm run build

# Redeploy
```

**Verify**:
- [ ] Backup restoration works
- [ ] System returns to previous state
- [ ] Users can extract data again

---

## 📋 Final Checklist Summary

### Testing Phase
- [x] Dependencies installed (pdf-parse, tsx)
- [x] API key configured
- [x] First test run successful
- [x] Iteration results reviewed
- [ ] 100% accuracy achieved
- [ ] Final summary verified

### Deployment Phase
- [ ] Current code backed up
- [ ] Improved version deployed
- [ ] No TypeScript/lint errors
- [ ] Production build successful
- [ ] Staging tested (if applicable)

### Validation Phase
- [ ] Production extractions verified
- [ ] Cost reduction confirmed
- [ ] Performance improvement confirmed
- [ ] User feedback positive

### Contingency
- [ ] Rollback procedure tested
- [ ] Backup verified
- [ ] Recovery plan documented

---

## 🎉 Success Criteria

You're ready for production when:

✅ All 13 ALKOOT fields extract at 100% accuracy
✅ pdf-parse successfully extracts text from all test PDFs
✅ Processing time is 4-6 seconds
✅ Cost per extraction is $0.02-0.05
✅ No TypeScript/build errors
✅ Test reports show consistent success

---

## 📞 Support

If issues arise:

1. **Check logs**: Look for `[PDF Conversion]` messages
2. **Review reports**: `test-reports/error-iteration-N.json`
3. **Test pdf-parse**: Ensure text extraction works
4. **Verify API key**: Check OpenAI API access
5. **Rollback if needed**: Use backup file

---

## 📚 Documentation Reference

- **QUICK_START.md** - Quick setup guide
- **PDF_PARSING_IMPROVEMENT.md** - Why pdf-parse is better
- **BEFORE_AFTER_COMPARISON.md** - Detailed comparison
- **TEST_SYSTEM_README.md** - Test framework docs
- **FINAL_SUMMARY.md** - Overall implementation summary

---

**Good luck with deployment! 🚀**

