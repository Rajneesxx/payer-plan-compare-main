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

// Field mapping suggestions to help users find similar field names
export const FIELD_SUGGESTIONS = {
  [PAYER_PLANS.QLM]: {
    "Insured": [
      "Policyholder",
      "Beneficiary name"
    ],
    "Policy No": [
      "Policy number",
      "Contract number",
      "Policy reference"
    ],
    "Period of Insurance": [
      "Coverage period",
      "Insurance period",
      "Policy term",
      "Coverage dates"
    ],
    "Plan": [
      "Plan type",
      "Coverage plan",
      "Plan name",
      "Insurance plan"
    ],
    "For Eligible Medical Expenses at Al Ahli Hospital": [
      "Al Ahli Hospital coverage",
      "Hospital-specific benefits",
      "Al Ahli medical expenses",
      "Hospital coverage percentage",
      "Al Ahli benefits"
    ],
    "Inpatient Deductible": [
      "Hospital deductible",
      "Inpatient excess",
      "Hospital admission deductible",
      "Inpatient excess amount",
      "Hospital admission excess"
    ],
    "Deductible per each outpatient consultation": [
      "Outpatient deductible",
      "Consultation excess",
      "Outpatient excess",
      "Per visit deductible",
      "Consultation excess amount"
    ],
    "Vaccination of children": [
      "Child vaccination",
      "Vaccination coverage",
      "Immunization for children",
      "Child immunization"
    ],
    "Psychiatric Treatment": [
      "Mental health coverage",
      "Psychiatric care",
      "Mental health treatment",
      "Psychiatry coverage"
    ],
    "Dental Copayment": [
      "Dental co-pay",
      "Dental excess",
      "Dental coverage",
      "Dental benefits"
    ],
    "Maternity Copayment": [
      "Maternity co-pay",
      "Pregnancy coverage",
      "Maternity benefits",
      "Childbirth coverage"
    ],
    "Optical Copayment": [
      "Optical co-pay",
      "Vision coverage",
      "Eye care benefits",
      "Optical benefits"
    ]
  },
  [PAYER_PLANS.ALKOOT]: {
    "Policy Number": [
      "Policy ID",
      "Contract number",
      "Policy reference",
      "Policy no"
    ],
    "Category": [
      "Plan category",
      "Coverage category",
      "Member category",
      "Plan type"
    ],
    "Effective Date": [
      "Start date",
      "Coverage start",
      "Policy start date",
      "Effective from"
    ],
    "Expiry Date": [
      "End date",
      "Coverage end",
      "Policy end date",
      "Expires on"
    ],
    "Provider-specific co-insurance at Al Ahli Hospital": [
    ],
    "Co-insurance on all inpatient treatment": [
      "Inpatient co-insurance",
      "Inpatient treatment co-insurance",
      "Inpatient coverage",
      "Co-insurance for inpatient",
      "Inpatient treatment coverage",
      "Co-insurance - Inpatient"
    ],
    "Deductible on consultation": [
      "Deductible on consultations",
      "Consultation deductible",
      "Outpatient deductible",
    ],
    "Vaccination & Immunization": [
      "Vaccination coverage",
      "Immunization coverage"
    ],
    "Psychiatric treatment & Psychotherapy": [
      "Mental health coverage",
      "Psychiatric care",
      "Psychotherapy coverage",
      "Mental health treatment"
    ],
    "Pregnancy & Childbirth": [
      "Maternity coverage",
      "Pregnancy benefits",
    ],
    "Dental Benefit": [
      "Dental coverage",
      "Dental benefits",
      "Dental care",
      "Oral health coverage"
    ],
    "Optical Benefit": [
      "Vision coverage",
      "Vision benefits"
    ]
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
