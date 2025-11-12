# Quick Start Guide - Test & Improve Extraction System

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

This will install all required packages including:
- `pdf-parse` - For reliable PDF text extraction (especially tables!)
- `tsx` - For running TypeScript test scripts
- All other dependencies

### Step 2: Set Your OpenAI API Key
```bash
export OPENAI_API_KEY="sk-your-actual-api-key-here"
```

### Step 3: Run the Test
```bash
npm run test:extraction
```

## 📊 What Happens Next?

The system will automatically:

1. ✅ Load `test.pdf` and `test.expected.json`
2. 🔄 Extract data using the improved `extractionApi.new.ts`
3. 📈 Compare results and calculate accuracy
4. 📝 Generate detailed reports in `test-reports/`
5. 💡 Suggest improvements for failed fields
6. 🔁 Repeat up to 10 times or until 100% accuracy

## 📁 What Gets Created?

After running, you'll find:

```
test-reports/
├── iteration-1.json        # First run results
├── iteration-2.json        # Second run results (if needed)
├── best-checkpoint.json    # Best results achieved
├── improvements-log.txt    # All improvement suggestions
└── final-summary.json      # Overall summary
```

## 🎯 Expected Results

For `test.pdf`, the system should extract these 13 fields:

| Field | Expected Value |
|-------|----------------|
| Policy Number | AK/HC/00064/7/1 |
| Category | AL SAFELEYAH REAL ESTATE INVESTMENT |
| Effective Date | 01 November 2025 |
| Expiry Date | 31 October 2026 |
| Al Ahli Hospital | Nil |
| Co-insurance on all inpatient treatment | Nil |
| Deductible on consultation | Nil |
| Co-insurance | Nil |
| Vaccinations & immunizations | Covered |
| Psychiatric treatment and Psychotherapy | Covered |
| Pregnancy and childbirth | Not Covered |
| Dental Benefit | QAR 7,500, 20% co-insurance, nil deductible |
| Optical Benefit | Not Covered |

## 📖 Example Output

```bash
$ npm run test:extraction

============================================================
EXTRACTION TEST - RECURSIVE IMPROVEMENT
============================================================
PDF: test.pdf
Expected Results: test.expected.json
Max Iterations: 10
============================================================

Loaded expected results for AL SAFELEYAH REAL ESTATE INVESTMENT
Payer Plan: ALKOOT
Total fields: 13

============================================================
ITERATION 1/10
============================================================
Running extraction...
✓ Extraction complete
Accuracy: 84.6% (11/13 fields)

Failed fields:
  - Deductible on consultation: expected "Nil", got null
  - Dental Benefit: expected "QAR 7,500, 20% co-insurance...", got "QAR 7,500"

Improvements to apply:
  - Add "OPD deductible" to field hints for "Deductible on consultation"
  - For "Dental Benefit": Extract complete value with all components
  
✓ Saved checkpoint with 84.6% accuracy
```

## 🔧 Advanced Options

### Custom PDF
```bash
npm run test:extraction -- --pdf=custom.pdf --expected=custom.expected.json
```

### Limit Iterations
```bash
npm run test:extraction -- --max-iterations=5
```

### Pass API Key Directly
```bash
npm run test:extraction -- --api-key=sk-your-key-here
```

## 🎯 Goal

The system aims to achieve **100% accuracy** on all 13 fields through:
- Better prompts
- More field variations
- Smarter extraction logic
- Iterative improvements

## 📚 Need More Info?

- **TEST_SYSTEM_README.md** - Detailed documentation
- **IMPLEMENTATION_COMPLETE.md** - What was built
- **test-reports/** - Check generated reports after running

## 💡 Tips

1. **First Run**: Don't expect 100% on first try - that's okay!
2. **Review Reports**: Check `test-reports/iteration-1.json` for details
3. **Apply Improvements**: Read `improvements-log.txt` for suggestions
4. **Iterate**: Re-run after applying improvements
5. **Monitor Progress**: Each iteration saves results

## ✅ Success

When you see:
```
🎉 SUCCESS! 100% accuracy achieved in N iteration(s)!
```

You're ready to deploy `extractionApi.new.ts` to production!

## 🆘 Troubleshooting

**"OpenAI API key required"**
→ Set the `OPENAI_API_KEY` environment variable

**"PDF not found"**
→ Make sure `test.pdf` is in the project root

**Low accuracy**
→ Review `improvements-log.txt` and apply suggestions to `extractionApi.new.ts`

**Errors during extraction**
→ Check `test-reports/error-iteration-N.json` for details

---

**Ready? Let's go!** 🚀

```bash
npm install && export OPENAI_API_KEY="your-key" && npm run test:extraction
```

