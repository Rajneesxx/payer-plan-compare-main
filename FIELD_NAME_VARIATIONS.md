# Field Name Variations Handling (& vs and)

## Problem

PDF documents may use different text representations for the same field:
- **In code**: `"Vaccination & Immunization"`
- **In PDF**: `"Vaccination and Immunization"` OR `"Vaccination & Immunization"`

This inconsistency can cause the AI to miss fields when extracting data.

## Solution Implemented

We've implemented **three layers** of protection to handle these variations:

---

## Layer 1: Automatic Variation Generation

The `extractFieldsFromMarkdown()` function **automatically generates variations** for any field containing `&` or `and`:

```typescript
// Input field: "Vaccination & Immunization"
// Auto-generates: "Vaccination and Immunization"

// Input field: "Pregnancy and Childbirth"  
// Auto-generates: "Pregnancy & Childbirth"
```

### How it works:

```typescript
if (f.includes('&')) {
  hintsList.push(f.replace(/\s*&\s*/g, ' and '));
} else if (f.includes(' and ')) {
  hintsList.push(f.replace(/\s+and\s+/g, ' & '));
}
```

This happens **automatically** for every field, even if no manual hints are provided.

---

## Layer 2: Manual Field Synonyms

Added explicit synonyms in `FIELD_SUGGESTIONS` for ALKOOT fields:

### Vaccination & Immunization
```typescript
"Vaccination & Immunization": [
  "Vaccination & Immunizations",      // Plural variation
  "Vaccination and Immunization",     // "and" instead of "&"
  "Vaccination and Immunizations",    // Both variations
  "Vaccination/Immunization"          // Alternative separator
]
```

### Psychiatric treatment & Psychotherapy
```typescript
"Psychiatric treatment & Psychotherapy": [
  "Psychiatric treatment & Psychotherapies",
  "Psychiatric treatment and Psychotherapy",    // "and" variation
  "Psychiatric treatment and Psychotherapies",
  "Psychiatric Treatment"                       // Short form
]
```

### Pregnancy & Childbirth
```typescript
"Pregnancy & Childbirth": [
  "Pregnancy and Childbirth",        // "and" variation
  "Pregnancy & Childbirths",         // Plural
  "Pregnancy and Child birth",       // Space variation
  "Pregnancy and childbirth(in accordance with Hamad Protocol/s)",
  "Maternity"                        // Alternative term
]
```

---

## Layer 3: AI Instructions

The extraction prompt explicitly instructs the AI to handle these variations:

```
5. **Field Name Matching**:
   - Be flexible with "&" and "and" - treat them as equivalent
   - Example matches:
     • "Vaccination & Immunization" = "Vaccination and Immunization"
     • "Pregnancy & Childbirth" = "Pregnancy and Childbirth"
   - Always return the EXACT field name as requested (with & if specified)
```

---

## Examples

### Example 1: Vaccination field

**Field in code:**
```typescript
"Vaccination & Immunization"
```

**Possible matches in PDF:**
- ✅ `Vaccination & Immunization`
- ✅ `Vaccination and Immunization`
- ✅ `Vaccination & Immunizations`
- ✅ `Vaccination and Immunizations`
- ✅ `Vaccination/Immunization`

**Output field name (always):**
```typescript
"Vaccination & Immunization"  // Original name preserved
```

### Example 2: Pregnancy field

**Field in code:**
```typescript
"Pregnancy & Childbirth"
```

**Possible matches in PDF:**
- ✅ `Pregnancy & Childbirth`
- ✅ `Pregnancy and Childbirth`
- ✅ `Pregnancy & Child birth`
- ✅ `Pregnancy and Child birth`
- ✅ `Pregnancy and childbirth(in accordance with Hamad Protocol/s)`
- ✅ `Maternity`

**Output field name (always):**
```typescript
"Pregnancy & Childbirth"  // Original name preserved
```

---

## Field Synonym Generation Process

```
Input Field: "Vaccination & Immunization"
     ↓
┌─────────────────────────────────────┐
│ Step 1: Check manual synonyms      │
│ From FIELD_SUGGESTIONS[ALKOOT]     │
│ Result: [                           │
│   "Vaccination & Immunizations",    │
│ ]                                   │
└─────────────────────────────────────┘
     ↓
┌─────────────────────────────────────┐
│ Step 2: Auto-generate variations   │
│ If contains "&" → add "and" version│
│ Result: [                           │
│   "Vaccination & Immunizations",    │
│   "Vaccination and Immunization"    │ ← Auto-added
│ ]                                   │
└─────────────────────────────────────┘
     ↓
┌─────────────────────────────────────┐
│ Step 3: Send to AI with prompt     │
│                                     │
│ FIELD SYNONYMS:                     │
│ - Vaccination & Immunization:       │
│   also look for:                    │
│   Vaccination & Immunizations,      │
│   Vaccination and Immunization      │
└─────────────────────────────────────┘
```

