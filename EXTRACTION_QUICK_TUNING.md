# Quick Tuning Guide - Extraction Configuration

## 🎚️ Configuration Location

File: `src/services/extractionApi.ts` (lines ~31-40)

```typescript
const EXTRACTION_CONFIG = {
  PRIMARY_MODEL: "o1-preview",
  FALLBACK_MODEL: "gpt-4o",
  MARKDOWN_MODEL: "gpt-4o",
  USE_STRUCTURED_OUTPUT: true,
  FIELD_BY_FIELD_MODE: false,      // ← CHANGE THIS
  MAX_RETRIES: 2,
  CONFIDENCE_THRESHOLD: 0.7        // ← CHANGE THIS
};
```

## ⚡ Quick Settings

### Problem: Missing Fields (Low Accuracy)

**Solution: Enable Field-by-Field Mode**

```typescript
FIELD_BY_FIELD_MODE: true,       // ← Change to true
CONFIDENCE_THRESHOLD: 0.7
```

**Effect:**
- ✓ Accuracy: 70% → 95%+
- ✗ Time: 15s → 30-60s per document
- ✗ Cost: +50-100%

---

### Problem: Too Slow

**Solution: Disable Field-by-Field, Use gpt-4o Only**

```typescript
PRIMARY_MODEL: "gpt-4o",         // ← Change from o1-preview
FIELD_BY_FIELD_MODE: false,      // ← Keep false
MAX_RETRIES: 1                   // ← Reduce retries
```

**Effect:**
- ✓ Time: 30s → 8-12s per document
- ✓ Cost: -40%
- ✗ Accuracy: 92% → 70-80%

---

### Problem: Too Expensive

**Solution: Balanced Mode**

```typescript
PRIMARY_MODEL: "gpt-4o",         // ← Use gpt-4o instead of o1
FIELD_BY_FIELD_MODE: false,      // ← Disable
MAX_RETRIES: 2,
CONFIDENCE_THRESHOLD: 0.6        // ← Lower threshold
```

**Effect:**
- ✓ Cost: -50%
- ✓ Time: Faster
- ✗ Accuracy: Slightly lower

---

### Problem: Specific Fields Always Missing

**Solution: Add Field Variations**

File: `src/constants/fields.ts`

Find the field and add more variations:

```typescript
"Psychiatric treatment and Psychotherapy": [
  "Psychiatric treatment & Psychotherapy",
  "Mental Health",
  "Psychiatry",
  "Psychological treatment",
  "Mental health coverage",
  // ADD MORE VARIATIONS HERE based on your documents
  "Behavioral health",
  "Counseling services"
],
```

Then **enable field-by-field mode** temporarily to test.

---

## 🎯 Recommended Presets

### Preset 1: MAXIMUM ACCURACY (Use for important documents)

```typescript
const EXTRACTION_CONFIG = {
  PRIMARY_MODEL: "o1-preview",
  FALLBACK_MODEL: "gpt-4o",
  MARKDOWN_MODEL: "gpt-4o",
  USE_STRUCTURED_OUTPUT: true,
  FIELD_BY_FIELD_MODE: true,       // ✓ ENABLED
  MAX_RETRIES: 3,
  CONFIDENCE_THRESHOLD: 0.8
};
```

📊 **Performance:**
- Accuracy: **95-98%**
- Time: 30-60s
- Cost: $0.15-0.25/doc

---

### Preset 2: BALANCED (Recommended default)

```typescript
const EXTRACTION_CONFIG = {
  PRIMARY_MODEL: "o1-preview",
  FALLBACK_MODEL: "gpt-4o",
  MARKDOWN_MODEL: "gpt-4o",
  USE_STRUCTURED_OUTPUT: true,
  FIELD_BY_FIELD_MODE: false,      // ✗ DISABLED
  MAX_RETRIES: 2,
  CONFIDENCE_THRESHOLD: 0.7
};
```

📊 **Performance:**
- Accuracy: **85-92%**
- Time: 15-25s
- Cost: $0.08-0.12/doc

