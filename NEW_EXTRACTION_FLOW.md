# New Extraction Flow - Markdown-Based Field Extraction

## Overview

The extraction process has been updated to use a **two-step approach** that extracts fields from markdown instead of directly from PDFs.

---

## 🔄 **New Process Flow**

### **Step 1: PDF → Markdown Conversion**
- Convert the entire PDF to clean markdown format
- Preserve all tables exactly as they appear
- Keep only the first page header
- Remove all footers from all pages

### **Step 2: Markdown → Field Extraction**
- Extract specific fields from the markdown text
- Search through the structured markdown content
- Parse tables and text sections
- Return extracted data in the standard format

---

## 📊 **Architecture Comparison**

### **Old Approach (Direct PDF Extraction)**
```
PDF File
   ↓
Upload to OpenAI
   ↓
Assistants API with file_search
   ↓
Extract fields directly from PDF
   ↓
Return extracted data
```

**Issues:**
- Less visibility into what the AI is seeing
- Harder to debug extraction issues
- Headers/footers might confuse the AI
- Limited control over document structure

### **New Approach (Markdown-Based Extraction)**
```
PDF File
   ↓
Step 1: Convert to Markdown
   ├─ Upload to OpenAI
   ├─ Assistants API processes PDF
   ├─ Returns clean markdown
   │   • Tables preserved
   │   • First page header only
   │   • All footers removed
   │   • Clean structure
   ↓
Step 2: Extract from Markdown
   ├─ Send markdown to Chat Completions
   ├─ AI searches structured text
   ├─ Extracts specific fields
   └─ Returns field values
   ↓
Return extracted data
```

**Benefits:**
- ✅ Cleaner input (no headers/footers clutter)
- ✅ Structured tables in markdown format
- ✅ Better visibility (can inspect markdown)
- ✅ Easier debugging
- ✅ More accurate field extraction
- ✅ Can cache/reuse markdown

---

## 🔧 **Implementation Details**

### **1. New Function: `convertPDFToMarkdown()`**

```typescript
async function convertPDFToMarkdown(file: File, apiKey: string): Promise<string>
```

**What it does:**
- Uploads PDF to OpenAI
- Uses Assistants API with file_search
- Returns full markdown document with:
  - All tables preserved in markdown format
  - Only first page header
  - No footers
  - All body content from all pages

**Example Output:**
```markdown
# Insurance Policy Document

## Benefits Schedule

| Benefit Type | Coverage Limit | Co-insurance |
|--------------|----------------|--------------|
| Inpatient    | QAR 500,000   | 100%         |
| Outpatient   | QAR 50,000    | 90%          |
| Dental       | QAR 5,000     | 80%          |

## Terms and Conditions
...
```

### **2. New Function: `extractFieldsFromMarkdown()`**

```typescript
async function extractFieldsFromMarkdown(
  markdown: string,
  fields: string[],
  apiKey: string,
  payerPlan?: PayerPlan
): Promise<Record<string, any>>
```

**What it does:**
- Takes the markdown document
- Uses Chat Completions API (not Assistants)
- Searches for specific fields in the markdown
- Returns extracted values in table format

**Input:**
- Markdown document (from step 1)
- List of fields to extract (e.g., "Policy Number", "Co-insurance", etc.)
- API key
- Optional payer plan for field hints

**Output:**
```typescript
{
  "Policy Number": "POL-2024-12345",
  "Category": "Gold",
  "Co-insurance": "90%",
  "Dental Benefit": "QAR 5,000",
  // ... etc
}
```

### **3. Updated: `extractDataApi()`**

**New Flow:**
```typescript
export async function extractDataApi({ file, apiKey, fields, payerPlan }) {
  // STEP 1: Convert PDF to Markdown
  const markdown = await convertPDFToMarkdown(file, apiKey);
  
  // STEP 2: Extract fields from markdown
  const json = await extractFieldsFromMarkdown(markdown, resolvedFields, apiKey, payerPlan);
  
  // STEP 3: Validate and format (same as before)
  let normalized = validateAllExtractedData(json, resolvedFields);
  if (payerPlan === 'QLM') {
    normalized = formatQLMFields(normalized);
  }
  
  return normalized;
}
```

---

## 📝 **Field Extraction Process**

### **How Fields Are Located**

The `extractFieldsFromMarkdown()` function instructs the AI to:

1. **Search in Tables**
   - Look for field names in left column
   - Extract values from right column
   - Example: `| Policy Number | POL-2024-12345 |`

2. **Search in Text Sections**
   - Find field names followed by colons or labels
   - Extract the value that follows
   - Example: `Policy Number: POL-2024-12345`

3. **Use Field Synonyms**
   - Check alternative names (from FIELD_SUGGESTIONS)
   - Example: "Dental Benefit" also searches for "Dental Coverage", "Dental Plan"

4. **Handle Missing Fields**
   - Return `null` for fields not found
   - Never infer or hallucinate values

### **Extraction Prompt Structure**

```
You are an expert insurance policy data extraction assistant.

MARKDOWN DOCUMENT:
[Full markdown content here]

FIELDS TO EXTRACT:
- Policy Number
- Category
- Co-insurance
- Dental Benefit
- Optical Benefit
... etc

FIELD SYNONYMS:
- Dental Benefit: also look for Dental Coverage, Dental Plan
- Optical Benefit: also look for Vision Coverage, Eye Care
... etc

OUTPUT FORMAT:
| Field Name | Value |
|------------|-------|
| Policy Number | POL-2024-12345 |
| Category | Gold |
...
```

---

## 🎯 **Advantages of New Approach**

### **1. Better Accuracy**
- Cleaner input without repetitive headers/footers
- Structured markdown tables are easier to parse
- Field names are clearer in markdown format

