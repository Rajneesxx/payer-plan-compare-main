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
  "Co-insurance",
  "Vaccinations & immunizations",
  "Psychiatric treatment and Psychotherapy",
  "Pregnancy and childbirth", 
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
    "Policy Number": [
      "Policy No",
      "Policy ID",
      "Policy #",
      "Contract Number",
      "Certificate Number"
    ],
    "Category": [
      "Plan",
      "Plan Name",
      "Policy Type",
      "Plan Type",
      "Category Name"
    ],
    "Effective Date": [
      "Start Date",
      "Commencement Date",
      "Inception Date",
      "From Date"
    ],
    "Expiry Date": [
      "End Date",
      "Termination Date",
      "To Date",
      "Expiration Date"
    ],
    "Provider-specific co-insurance at Al Ahli Hospital": [
      "Al-Ahli Hospital",
      "Al Ahli",
      "Al-Ahli",
      "Provider-specific co-insurance at Al Ahli Hospital",
      "Provider Specific Co-insurance",
      "Additional co-insurance at Al Ahli",
      "Additional deductible at Al Ahli",
      "Al Ahli Hospital co-insurance",
      "Co-insurance Al Ahli Hospital",
      "Provider-specific co-insurance/deductible"
    ],
    "Co-insurance on all inpatient treatment": [
      "Co-insurance on all inpatient treatments",
      "In-patient co-insurance",
      "Inpatient co-insurance",
      "IPD co-insurance",
      "In-patient co-pay"
    ],
    "Deductible on consultation": [
      "Deductible on consultations",
      "Consultation deductible",
      "OPD deductible",
      "Outpatient deductible",
      "Out-patient deductible",
      "Deductible per consultation"
    ],
    "Co-insurance": [
      "Co-insurance",
      "Out-patient co-insurance",
      "Outpatient co-insurance",
      "OPD co-insurance",
      "General co-insurance"
    ],
    "Vaccinations & immunizations": [
      "Vaccination & Immunization",
      "Vaccination & Immunizations",
      "Vaccination and Immunization",
      "Vaccination and Immunizations",
      "Vaccination/Immunization",
      "Vaccinations & Immunizations",
      "Vaccinations and Immunizations",
      "Immunizations",
      "Vaccinations",
      "Immunization",
      "Vaccination"
    ],
    "Psychiatric treatment and Psychotherapy": [
      "Psychiatric treatment & Psychotherapy",
      "Psychiatric treatment & Psychotherapies",
      "Psychiatric treatment and Psychotherapies",
      "Psychiatric Treatment",
      "Psychotherapy",
      "Mental Health",
      "Mental health treatment",
      "Psychiatric care",
      "Psychological treatment",
      "Psychiatry",
      "Psychiatric services",
      "Mental health coverage",
      "Psychiatric services",
      "Mental healthcare"
    ],
    "Pregnancy and childbirth": [
      "Pregnancy & Childbirth",
      "Pregnancy and Childbirth",
      "Pregnancy & Childbirths",
      "Pregnancy and Child birth",
      "Pregnancy and childbirth(in accordance with Hamad Protocol/s)",
      "Maternity",
      "Maternity coverage",
      "Childbirth",
      "Pregnancy"
    ],
    "Dental Benefit": [
      "Dental Coverage",
      "Dental Benefits",
      "Dental",
      "Dental care"
    ],
    "Optical Benefit": [
      "Optical Coverage",
      "Vision Coverage",
      "Optical Benefits",
      "Vision Benefits",
      "Optical",
      "Vision care",
      "Eye care"
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

