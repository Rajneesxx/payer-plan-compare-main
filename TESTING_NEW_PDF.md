# 📄 Testing a New PDF - Quick Guide

## For test2.pdf (or any new PDF)

### Step 1: Extract Data from the PDF

Run a single extraction to see what data is extracted:

```bash
npm run extract:single -- --pdf=test2.pdf
```

**This will**:
1. Extract all fields from test2.pdf
2. Show you the extracted data in the console
3. Save it to `test2.extracted.json`

### Step 2: Review the Extracted Data

Open `test2.extracted.json` and verify the values are correct by checking against the actual PDF:

```bash
cat test2.extracted.json
```

or open it in your editor.

### Step 3: Create Expected Results File

If the extracted data looks good, copy it to create the expected results:

```bash
cp test2.extracted.json test2.expected.json
```

**Or** manually edit `test2.expected.json` to correct any wrong values.

### Step 4: Run the Full Test

Now you can run the full test with comparison:

```bash
npm run test:extraction -- --pdf=test2.pdf --expected=test2.expected.json --max-iterations=1
```

---

## Alternative: Manual Creation

If you prefer to create the expected file manually:

1. Look at the PDF and identify all the field values
2. Create `test2.expected.json` following this format:

```json
{
  "context": "Al Ahli Hospital insurance document - ALKOOT provider",
  "payerPlan": "ALKOOT",
  "pdfName": "test2.pdf",
  "expectedFields": {
    "Policy Number": "YOUR_VALUE_HERE",
    "Category": "YOUR_VALUE_HERE",
    "Effective Date": "YOUR_VALUE_HERE",
    "Expiry Date": "YOUR_VALUE_HERE",
    "Al Ahli Hospital": "Nil",
    "Co-insurance on all inpatient treatment": "Nil",
    "Deductible on consultation": "Nil",
    "Co-insurance": "Nil",
    "Vaccinations & immunizations": "Covered",
    "Psychiatric treatment and Psychotherapy": "QAR 3,500. Prior-approval required.",
    "Pregnancy and childbirth": "Not Covered",
    "Dental Benefit": "QAR 7,500, 20% co-insurance, nil deductible",
    "Optical Benefit": "Not Covered"
  }
}
```

3. Replace the values with the actual values from test2.pdf

---

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run extract:single -- --pdf=test2.pdf` | Extract from test2.pdf without comparison |
| `npm run test:extraction` | Test with test.pdf (default) |
| `npm run test:extraction -- --pdf=test2.pdf --expected=test2.expected.json` | Test with test2.pdf |
| `npm run test:extraction -- --max-iterations=5` | Run multiple improvement iterations |

---

## Example Workflow

```bash
# 1. Extract from new PDF
npm run extract:single -- --pdf=test2.pdf

# 2. Review the results
cat test2.extracted.json

# 3. If good, make it the expected file
cp test2.extracted.json test2.expected.json

# 4. Or manually edit if needed
nano test2.expected.json

# 5. Run the test
npm run test:extraction -- --pdf=test2.pdf --expected=test2.expected.json

# 6. Check accuracy
cat test-reports/iteration-1.json
```

---

## Tips

1. **First extraction won't be perfect** - That's okay! The point is to get a baseline.

2. **Review carefully** - Compare the extracted values against the actual PDF to catch errors.

3. **Fix obvious errors** - If "Covered" was extracted as "Covered as per MOPH schedule...", change it to just "Covered".

4. **Iterate** - Run the test, see what fails, adjust expected values if needed.

5. **Document edge cases** - If a field is tricky, note it in the JSON file comments (if you add a "notes" section like test.expected.json).

---

## Expected File Format

The expected JSON file should match this structure (see `test.expected.json` as reference):

```json
{
  "context": "Brief description",
  "payerPlan": "ALKOOT",
  "pdfName": "test2.pdf",
  "expectedFields": {
    // All 13 ALKOOT fields with their correct values
  },
  "notes": {
    // Optional: Special notes about specific fields
  }
}
```

---

## Troubleshooting

**Error: Expected results not found**
→ You need to create `test2.expected.json` first

**How to create it?**
→ Run `npm run extract:single -- --pdf=test2.pdf` first

**Extraction takes too long**
→ Normal for GPT-5, can take 2-5 minutes

**Low accuracy on first run**
→ Expected! Review and correct the expected values, then re-run

---

**Ready to test test2.pdf!** 🚀

```bash
npm run extract:single -- --pdf=test2.pdf
```