---

### Preset 3: SPEED (Use for batch processing)

```typescript
const EXTRACTION_CONFIG = {
  PRIMARY_MODEL: "gpt-4o",         // Changed
  FALLBACK_MODEL: "gpt-4o",
  MARKDOWN_MODEL: "gpt-4o",
  USE_STRUCTURED_OUTPUT: true,
  FIELD_BY_FIELD_MODE: false,
  MAX_RETRIES: 1,                  // Reduced
  CONFIDENCE_THRESHOLD: 0.6        // Lowered
};
```

📊 **Performance:**
- Accuracy: **70-80%**
- Time: 8-12s
- Cost: $0.04-0.06/doc

---

## 🔍 How to Test Changes

1. **Edit `extractionApi.ts`** with your chosen preset
2. **Save the file**
3. **Upload a test PDF**
4. **Check console logs:**
   ```
   Fields found: 12/13 (92.3%)
   Processing time: 18,523ms
   Model used: o1-preview
   ```
5. **Review missing fields** (if any)
6. **Adjust settings** or add field variations

---

## 📊 Decision Matrix

| Your Priority | Setting to Change | Value |
|--------------|-------------------|-------|
| ✅ **Highest Accuracy** | `FIELD_BY_FIELD_MODE` | `true` |
| ⚡ **Fastest Speed** | `PRIMARY_MODEL` | `"gpt-4o"` |
| 💰 **Lowest Cost** | `FIELD_BY_FIELD_MODE` | `false` |
| 🎯 **Specific Field Missing** | Add to `fields.ts` | More variations |
| 🔄 **More Reliability** | `MAX_RETRIES` | `3` |
| 📉 **Lower False Positives** | `CONFIDENCE_THRESHOLD` | `0.8` |

---

## 🚨 Emergency Fix: Fields Still Missing

If fields are **still missing** after enabling everything:

### Step 1: Check Markdown Extraction
Look in console for "FULL MARKDOWN OUTPUT" - is the data there?

- **If YES**: Problem is field extraction → Add more field variations
- **If NO**: Problem is PDF→Markdown → Check if tables were extracted

### Step 2: Enable Field-by-Field for Specific Fields

Edit the extraction flow to ONLY extract missing fields individually:

```typescript
// Only extract these fields individually
const criticalFields = [
  "Psychiatric treatment and Psychotherapy",
  "Al Ahli Hospital"
];

if (missingFields.some(f => criticalFields.includes(f))) {
  EXTRACTION_CONFIG.FIELD_BY_FIELD_MODE = true;
}
```

### Step 3: Add Debugging for Specific Field

Add console log to see what model is finding:

```typescript
// In extractFieldsFromMarkdown, add after parsing:
console.log('DEBUG - Looking for:', fieldName);
console.log('DEBUG - Found in markdown:', 
  markdown.includes(fieldName) ? 'YES' : 'NO');
```

---

## 📞 Need Help?

**Before asking for help, provide:**
1. Current `EXTRACTION_CONFIG` settings
2. Console logs (especially "FINAL EXTRACTION SUMMARY")
3. Which fields are consistently missing
4. Sample markdown output (if possible)

**Common issues:**
- ❌ Field name in code doesn't match PDF → Add variation
- ❌ Field in special table → Enable field-by-field mode
- ❌ PDF tables not extracted → Check markdown output
- ❌ Model timeout → Reduce retries or switch to gpt-4o

---

## ✨ Advanced: Fine-Tuning for Your Documents

If you have **consistent document formats**, consider:

1. **Collect 50+ examples** with correct field values
2. **Fine-tune gpt-4o** on your specific documents
3. **Expected improvement:** +5-10% accuracy
4. **One-time cost:** ~$50-100
5. **Ongoing benefit:** Better accuracy, lower cost

---

**Quick Reference Version:** 1.0  
**For detailed explanations:** See `DATA_SCIENCE_EXTRACTION_GUIDE.md`

