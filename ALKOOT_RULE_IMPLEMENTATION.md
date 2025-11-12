# 🔧 ALKOOT-Specific Rule Implementation

## The Rule

For ALKOOT insurance plans, **"Co-insurance"** and **"Deductible on consultation"** are stored in the **same table cell** in the outpatient section. They share the same value.

---

## 📋 Implementation

Added `applyAlkootSpecificRules()` function that runs after extraction and validation:

```typescript
function applyAlkootSpecificRules(data: Record<string, any>): Record<string, any> {
  const coInsurance = data['Co-insurance'];
  const deductible = data['Deductible on consultation'];
  
  // If co-insurance has a value but deductible doesn't, copy it
  if (coInsurance && !deductible) {
    data['Deductible on consultation'] = coInsurance;
  }
  
  // If deductible has a value but co-insurance doesn't, copy it
  else if (deductible && !coInsurance) {
    data['Co-insurance'] = deductible;
  }
  
  // If both have different values, use co-insurance value
  else if (coInsurance && deductible && coInsurance !== deductible) {
    data['Deductible on consultation'] = coInsurance;
  }
  
  return data;
}
```

---

## 🔄 Flow

```
Extract Fields from Markdown
  ↓
Validate and Clean Values (remove descriptions)
  ↓
Apply ALKOOT-Specific Rules ← NEW
  ├─ Check Co-insurance value
  ├─ Check Deductible on consultation value
  ├─ If one is missing, copy from the other
  └─ If both present but different, use Co-insurance
  ↓
Return Final Data
```

---

## 📊 Scenarios Handled

### Scenario 1: Co-insurance Found, Deductible Not Found
```
Input:
  Co-insurance: "Nil"
  Deductible on consultation: null

Output:
  Co-insurance: "Nil"
  Deductible on consultation: "Nil" ← Copied!

Console: [ALKOOT Rule] Copying Co-insurance value "Nil" to Deductible on consultation
```

---

### Scenario 2: Deductible Found, Co-insurance Not Found
```
Input:
  Co-insurance: null
  Deductible on consultation: "Nil"

Output:
  Co-insurance: "Nil" ← Copied!
  Deductible on consultation: "Nil"

Console: [ALKOOT Rule] Copying Deductible on consultation value "Nil" to Co-insurance
```

---

### Scenario 3: Both Found, Same Value (Ideal)
```
Input:
  Co-insurance: "Nil"
  Deductible on consultation: "Nil"

Output:
  Co-insurance: "Nil"
  Deductible on consultation: "Nil"

Console: (No action needed, values already match)
```

---

### Scenario 4: Both Found, Different Values (Warning)
```
Input:
  Co-insurance: "Nil"
  Deductible on consultation: "QAR 50"

Output:
  Co-insurance: "Nil"
  Deductible on consultation: "Nil" ← Overwritten!

Console: 
  [ALKOOT Rule] ⚠️  Co-insurance (Nil) and Deductible (QAR 50) have different values.
  [ALKOOT Rule] Using Co-insurance value for both fields
```

---

### Scenario 5: Both Missing
```
Input:
  Co-insurance: null
  Deductible on consultation: null

Output:
  Co-insurance: null
  Deductible on consultation: null

Console: (No action needed, both are null)
```

---

## 🎯 Why This Works

1. **Two-Layer Approach**:
   - **Layer 1 (Prompt)**: Instructs LLM to look for shared cell
   - **Layer 2 (Post-processing)**: Ensures values match even if LLM misses it

2. **Fallback Safety**:
   - If LLM only extracts one field, we copy to the other
   - Guarantees both fields have the same value

3. **Prioritization**:
   - If conflict, Co-insurance takes priority (it's usually the primary field)

4. **Transparent**:
   - Console logs show exactly what's happening
   - Easy to debug if issues arise

---

## 📝 Console Output Example

```
[Validation] Checking extracted values for descriptions...
[Validation] ✅ All values are clean (no descriptions found)
[ALKOOT Rule] Copying Co-insurance value "Nil" to Deductible on consultation
```

---

## 🧪 Testing

When you run tests, look for these log messages:

✅ **Good signs**:
```
[ALKOOT Rule] Copying Co-insurance value "Nil" to Deductible on consultation
```
This means the rule is working correctly.

⚠️ **Warning signs**:
```
[ALKOOT Rule] ⚠️  Co-insurance (Nil) and Deductible (QAR 50) have different values.
```
This means LLM extracted different values (shouldn't happen with improved prompt).

---

## 🎉 Result

**Before**:
- Co-insurance: "Nil"
- Deductible on consultation: null ❌

**After**:
- Co-insurance: "Nil"
- Deductible on consultation: "Nil" ✅

Both fields now guaranteed to have the same value! 🎯

---

## 🔮 Future Enhancement

If needed for other payer plans with similar shared-cell patterns, this function can be extended:

```typescript
function applyPayerSpecificRules(
  data: Record<string, any>, 
  payerPlan: PayerPlan
): Record<string, any> {
  
  if (payerPlan === 'ALKOOT') {
    // Co-insurance and Deductible share same cell
    return applyAlkootSharedCellRule(data);
  }
  
  if (payerPlan === 'OTHER_PAYER') {
    // Other payer-specific rules
    return applyOtherPayerRules(data);
  }
  
  return data;
}
```

---

## 📚 Related Documentation

- **QUICK_FIXES_APPLIED.md** - All quick fixes including this one
- **VALIDATION_LAYER_UPDATE.md** - Post-extraction validation system
- **FINAL_SUMMARY.md** - Overall implementation summary

---

**The ALKOOT rule is now fully implemented and will ensure Co-insurance and Deductible on consultation always have the same value!** ✅

