export const PAYER_PLANS = {
  QLM: 'QLM',
  ALKOOT: 'ALKOOT',
  CUSTOM: 'CUSTOM'
} as const;

export type PayerPlan = keyof typeof PAYER_PLANS;

// Enhanced field definitions with details
export interface FieldDetail {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'percentage' | 'currency';
  description: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  examples?: string[];
}

export const QLM_FIELD_DETAILS: Record<string, FieldDetail> = {
  "Insured": {
    name: "Insured",
    required: true,
    type: "string",
    description: "Name of the insured person/policyholder",
    validation: {
      minLength: 2,
      maxLength: 100
    },
    examples: ["John Doe", "Sarah Al-Ahmad"]
  },
  "Policy No": {
    name: "Policy No",
    required: true,
    type: "string",
    description: "Unique policy identification number",
    validation: {
      pattern: "^[A-Z0-9-]+$",
      minLength: 5,
      maxLength: 20
    },
    examples: ["QLM-2024-001", "POL123456"]
  },
  "Period of Insurance": {
    name: "Period of Insurance",
    required: true,
    type: "string",
    description: "Coverage period dates (start to end)",
    examples: ["01/01/2024 - 31/12/2024", "Jan 2024 to Dec 2024"]
  },
  "Plan": {
    name: "Plan",
    required: true,
    type: "string",
    description: "Insurance plan type or category",
    examples: ["Premium", "Standard", "Basic", "Family Plan"]
  },
  "For Eligible Medical Expenses at Al Ahli Hospital": {
    name: "For Eligible Medical Expenses at Al Ahli Hospital",
    required: false,
    type: "percentage",
    description: "Coverage percentage for medical expenses at Al Ahli Hospital",
    validation: {
      min: 0,
      max: 100
    },
    examples: ["100%", "80%", "90%"]
  },
  "Inpatient Deductible": {
    name: "Inpatient Deductible",
    required: false,
    type: "currency",
    description: "Amount patient pays before inpatient coverage begins",
    validation: {
      min: 0
    },
    examples: ["QAR 500", "500", "0"]
  },
  "Deductible per each outpatient consultation": {
    name: "Deductible per each outpatient consultation",
    required: false,
    type: "currency",
    description: "Fixed amount paid per outpatient visit",
    validation: {
      min: 0
    },
    examples: ["QAR 50", "50", "25"]
  },
  "Vaccination of children": {
    name: "Vaccination of children",
    required: false,
    type: "string",
    description: "Coverage details for child vaccination services",
    examples: ["Covered", "Not Covered", "80% Coverage", "Full Coverage"]
  },
  "Psychiatric Treatment": {
    name: "Psychiatric Treatment",
    required: false,
    type: "string",
    description: "Mental health and psychiatric care coverage",
    examples: ["Covered", "Limited Coverage", "Not Covered", "Up to QAR 5000"]
  },
  "Dental Copayment": {
    name: "Dental Copayment",
    required: false,
    type: "currency",
    description: "Patient contribution for dental services",
    validation: {
      min: 0
    },
    examples: ["QAR 100", "20%", "50"]
  },
  "Maternity Copayment": {
    name: "Maternity Copayment",
    required: false,
    type: "currency",
    description: "Patient contribution for maternity services",
    validation: {
      min: 0
    },
    examples: ["QAR 1000", "10%", "500"]
  },
  "Optical Copayment": {
    name: "Optical Copayment",
    required: false,
    type: "currency",
    description: "Patient contribution for optical/vision services",
    validation: {
      min: 0
    },
    examples: ["QAR 200", "30%", "150"]
  }
};