---

## Testing

### Test Case 1: Field with & in PDF

**PDF Content:**
```markdown
| Benefit | Coverage |
|---------|----------|
| Vaccination & Immunization | QAR 1,000 |
```

**Expected Result:**
```javascript
{
  "Vaccination & Immunization": "QAR 1,000"  ✅
}
```

### Test Case 2: Field with "and" in PDF

**PDF Content:**
```markdown
| Benefit | Coverage |
|---------|----------|
| Vaccination and Immunization | QAR 1,000 |
```

**Expected Result:**
```javascript
{
  "Vaccination & Immunization": "QAR 1,000"  ✅
}
```

### Test Case 3: Alternative spelling

**PDF Content:**
```markdown
| Benefit | Coverage |
|---------|----------|
| Vaccination and Immunizations | QAR 1,000 |
```

**Expected Result:**
```javascript
{
  "Vaccination & Immunization": "QAR 1,000"  ✅
}
```

### Test Case 4: Alternative term

**PDF Content:**
```markdown
| Benefit | Coverage |
|---------|----------|
| Maternity | QAR 15,000 |
```

**Expected Result:**
```javascript
{
  "Pregnancy & Childbirth": "QAR 15,000"  ✅
}
```

---

## Implementation Details

### Code Location

**1. Automatic Variation Generation:**
- File: `src/services/extractionApi.ts`
- Function: `extractFieldsFromMarkdown()`
- Lines: ~162-205

**2. Manual Synonyms:**
- File: `src/constants/fields.ts`
- Object: `FIELD_SUGGESTIONS[PAYER_PLANS.ALKOOT]`
- Lines: ~105-133

**3. AI Instructions:**
- File: `src/services/extractionApi.ts`
- Function: `extractFieldsFromMarkdown()` prompt
- Lines: ~238-243

---

## Affected Fields (ALKOOT)

Fields with `&` that now have automatic variations:

1. ✅ **Vaccination & Immunization**
   - Auto-generates: "Vaccination and Immunization"
   - Plus manual synonyms: variations with plural, slash separator

2. ✅ **Psychiatric treatment & Psychotherapy**
   - Auto-generates: "Psychiatric treatment and Psychotherapy"
   - Plus manual synonyms: plural variations, short form

3. ✅ **Pregnancy & Childbirth**
   - Auto-generates: "Pregnancy and Childbirth"
   - Plus manual synonyms: spacing variations, "Maternity"

---

## Advantages

### 1. Zero Configuration Required
- Works automatically for any field with `&` or `and`
- No need to manually add variations for new fields

### 2. Comprehensive Coverage
- Three layers ensure variations are caught
- Handles edge cases like spacing differences

### 3. Maintains Consistency
- Output always uses the original field name
- No confusion about which variation was matched

### 4. Future-Proof
- New fields with `&` automatically supported
- Works across all payer plans

---

## Edge Cases Handled

### Case 1: Multiple separators in one field
```typescript
"A & B and C"
// Generates: "A and B and C"
```

### Case 2: Extra spaces
```typescript
"Vaccination  &  Immunization"  // Multiple spaces
// Normalizes to: "Vaccination and Immunization"
```

### Case 3: Case sensitivity
```typescript
// Handled by AI's fuzzy matching
"vaccination and immunization"  // lowercase
"Vaccination And Immunization"  // Title Case
// Both match: "Vaccination & Immunization"
```

---

## Debugging

To see the generated synonyms, check console output:

```javascript
console.log('Field synonyms:');
// Output:
// - Vaccination & Immunization: also look for: 
//   Vaccination & Immunizations, 
//   Vaccination and Immunization,
//   Vaccination and Immunizations,
//   Vaccination/Immunization
```

---

## Summary

✅ **Automatic handling** of `&` ↔ `and` variations  
✅ **Manual synonyms** for additional variations  
✅ **AI instructions** for flexible matching  
✅ **Consistent output** with original field names  
✅ **Zero configuration** for new fields  

The extraction will now successfully find fields regardless of whether they use `&` or `and` in the PDF! 🎉