### **2. Improved Debugging**
- Can inspect the markdown output
- See exactly what the AI is searching through
- Identify why fields are missed or misextracted

### **3. Performance Benefits**
- Markdown can be cached for multiple extractions
- Faster field extraction from text vs PDF
- Can extract different field sets without re-converting

### **4. Flexibility**
- Can manually edit markdown if needed
- Easy to test extraction with sample markdown
- Can build additional features on top of markdown

### **5. Cost Optimization** (Future)
- Convert once, extract multiple times
- Cache markdown for repeated use
- Reuse same markdown for different payer plans

---

## 🧪 **Testing the New Flow**

### **Test Case 1: Basic Extraction**

```typescript
const file = // your PDF file
const apiKey = 'your-api-key';
const fields = ['Policy Number', 'Category', 'Co-insurance'];

const result = await extractDataApi({ 
  file, 
  apiKey, 
  fields,
  payerPlan: 'ALKOOT'
});

console.log(result);
// {
//   "Policy Number": "POL-2024-12345",
//   "Category": "Gold",
//   "Co-insurance": "90%"
// }
```

### **Test Case 2: Inspect Markdown**

You can add logging to see the markdown:

```typescript
// In extractDataApi() after step 1:
const markdown = await convertPDFToMarkdown(file, apiKey);
console.log('=== MARKDOWN OUTPUT ===');
console.log(markdown);
console.log('=== END MARKDOWN ===');
```

### **Test Case 3: Field Not Found**

```typescript
const result = await extractDataApi({ 
  file, 
  apiKey, 
  fields: ['Policy Number', 'Non-Existent Field'],
  payerPlan: 'ALKOOT'
});

console.log(result);
// {
//   "Policy Number": "POL-2024-12345",
//   "Non-Existent Field": null
// }
```

---

## 📊 **Performance Considerations**

### **Processing Time**

**Old Approach:**
- Single API call: ~8-12 seconds

**New Approach:**
- Step 1 (PDF → Markdown): ~8-12 seconds
- Step 2 (Extract fields): ~3-5 seconds
- **Total: ~11-17 seconds**

⚠️ **Note:** The new approach takes slightly longer but provides better accuracy and visibility.

### **API Costs**

**Old Approach:**
- 1 file upload
- 1 Assistant run
- Cost: ~$0.01-0.05 per extraction

**New Approach:**
- 1 file upload (for markdown conversion)
- 1 Assistant run (for markdown conversion)
- 1 Chat completion (for field extraction)
- Cost: ~$0.02-0.08 per extraction

⚠️ **Note:** Slightly higher cost, but markdown can be cached for future extractions.

### **Token Usage**

- Markdown conversion: ~500-2000 tokens output
- Field extraction: ~1000-3000 tokens input (markdown) + ~500-1000 tokens output

---

## 🔍 **Debugging Tips**

### **Issue: Fields Not Being Extracted**

**Solution 1: Check Markdown Output**
```typescript
console.log('Markdown preview:', markdown.substring(0, 1000));
```
- Verify tables are properly formatted
- Check if field names appear in the markdown

**Solution 2: Check Field Names**
```typescript
console.log('Looking for fields:', resolvedFields);
```
- Ensure field names match exactly
- Check if synonyms are defined in FIELD_SUGGESTIONS

**Solution 3: Manual Markdown Test**
```typescript
// Test extraction with sample markdown
const testMarkdown = `
| Policy Number | POL-123 |
| Category | Gold |
`;

const result = await extractFieldsFromMarkdown(
  testMarkdown, 
  ['Policy Number', 'Category'], 
  apiKey
);
```

### **Issue: Incorrect Values Extracted**

**Solution: Check Markdown Content**
- Verify the markdown has the correct values
- Check if headers/footers were properly removed
- Look for duplicate field names that might confuse the AI

---

## 🚀 **Future Enhancements**

### **1. Markdown Caching**
```typescript
// Cache markdown for reuse
const markdownCache = new Map<string, string>();

if (markdownCache.has(file.name)) {
  markdown = markdownCache.get(file.name);
} else {
  markdown = await convertPDFToMarkdown(file, apiKey);
  markdownCache.set(file.name, markdown);
}
```

### **2. Parallel Field Extraction**
```typescript
// Extract different field groups in parallel
const [basicFields, benefitFields] = await Promise.all([
  extractFieldsFromMarkdown(markdown, BASIC_FIELDS, apiKey),
  extractFieldsFromMarkdown(markdown, BENEFIT_FIELDS, apiKey)
]);
```

### **3. Markdown Post-Processing**
```typescript
// Clean up markdown before extraction
const cleanedMarkdown = removeRedundantSections(markdown);
const enhancedMarkdown = addFieldHints(cleanedMarkdown);
```

### **4. Comparison Tool**
```typescript
// Compare markdown outputs to verify conversion quality
const markdown1 = await convertPDFToMarkdown(file1, apiKey);
const markdown2 = await convertPDFToMarkdown(file2, apiKey);
const diff = compareMarkdown(markdown1, markdown2);
```

---

## ✅ **Summary**

The new extraction flow provides:

1. ✅ **Better Structure**: Clean markdown with preserved tables
2. ✅ **Higher Accuracy**: No header/footer clutter
3. ✅ **Better Debugging**: Inspect intermediate markdown
4. ✅ **More Flexibility**: Reuse markdown for multiple extractions
5. ✅ **Same Output Format**: Compatible with existing code

**The implementation maintains backward compatibility** - the `extractDataApi()` function returns the same format, so no changes are needed in components that use it.

---

*Implementation complete! 🎉*

