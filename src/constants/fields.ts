export const PAYER_PLANS = {
  QLM: 'QLM',
  ALKOOT: 'ALKOOT',
  CUSTOM: 'CUSTOM'
} as const;

export type PayerPlan = keyof typeof PAYER_PLANS;

export const QLM_FIELDS = [
  "Insured", 
  "Policy No",
  "Period of Insurance", 
  "Plan", 
  "For Eligible Medical Expenses at Al Ahli Hospital",
  "Inpatient Deductible", 
  "Deductible per each outpatient consultation",
  "Vaccination of children", 
  "Psychiatric Treatment", 
  "Dental Copayment",
  "Maternity Copayment", 
  "Optical Copayment"
];

export const ALKOOT_FIELDS = [
  "Policy Number", 
  "Category", 
  "Effective Date",
  "Expiry Date", 
  "Provider-specific co-insurance at Al Ahli Hospital",
  "Co-insurance on all inpatient treatment", 
  "Deductible on consultation",
  "Vaccination & Immunization",
  "Psychiatric treatment & Psychotherapy",
  "Pregnancy & Childbirth", 
  "Dental Benefit", 
  "Optical Benefit"
];

export const FIELD_SUGGESTIONS = {
  [PAYER_PLANS.QLM]: {
    "Insured": [
    
    ],
    "Policy No": [
      "Policy number",
      "Policy ID",
      "Contract number",
    ],
    "Period of Insurance": [
      "Coverage period",
      "Insurance period",

    ],
    "Plan": [
      "Plan type",
      "Plan name",
      "Insurance plan",
      "PLANS"
    ],
    "For Eligible Medical Expenses at Al Ahli Hospital": [

    ],
    "Inpatient Deductible": [
    ],
    "Deductible per each outpatient consultation": [
      "Outpatient deductible",
    ],
    "Vaccination of children": [
      "Child vaccination",
      "Vaccination coverage",
    ],
    "Psychiatric Treatment": [
      "Psychiatry coverage"
    ],
    "Dental Copayment": [
      "Dental benefits"
    ],
    "Maternity Copayment": [
      "Maternity benefits",
      "Childbirth coverage"
    ],
    "Optical Copayment": [
      "Optical benefits"
    ]
  },
  [PAYER_PLANS.ALKOOT]: {
    "Policy Number": [],
    "Category": [],
    "Effective Date": [],
    "Expiry Date": [],
    "Provider-specific co-insurance at Al Ahli Hospital": [],
    "Co-insurance on all inpatient treatment": [
      "Co-insurance on all inpatient treatments",
      "In-patient co-insurance"
    ],
    "Deductible on consultation": [
      "Deductible on consultations",
      "Consultation deductible"
    ],
    "Vaccination & Immunization": [
      "Vaccination & Immunizations"
    ],
    "Psychiatric treatment & Psychotherapy": [
      "Psychiatric treatment & Psychotherapies"
    ],
    "Pregnancy & Childbirth": [
      "Pregnancy & Childbirths"
    ],
    "Dental Benefit": [],
    "Optical Benefit": []
  }
};

export const FIELD_MAPPINGS = {
  [PAYER_PLANS.QLM]: QLM_FIELDS,
  [PAYER_PLANS.ALKOOT]: ALKOOT_FIELDS
};

export interface ExtractedData {
  [key: string]: string | null;
}

export interface ComparisonResult {
  field: string;
  file1Value: string | null;
  file2Value: string | null;
  status: 'same' | 'different' | 'missing';
}