export const ALKOOT_FIELD_DETAILS: Record<string, FieldDetail> = {
  "Policy Number": {
    name: "Policy Number",
    required: true,
    type: "string",
    description: "Unique policy identification number",
    validation: {
      pattern: "^[A-Z0-9-]+$",
      minLength: 5,
      maxLength: 20
    },
    examples: ["ALK-2024-001", "ALKOOT123456"]
  },
  "Category": {
    name: "Category",
    required: true,
    type: "string",
    description: "Member or plan category classification",
    examples: ["Employee", "Dependent", "Senior", "Executive"]
  },
  "Effective Date": {
    name: "Effective Date",
    required: true,
    type: "date",
    description: "Date when coverage becomes effective",
    examples: ["01/01/2024", "2024-01-01", "Jan 1, 2024"]
  },
  "Expiry Date": {
    name: "Expiry Date",
    required: true,
    type: "date",
    description: "Date when coverage expires",
    examples: ["31/12/2024", "2024-12-31", "Dec 31, 2024"]
  },
  "Provider-specific co-insurance at Al Ahli Hospital": {
    name: "Provider-specific co-insurance at Al Ahli Hospital",
    required: false,
    type: "percentage",
    description: "Co-insurance percentage specifically for Al Ahli Hospital services",
    validation: {
      min: 0,
      max: 100
    },
    examples: ["20%", "10%", "0%"]
  },
  "Co-insurance on all inpatient treatment": {
    name: "Co-insurance on all inpatient treatment",
    required: false,
    type: "percentage",
    description: "Patient's share of costs for all inpatient treatments",
    validation: {
      min: 0,
      max: 100
    },
    examples: ["20%", "15%", "10%"]
  },
  "Deductible on consultation": {
    name: "Deductible on consultation",
    required: false,
    type: "currency",
    description: "Fixed amount paid per consultation visit",
    validation: {
      min: 0
    },
    examples: ["QAR 75", "75", "50"]
  },
  "Vaccination & Immunization": {
    name: "Vaccination & Immunization",
    required: false,
    type: "string",
    description: "Coverage for vaccination and immunization services",
    examples: ["Covered", "Not Covered", "Partial Coverage", "Full Coverage"]
  },
  "Psychiatric treatment & Psychotherapy": {
    name: "Psychiatric treatment & Psychotherapy",
    required: false,
    type: "string",
    description: "Mental health, psychiatric care and psychotherapy coverage",
    examples: ["Covered", "Limited", "Not Covered", "Up to QAR 10000 annually"]
  },
  "Pregnancy & Childbirth": {
    name: "Pregnancy & Childbirth",
    required: false,
    type: "string",
    description: "Maternity, pregnancy and childbirth coverage",
    examples: ["Covered", "Partial Coverage", "Not Covered", "After waiting period"]
  },
  "Dental Benefit": {
    name: "Dental Benefit",
    required: false,
    type: "string",
    description: "Dental and oral health care coverage",
    examples: ["Basic Coverage", "Comprehensive", "Emergency Only", "Not Covered"]
  },
  "Optical Benefit": {
    name: "Optical Benefit",
    required: false,
    type: "string",
    description: "Vision care and optical services coverage",
    examples: ["Annual Allowance", "Partial Coverage", "Not Covered", "QAR 500 annually"]
  }
};

// Maintain backward compatibility - extract just the field names
export const QLM_FIELDS = Object.keys(QLM_FIELD_DETAILS);
export const ALKOOT_FIELDS = Object.keys(ALKOOT_FIELD_DETAILS);

// Enhanced field mappings with details
export const FIELD_MAPPINGS_WITH_DETAILS = {
  [PAYER_PLANS.QLM]: QLM_FIELD_DETAILS,
  [PAYER_PLANS.ALKOOT]: ALKOOT_FIELD_DETAILS
};

// Keep original simple mappings for backward compatibility
export const FIELD_MAPPINGS = {
  [PAYER_PLANS.QLM]: QLM_FIELDS,
  [PAYER_PLANS.ALKOOT]: ALKOOT_FIELDS
};

// Your existing field suggestions remain the same
export const FIELD_SUGGESTIONS = {
  [PAYER_PLANS.QLM]: {
    "Insured": [
      "Policyholder",
      "Member name",
      "Insured person",
      "Beneficiary name"
    ],
    "Policy No": [
      "Policy number",
      "Policy ID",
      "Contract number",
      "Policy reference"
    ],
    // ... rest of your existing suggestions
  },
  [PAYER_PLANS.ALKOOT]: {
    // ... your existing ALKOOT suggestions
  }
};

// Updated interfaces
export interface ExtractedData {
  [key: string]: string | null;
}

export interface ComparisonResult {
  field: string;
  file1Value: string | null;
  file2Value: string | null;
  status: 'same' | 'different' | 'missing';
}

// New utility functions to work with enhanced fields
export function getFieldDetail(plan: PayerPlan, fieldName: string): FieldDetail | undefined {
  return FIELD_MAPPINGS_WITH_DETAILS[plan]?.[fieldName];
}

export function getRequiredFields(plan: PayerPlan): string[] {
  const fields = FIELD_MAPPINGS_WITH_DETAILS[plan];
  return Object.values(fields).filter(field => field.required).map(field => field.name);
}

export function getOptionalFields(plan: PayerPlan): string[] {
  const fields = FIELD_MAPPINGS_WITH_DETAILS[plan];
  return Object.values(fields).filter(field => !field.required).map(field => field.name);
}

export function validateFieldValue(plan: PayerPlan, fieldName: string, value: string): boolean {
  const fieldDetail = getFieldDetail(plan, fieldName);
  if (!fieldDetail || !fieldDetail.validation) return true;
  
  const validation = fieldDetail.validation;
  
  // Pattern validation
  if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
    return false;
  }
  
  // String length validation
  if (validation.minLength && value.length < validation.minLength) {
    return false;
  }
  
  if (validation.maxLength && value.length > validation.maxLength) {
    return false;
  }
  
  // Numeric validation
  if (fieldDetail.type === 'number' || fieldDetail.type === 'currency' || fieldDetail.type === 'percentage') {
    const numValue = parseFloat(value.replace(/[^\d.]/g, ''));
    if (isNaN(numValue)) return false;
    
    if (validation.min !== undefined && numValue < validation.min) {
      return false;
    }
    
    if (validation.max !== undefined && numValue > validation.max) {
      return false;
    }
  }
  
  return true;
}
