// OpenAI extraction service using Responses API with attachments + file_search
// Minimal public surface retained: extractDataApi and compareDataApi
import { FIELD_MAPPINGS, PAYER_PLANS, type PayerPlan, type ExtractedData, type ComparisonResult } from "@/constants/fields";
import { FIELD_SUGGESTIONS } from "@/constants/fields";
import { logExtraction } from "@/utils/logging";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Track extraction event in GA4
function trackExtractionEvent(
  eventName: string,
  params: Record<string, any>
) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, {
      ...params,
      event_category: 'LLM Extraction',
      non_interaction: false,
    });
  }
}

const OPENAI_BASE = "https://api.openai.com/v1";

function assertKey(apiKey?: string) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
}
function buildPrompt(
  fields: string[],
  fieldHints?: Record<string, string[]>,
  payerPlan?: PayerPlan
): string {
  const safeFields = Array.isArray(fields) ? fields : [];
  const fieldList = safeFields.map((f) => `- ${f}`).join("\n");

  // For ALKOOT, disable fuzzy hints to avoid confusion
  let hintsSection = "";
  if (fieldHints && typeof fieldHints === "object" && safeFields.length && payerPlan !== PAYER_PLANS.ALKOOT) {
    hintsSection =
      "\nFIELD SYNONYMS (search only; output keys must match exactly):\n" +
      safeFields
        .map((f) => {
          const hints = fieldHints[f];
          if (!hints || !Array.isArray(hints) || hints.length === 0) return "";
          return `- ${f}: ${hints.join(", ")}`;
        })
        .filter(Boolean)
        .join("\n") +
      "\n";
  }

  let specificInstructions = "";
  switch (payerPlan) {
    case PAYER_PLANS.QLM:
      specificInstructions =
        "\n=== QLM SPECIFIC EXTRACTION RULES ===\n" +
        "RULE 1 - EXACT FIELD MAPPING:\n" +
        "- Field: 'Vaccination of children'\n" +
        "  If table shows 'Covered': Return EXACTLY 'Covered'\n" +
        "  If table shows 'QAR X,XXX': Return the EXACT amount with formatting\n" +
        "  If not found: Return null\n\n" +
        "- Field: 'Period of Insurance'\n" +
        "  Format as 'From [date] To [date]'\n" +
        "  Example: 'From 01/01/2025 To 31/12/2025'\n\n" +
        "- Field: 'Psychiatric Treatment'\n" +
        "  If ANY mention of coverage: Return EXACTLY 'Covered'\n" +
        "  If explicitly not covered: Return 'Not covered'\n" +
        "  If not found: Return null\n\n" +
        "QLM TABLE STRUCTURE:\n" +
        "- QLM tables have field names in the LEFT column\n" +
        "- Extract values from the RIGHT column in the same row\n" +
        "- Field names might appear in headers or section titles\n" +
        "- Look for EXACT field name matches before attempting loose matches\n\n" +
        "CRITICAL EXAMPLES:\n" +
        "- 'Insured': Extract the name of the insured entity (e.g., 'ABC Company Ltd.')\n" +
        "- 'Policy No': Extract the policy number exactly as shown (e.g., 'P123456')\n" +
        "- 'Plan': Extract the plan type/name (e.g., 'EXECUTIVE', 'STANDARD', etc.)\n" +
        "- 'For Eligible Medical Expenses at Al Ahli Hospital': Extract percentage (e.g., '100% covered')\n" +
        "- 'Dental Copayment': Extract percentage or amount (e.g., '20%' or 'QAR 50')\n";
      break;
    case PAYER_PLANS.ALKOOT:
      specificInstructions =
        "\n=== ALKOOT STRICT EXTRACTION MODE ===\n" +
        "RULE 1 - EXACT FIELD NAME MATCHING (PRIORITY ORDER):\n" +
        "1. First, search for the EXACT field name in tables and headers\n" +
        "2. If not found, search for EXACT field name in text/paragraphs\n" +
        "3. If still not found, try these specific variations:\n" +
        "   a. Try with/without spaces (e.g., 'Co-insurance' vs 'Coinsurance')\n" +
        "   b. Try singular/plural forms (e.g., 'Benefit' vs 'Benefits')\n" +
        "   c. Try with/without hyphen (e.g., 'Co-insurance' vs 'Coinsurance')\n" +
        "4. If still not found, return null\n\n" +
        "RULE 2 - TABLE EXTRACTION:\n" +
        "- If field is in table column 1, extract value from column 2 in same row\n" +
        "- If field is in table header, extract corresponding cell value below\n" +
        "- Extract COMPLETE cell content, including footnotes/conditions\n\n" +
        "RULE 3 - VALUE FORMATTING:\n" +
        "- Preserve ALL original formatting exactly as shown\n" +
        "- Keep currency symbols, QAR, percentages, decimals, commas\n" +
        "- Include full coverage conditions and limitations\n" +
        "- If multiple paragraphs describe a benefit, combine them\n" +
        "- Remove ONLY citation markers like [[4:16†source]]\n\n" +
        "RULE 4 - CRITICAL FIELD-SPECIFIC RULES:\n" +
        "- 'Provider-specific co-insurance at Al Ahli Hospital':\n" +
        "   CRITICAL: This field is ONLY for Al Ahli Hospital specifically\n" +
        "   You MUST find information that EXPLICITLY mentions 'Al Ahli Hospital' by name\n" +
        "   DO NOT use general co-insurance values for this field\n" +
        "   DO NOT infer or assume any value from other co-insurance fields\n" +
        "   Return 'Not applicable' if Al Ahli Hospital is not specifically mentioned\n" +
        "   Only extract a percentage if it is EXPLICITLY tied to Al Ahli Hospital\n" +
        "   Example valid content: '15% co-insurance at Al Ahli Hospital'\n" +
        "   Example invalid content: General co-insurance percentages not specific to Al Ahli\n\n" +
        "- 'Co-insurance on all inpatient treatment':\n" +
        "   Look SPECIFICALLY for inpatient co-insurance, not general or outpatient co-insurance\n" +
        "   MUST find text explicitly mentioning inpatient/in-patient/hospital stay\n" +
        "   Examples: '20% co-insurance applies to inpatient services', 'In-patient co-pay: 15%'\n" +
        "   Do not use general co-insurance values unless explicitly linked to inpatient care\n\n" +
        "- 'Co-insurance':\n" +
        "   This is for general/standard co-insurance that applies to most services\n" +
        "   Usually applies to outpatient services if not specified otherwise\n" +
        "   Only extract this AFTER checking the more specific co-insurance fields\n\n" +
        "- 'Optical Benefit':\n" +
        "   Include full QAR amount and conditions (e.g., 'QAR 3,000 per policy year')\n\n" +
        "- 'Vaccination & Immunization':\n" +
        "   Also check for 'Vaccinations & Immunizations' (plural)\n\n" +
        "RULE 5 - HANDLING SPECIAL CASES:\n" +
        "- If field value says 'Not covered' or 'Nil': Return that exact text\n" +
        "- If field value says 'Covered': Return 'Covered' or the full coverage details\n" +
        "- For dates, maintain original format (e.g., '01-Jan-2023' or '01/01/2023')\n" +
        "- For benefit limits, include full amount and frequency (e.g., 'QAR 5,000 per person per year')\n" +
        "- If provider-specific information is not found, DO NOT use general values as substitutes";
      break;
    default:
      break;
  }

  return (
    "You are a medical insurance policy extractor. Extract field values from insurance PDFs with MAXIMUM ACCURACY and PRECISION.\n" +
    "\n=== CORE EXTRACTION METHODOLOGY ===\n" +
    "1. Analyze the entire PDF THOROUGHLY including all tables, headers, footnotes and sections\n" +
    "2. For each requested field, follow this process IN ORDER:\n" +
    "   a. Search for the EXACT field name in tables (prioritize left columns and headers)\n" +
    "   b. If found in table, extract the COMPLETE value from the adjacent cell\n" +
    "   c. If not in tables, search for the EXACT field name in text sections\n" +
    "   d. If found in text, extract the value immediately following the field name\n" +
    "   e. If still not found, try ONLY these specific variations:\n" +
    "      - Singular/plural forms (add/remove 's' at end)\n" +
    "      - With/without hyphen (for terms like co-insurance/coinsurance)\n" +
    "      - With/without spaces (for compound terms)\n" +
    "   f. If still not found after trying variations, return NULL\n" +
    "\n=== CRITICAL EXTRACTION PRINCIPLES ===\n" +
    "1. NEVER hallucinate values - only extract what's explicitly in the document\n" +
    "2. NEVER infer values from other sections or fields\n" +
    "3. NEVER combine information from multiple unrelated sections\n" +
    "4. ALWAYS extract the COMPLETE value including all conditions, limitations, and exceptions\n" +
    "5. ALWAYS preserve original formatting (QAR, %, commas, dates)\n" +
    "6. ALWAYS return NULL if the field is genuinely not present\n" +
    "7. REMOVE ONLY citation markers like [[4:16†source]], [1], {2}, etc.\n" +
    "\n=== DOCUMENT ANALYSIS APPROACH ===\n" +
    "1. First scan ALL tables completely - most fields are in tables\n" +
    "2. Check table headers AND first columns for field names\n" +
    "3. Check section headings that might match field names\n" +
    "4. For narrative text, look for the exact field name followed by a description\n" +
    "5. Pay special attention to benefit schedules and coverage summary tables\n" +
    "6. Look for footnotes that might contain important conditions\n" +
    "\n=== VALUE EXTRACTION RULES ===\n" +
    "1. Extract COMPLETE value - include conditions, percentages, currency amounts\n" +
    "2. Include limitations, maximums, frequencies (e.g., 'per policy year')\n" +
    "3. Remove citation numbers and reference markers ONLY\n" +
    "4. For multi-line values, combine into one continuous text\n" +
    "5. For 'covered' or 'not covered' fields, include those exact terms\n" +
    "6. Preserve exact numerical formatting (1,000 not 1000)\n" +
    "\n=== OUTPUT FORMAT REQUIREMENTS ===\n" +
    "1. Return ONLY valid JSON with exact field names as keys\n" +
    "2. Each value must be either a string or null\n" +
    "3. No explanations, no markdown, no additional text\n" +
    "4. NULL for fields not found (not empty string, not 'not found')\n" +
    specificInstructions +
    "\n\nFIELDS TO EXTRACT (exact keys required):\n" +
    `${fieldList}\n\n` +
    hintsSection +
    "DO NOT FABRICATE VALUES. If you cannot find a field, return null.\n" +
    "Review your output carefully to ensure accuracy before submitting.\n" +
    "Return ONLY a JSON object, no explanations or other text."
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadFileToOpenAI(file: File, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", file, file.name);

  const res = await fetch(`${OPENAI_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI file upload failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}

async function callChatCompletion(params: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<any> {
  const { apiKey, prompt, model = "gpt-4o" } = params;

  const body = {
    model,
    messages: [
      {
        role: "system",
        content: "You are a medical insurance policy data extraction expert with PERFECT ACCURACY. Your sole purpose is to extract data from insurance PDFs with 100% precision. You analyze documents in detail and extract ONLY what is explicitly present. Never infer or hallucinate values that aren't clearly stated. Your output must be clean, consistent, and exactly match the document's content. Return NULL for any field you cannot find with certainty."
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,  // Keep at 0 for maximum determinism
    top_p: 0.1,     // Low top_p for focused output
    max_tokens: 4000,
    frequency_penalty: 0,  // No penalty for repeating tokens
    presence_penalty: 0,   // No penalty for new topics
  };

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`OpenAI chat completion error: ${res.status} ${errTxt}`);
  }

  const json = await res.json();
  return json;
}

async function createAssistantAndRun(params: {
  apiKey: string;
  fileId: string;
  prompt: string;
  model?: string;
}): Promise<any> {
  const { apiKey, fileId, prompt, model = "gpt-4o" } = params;

  // Create assistant with file search capability and enhanced instructions
  const assistantRes = await fetch(`${OPENAI_BASE}/assistants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      model,
      name: "Medical Insurance Extractor",
      description: "Specialized assistant for extracting medical insurance policy data with high precision",
      instructions: "You are a medical insurance policy data extraction expert with PERFECT ACCURACY. Your sole purpose is to extract data from insurance PDFs with 100% precision. You analyze documents in detail and extract ONLY what is explicitly present. Never infer or hallucinate values that aren't clearly stated. Your output must be clean, consistent, and exactly match the document's content. Return NULL for any field you cannot find with certainty. When extracting from tables, be extremely precise about matching field names exactly.",
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: []
        }
      },
      temperature: 0,  // Maximum determinism
      top_p: 0.1      // Focused output
    }),
  });

  if (!assistantRes.ok) {
    const errTxt = await assistantRes.text();
    throw new Error(`Assistant creation error: ${assistantRes.status} ${errTxt}`);
  }

  const assistant = await assistantRes.json();

  // Create thread
  const threadRes = await fetch(`${OPENAI_BASE}/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({}),
  });

  if (!threadRes.ok) {
    const errTxt = await threadRes.text();
    throw new Error(`Thread creation error: ${threadRes.status} ${errTxt}`);
  }

  const thread = await threadRes.json();

  // Add message with file attachment
  const messageRes = await fetch(`${OPENAI_BASE}/threads/${thread.id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      role: "user",
      content: prompt,
      attachments: [
        {
          file_id: fileId,
          tools: [{ type: "file_search" }]
        }
      ]
    }),
  });

  if (!messageRes.ok) {
    const errTxt = await messageRes.text();
    throw new Error(`Message creation error: ${messageRes.status} ${errTxt}`);
  }

  // Create and poll run
  const runRes = await fetch(`${OPENAI_BASE}/threads/${thread.id}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      assistant_id: assistant.id,
    }),
  });

  if (!runRes.ok) {
    const errTxt = await runRes.text();
    throw new Error(`Run creation error: ${runRes.status} ${errTxt}`);
  }

  const run = await runRes.json();

  // Poll for completion
  let runStatus = run;
  while (runStatus.status === "queued" || runStatus.status === "in_progress") {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusRes = await fetch(`${OPENAI_BASE}/threads/${thread.id}/runs/${run.id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "assistants=v2",
      },
    });

    if (!statusRes.ok) {
      const errTxt = await statusRes.text();
      throw new Error(`Run status check error: ${statusRes.status} ${errTxt}`);
    }

    runStatus = await statusRes.json();
  }

  if (runStatus.status !== "completed") {
    throw new Error(`Run failed with status: ${runStatus.status}`);
  }

  // Get messages
  const messagesRes = await fetch(`${OPENAI_BASE}/threads/${thread.id}/messages`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
  });

  if (!messagesRes.ok) {
    const errTxt = await messagesRes.text();
    throw new Error(`Messages retrieval error: ${messagesRes.status} ${errTxt}`);
  }

  const messages = await messagesRes.json();
  
  // Clean up
  await fetch(`${OPENAI_BASE}/assistants/${assistant.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
  });

  return messages;
}

function parseJsonOutput(resp: any): Record<string, any> {
  // Handle different response formats
  let content = "";
  
  if (resp.choices?.[0]?.message?.content) {
    // Chat completion format
    content = resp.choices[0].message.content;
  } else if (resp.data?.[0]?.content?.[0]?.text?.value) {
    // Assistants API format
    content = resp.data[0].content[0].text.value;
  } else {
    throw new Error("Empty response from OpenAI.");
  }

  if (!content) throw new Error("Empty response from OpenAI.");

  let jsonData: Record<string, any>;
  try {
    jsonData = JSON.parse(content);
  } catch {
    // Try to extract a JSON block from the text
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      jsonData = JSON.parse(match[0]);
    } else {
      throw new Error("Model did not return valid JSON.");
    }
  }
  
  // Post-process special fields to detect and fix common errors
  const ahliField = 'Provider-specific co-insurance at Al Ahli Hospital';
  const generalCoInsurance = 'Co-insurance';
  const inpatientCoInsurance = 'Co-insurance on all inpatient treatment';
  
  // Check if Al Ahli specific field has a value that doesn't explicitly mention Al Ahli
  if (jsonData[ahliField]) {
    const value = jsonData[ahliField];
    if (typeof value === 'string') {
      // If the value is just a percentage (e.g., '15%'), it's very likely incorrect
      // for the Al Ahli field unless it explicitly mentions Al Ahli
      const lowerValue = value.toLowerCase();
      const mentionsAlAhli = lowerValue.includes('al ahli') || lowerValue.includes('ahli hospital');
      
      // MORE AGGRESSIVE VALIDATION: Any percentage value that doesn't explicitly
      // mention Al Ahli Hospital is considered invalid for this field
      if (/\d+%/.test(value) && !mentionsAlAhli) {
        // Replace with 'Not applicable' since this is a generic percentage without Al Ahli mention
        const oldValue = value;
        jsonData[ahliField] = 'Not applicable';
        console.warn(`[VALIDATION] Forced correction for ${ahliField}: was '${oldValue}', set to 'Not applicable' because it doesn't mention Al Ahli explicitly`);
      }
    }
  }
  
  // Extra validation: If both general and Al Ahli co-insurance have the same percentage value
  // and Al Ahli doesn't mention the hospital name, assume Al Ahli is incorrect
  if (jsonData[ahliField] && (jsonData[ahliField] === jsonData[generalCoInsurance] || 
      jsonData[ahliField] === jsonData[inpatientCoInsurance])) {
    const oldValue = jsonData[ahliField];
    jsonData[ahliField] = 'Not applicable';
    console.warn(`[VALIDATION] Corrected identical value for ${ahliField}: was '${oldValue}', set to 'Not applicable' due to duplicate values`);
  }
  
  return jsonData;
}

function validateExtractedValue(value: string | null, fieldName: string): string | null {
  if (value === null) return null;
  
  // Trim the value before processing
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  
  // Standard responses that should always pass validation
  const standardResponses = ['covered', 'not covered', 'nil', 'yes', 'no'];
  const lowerValue = trimmedValue.toLowerCase();
  
  // If it's a standard response, return it immediately
  if (standardResponses.includes(lowerValue)) {
    return trimmedValue;
  }
  
  // Check if the value contains QAR or percentage - likely valid
  if (trimmedValue.includes('QAR') || trimmedValue.includes('%') || /\d+/.test(trimmedValue)) {
    // Return values containing important numeric/financial data
    return trimmedValue;
  }
  
  // Reject common hallucinations and placeholder text but with improved context awareness
  const hallucinations = [
    'not found',
    'not specified',
    'unknown',
    'not available',
    'n/a',
    'none',
    'not mentioned',
    'not provided',
    'not applicable',
    'not defined',
    'not given',
    'not listed',
    'not shown',
    'not included',
    'tbd',
    'to be determined',
    'cannot find',
    'cannot be determined',
    'unable to locate',
    'no information',
    'no data',
    'no details',
    'not in document',
    'not in pdf',
    'not present',
    'unable to find',
    'unable to extract',
  ];
  
  // Check for exact hallucination matches (more careful approach)
  if (hallucinations.includes(lowerValue)) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - exact hallucination match: "${value}"`);
    return null;
  }
  
  // Less aggressive hallucination patterns - only check for clear indicators
  const clearHallucinationPatterns = [
    /^i (cannot|could not|am unable to) (find|locate|extract)/i,
    /^(the|this) (field|value) (is|was) not (found|present|available)/i,
  ];
  
  if (clearHallucinationPatterns.some(pattern => pattern.test(lowerValue))) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - clear hallucination pattern: "${value}"`);
    return null;
  }
  
  // Reject values that are just punctuation
  if (!/[a-zA-Z0-9]/.test(trimmedValue)) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - no alphanumeric content: "${value}"`);
    return null;
  }
  
  // Reject values that are suspiciously short without being standard responses
  if (trimmedValue.length < 2) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - suspiciously short value: "${value}"`);
    return null;
  }
  
  // Clean up citation markers if they're still present
  const cleanedValue = trimmedValue.replace(/\[\d+(?::\d+)?(?:†[a-z]+)?\]|【\d+(?::\d+)?(?:†[a-z]+)?】|\{\d+(?::\d+)?(?:†[a-z]+)?\}/g, '').trim();
  
  return cleanedValue || trimmedValue; // Return cleaned value, or original if cleaning made it empty
}

function validateAllExtractedData(data: ExtractedData, fieldNames: string[]): ExtractedData {
  const validated: ExtractedData = {};
  for (const key of fieldNames) {
    const value = data[key] || null;
    validated[key] = validateExtractedValue(value, key);
  }
  return validated;
}

function findHospitalSpecificCoverage(json: Record<string, any>): string | null {
  try {
    const entries = Object.entries(json);
    for (const [rawKey, rawValue] of entries) {
      if (typeof rawKey !== "string") continue;
      if (typeof rawValue !== "string") continue;
      const key = rawKey.toLowerCase();
      const val = rawValue.trim();
      if (!val) continue;
      const mentionsHospital = key.includes("ahli") || key.includes("hospital");
      const mentionsCoverage = key.includes("coverage") || key.includes("co-insurance") || key.includes("eligible") || key.includes("medical");
      if (mentionsHospital && mentionsCoverage) {
        return val;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function findGeneralCoinsuranceOrCoverage(json: Record<string, any>): string | null {
  try {
    const entries = Object.entries(json);
    for (const [rawKey, rawValue] of entries) {
      if (typeof rawKey !== "string") continue;
      if (typeof rawValue !== "string") continue;
      const key = rawKey.toLowerCase();
      const val = rawValue.trim();
      if (!val) continue;
      const mentionsCoverage = key.includes("co-insurance") || key.includes("coinsurance") || key.includes("coverage");
      const looksLikePercentage = /(\b\d{1,3}\s*%\b)/.test(val) || /covered\s*\d{1,3}\s*%/i.test(val);
      if (mentionsCoverage && looksLikePercentage) {
        return val;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Format QLM specific fields
function formatQLMFields(normalized: ExtractedData): ExtractedData {
  const result = { ...normalized };
  
  // Preserve exact value for Vaccination field
  const vaccinationField = "Vaccination of children";
  if (result[vaccinationField]) {
    let value = result[vaccinationField] as string;
    
    // Handle common cases
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'covered') {
      result[vaccinationField] = 'Covered';
    } else if (lowerValue === 'not covered') {
      result[vaccinationField] = 'Not covered';
    } else if (lowerValue === 'nil') {
      result[vaccinationField] = 'Nil';
    } else {
      // Handle numeric values with currency formatting
      const numberMatch = value.match(/(\d[\d,\.]*)/); 
      if (numberMatch && !lowerValue.includes('qar')) {
        // Add QAR formatting if it has a number but no QAR
        result[vaccinationField] = `QAR ${numberMatch[1]}/PPPY`;
      } else if (numberMatch && lowerValue.includes('qar')) {
        // Ensure consistent formatting for QAR values
        const formattedNumber = numberMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (!lowerValue.includes('/pppy')) {
          result[vaccinationField] = `QAR ${formattedNumber}/PPPY`;
        }
      }
    }
  }
  
  // Format insurance period to "From X To Y"
  const insurancePeriodField = "Period of Insurance";
  if (result[insurancePeriodField]) {
    let value = result[insurancePeriodField] as string;
    const lowerValue = value.toLowerCase();
    
    // If already has from/to format, ensure it's properly capitalized
    if (lowerValue.includes("from") && lowerValue.includes("to")) {
      const fromMatch = value.match(/from\s+([^\s].*?)\s+to/i);
      const toMatch = value.match(/to\s+([^\s].*?)\s*$/i);
      
      if (fromMatch && toMatch) {
        result[insurancePeriodField] = `From ${fromMatch[1].trim()} To ${toMatch[1].trim()}`;
      }
      // Otherwise keep original as it might have correct formatting already
    } else {
      // Try to extract dates and format properly
      // More comprehensive date pattern matching
      const datePattern = /(?:\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.,]?\s+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.,]?\s+\d{1,2}(?:st|nd|rd|th)?[\.,]?\s+\d{2,4}|\d{4}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{1,2})/gi;
      
      const dates = value.match(datePattern);
      if (dates && dates.length >= 2) {
        result[insurancePeriodField] = `From ${dates[0].trim()} To ${dates[1].trim()}`;
      } else if (dates && dates.length === 1) {
        // If only one date is found, look for year ranges like 2023-2024
        const yearRangeMatch = value.match(/(\d{4})\s*[\-\/]\s*(\d{4})/);
        if (yearRangeMatch) {
          result[insurancePeriodField] = `From ${dates[0].trim()} To ${dates[0].trim().replace(/\d{4}/, yearRangeMatch[2])}`;
        }
      } else {
        // Try harder with month recognition
        const possibleMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        let dateFragments = [];
        
        // Split and analyze words to find date components
        const words = value.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          // Check for month names
          if (possibleMonths.includes(words[i].toLowerCase())) {
            // Collect potential date fragment (up to 3 words)
            const fragment = words.slice(i, Math.min(i + 3, words.length)).join(' ');
            dateFragments.push(fragment);
            i += 2; // Skip ahead
          }
          // Check for years (4 digits)
          else if (/^\d{4}$/.test(words[i])) {
            // Add the year and potentially adjacent words
            const fragment = i > 0 ? `${words[i-1]} ${words[i]}` : words[i];
            dateFragments.push(fragment);
          }
        }
        
        if (dateFragments.length >= 2) {
          result[insurancePeriodField] = `From ${dateFragments[0]} To ${dateFragments[1]}`;
        }
        // If all attempts fail, keep original value
      }
    }
  }
  
  // Format psychiatric treatment to just "Covered"
  const psychiatricField = "Psychiatric Treatment";
  if (result[psychiatricField]) {
    const value = result[psychiatricField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    if (lowerValue === 'not covered') {
      result[psychiatricField] = 'Not covered';
    } else if (lowerValue === 'nil') {
      result[psychiatricField] = 'Nil'; 
    } else if (lowerValue.includes("covered") || 
        lowerValue.includes("session") || 
        lowerValue.includes("limit") || 
        lowerValue.includes("up to") || 
        lowerValue.includes("maximum") || 
        lowerValue.includes("per year") || 
        lowerValue.includes("per policy") || 
        lowerValue.includes("consultation")) {
      result[psychiatricField] = "Covered";
    }
    // Otherwise keep original value
  }
  
  // Standardize "For Eligible Medical Expenses at Al Ahli Hospital" to percentage format
  const ahliField = "For Eligible Medical Expenses at Al Ahli Hospital";
  if (result[ahliField]) {
    const value = result[ahliField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    // Look for percentage patterns
    const percentMatch = value.match(/(\d{1,3})\s*%/);
    if (percentMatch) {
      // Format as percentage with coverage
      result[ahliField] = `${percentMatch[1]}% covered`;
    } else if (lowerValue === 'covered' || 
               lowerValue.includes('100') || 
               lowerValue.includes('full') || 
               lowerValue.includes('fully') || 
               lowerValue.includes('all')) {
      // Full coverage indicators
      result[ahliField] = "100% covered";
    } else if (lowerValue === 'not covered') {
      result[ahliField] = "Not covered";
    } else if (lowerValue.includes('co-insurance') || lowerValue.includes('coinsurance')) {
      // Try to extract coinsurance percentage
      const coinsuranceMatch = value.match(/(\d{1,2})\s*%\s*(?:co-?insurance|co-?pay)/i);
      if (coinsuranceMatch) {
        const percentage = 100 - parseInt(coinsuranceMatch[1], 10);
        result[ahliField] = `${percentage}% covered`;
      }
    }
  }
  
  // Add handling for deductibles and copayments
  const copaymentFields = ["Dental Copayment", "Maternity Copayment", "Optical Copayment"];
  copaymentFields.forEach(field => {
    if (result[field]) {
      const value = result[field] as string;
      const lowerValue = value.toLowerCase().trim();
      
      // Standardize percentage formatting
      const percentMatch = value.match(/(\d{1,3})\s*%/);
      if (percentMatch) {
        result[field] = `${percentMatch[1]}%`;
      }
      // Standardize QAR formatting
      else if (lowerValue.includes('qar') || /\d+/.test(lowerValue)) {
        const amountMatch = value.match(/(\d[\d,\.]*)/); 
        if (amountMatch) {
          const amount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          if (!lowerValue.includes('qar')) {
            result[field] = `QAR ${amount}`;
          } else {
            // Ensure consistent spacing for QAR
            result[field] = value.replace(/QAR\s*(\d)/, 'QAR $1');
          }
        }
      }
    }
  });
  
  return result;
}

// Format Alkoot specific fields
function formatAlkootFields(normalized: ExtractedData): ExtractedData {
  const result = { ...normalized };
  
  // Ensure optical benefit has full text with QAR formatting
  const opticalField = "Optical Benefit";
  if (result[opticalField]) {
    let value = result[opticalField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    // Handle standard responses
    if (lowerValue === 'not covered') {
      result[opticalField] = 'Not covered';
    } else if (lowerValue === 'nil') {
      result[opticalField] = 'Nil';
    } else if (lowerValue === 'covered') {
      result[opticalField] = 'Covered';
    } else {
      // Format numerical values correctly
      
      // First, handle specific cases for common values
      if ((value.includes("3,000") || value.includes("3000")) && !value.includes("QAR")) {
        value = value.replace(/(3,?000)/g, "QAR 3,000");
      }

      // Format numbers with commas for readability
      value = value.replace(/(\d+)(\d{3})/g, '$1,$2');
      
      // Add QAR to any numbers without it
      if (!value.includes("QAR") && /\d+/.test(value)) {
        const amountMatch = value.match(/(\d[\d,]*(?:\.\d+)?)/);
        if (amountMatch) {
          value = value.replace(amountMatch[0], `QAR ${amountMatch[0]}`);
        }
      }
      
      // Standardize QAR spacing
      value = value.replace(/QAR\s*(?=\d)/g, "QAR ");

      // Add 'per policy year' if there's a monetary amount but no time period
      const timePatterns = [
        /per\s+policy\s+year/i, /per\s+year/i, /pppy/i,
        /annual/i, /annually/i, /per\s+person/i, /per\s+member/i
      ];
      
      const hasTimeSpecifier = timePatterns.some(pattern => pattern.test(value));
      
      if (!hasTimeSpecifier && (value.includes("QAR") || /\d+/.test(value))) {
        // Add the time period after the amount
        const qarPattern = /QAR\s*[\d,]+(?:\.\d+)?/;
        const match = value.match(qarPattern);
        if (match) {
          value = value.replace(match[0], `${match[0]} per policy year`);
        } else {
          value += " per policy year";
        }
      }
      
      result[opticalField] = value;
    }
  }
  
  // Format co-insurance and similar fields with special handling for Al Ahli
  
  // Special handling for Provider-specific co-insurance at Al Ahli Hospital
  const ahliCoInsuranceField = "Provider-specific co-insurance at Al Ahli Hospital";
  if (result[ahliCoInsuranceField]) {
    let value = result[ahliCoInsuranceField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    // Check if the value specifically mentions Al Ahli Hospital
    const mentionsAlAhli = lowerValue.includes('al ahli') || lowerValue.includes('ahli hospital');
    
    // Standard responses
    if (lowerValue === 'not covered' || lowerValue === 'not applicable' || lowerValue === 'nil' || lowerValue === 'none') {
      result[ahliCoInsuranceField] = lowerValue === 'none' || lowerValue === 'nil' ? 'Nil' : 
                                    (lowerValue === 'not applicable' ? 'Not applicable' : 'Not covered');
      // Return early to prevent further processing
    }
    // Specifically mentions Al Ahli and has percentage
    else if (mentionsAlAhli) {
      // Look for percentage patterns
      const percentMatch = value.match(/(\d{1,3})\s*(%|percent|percentage)/i);
      if (percentMatch) {
        result[ahliCoInsuranceField] = `${percentMatch[1]}%`;
      } else {
        // Check for other number patterns
        const coInsuranceMatch = value.match(/co-?insurance\s*(?:of|is|at)?\s*(\d{1,3})/i);
        if (coInsuranceMatch) {
          result[ahliCoInsuranceField] = `${coInsuranceMatch[1]}%`;
        }
      }
    }
    // If there's no specific mention of Al Ahli but value looks like a copied value
    // from another coinsurance field, mark as not applicable
    else if (!mentionsAlAhli && /^\d{1,2}%$/.test(lowerValue)) {
      result[ahliCoInsuranceField] = 'Not applicable';
    }
  }
  
  // Handle other co-insurance fields
  const otherCoInsuranceFields = [
    "Co-insurance on all inpatient treatment",
    "Co-insurance"
  ];
  
  otherCoInsuranceFields.forEach(field => {
    if (result[field]) {
      let value = result[field] as string;
      const lowerValue = value.toLowerCase().trim();
      
      // Handle standard responses first
      if (lowerValue === 'not covered') {
        result[field] = 'Not covered';
        return;
      } else if (lowerValue === 'nil' || lowerValue === 'none' || lowerValue === 'not applicable') {
        result[field] = lowerValue === 'none' || lowerValue === 'nil' ? 'Nil' : 'Not applicable';
        return;
      } else if (lowerValue === 'covered') {
        result[field] = 'Covered';
        return;
      }
      
      // Look for specific percentage patterns
      const patterns = [
        /(\d{1,3})\s*(%|percent|percentage)/i,                  // 20%, 20 percent
        /(\d{1,3})\s*(?:co-?insurance|co-?pay(?:ment)?)/i,     // 20 co-insurance, 20 copay
        /co-?insurance\s*(?:of|is|at)?\s*(\d{1,3})\s*(%)?/i, // co-insurance of 20%
        /co-?pay(?:ment)?\s*(?:of|is|at)?\s*(\d{1,3})\s*(%)?/i // copayment of 20%
      ];
      
      for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) {
          // Standardize percentage format
          const percentage = match[1];
          result[field] = `${percentage}%`;
          return;
        }
      }
    }
  });

  // Ensure numeric values are preserved in benefit fields with improved formatting
  const benefitFields = ["Pregnancy & Childbirth", "Dental Benefit"];
  benefitFields.forEach(field => {
    if (result[field]) {
      let value = result[field] as string;
      const lowerValue = value.toLowerCase().trim();
      
      // Handle standard responses
      if (lowerValue === 'not covered') {
        result[field] = 'Not covered';
      } else if (lowerValue === 'nil') {
        result[field] = 'Nil';
      } else if (lowerValue === 'covered') {
        result[field] = 'Covered';
      } else {
        // Improve QAR currency formatting
        value = value.replace(/QAR\s*(\d)/g, "QAR $1");
        
        // Ensure consistent percentage formatting
        value = value.replace(/(\d+)\s*(%|percent|percentage)/i, "$1%");
        
        // Add 'QAR' prefix if missing but has number at the start
        if (!value.includes("QAR")) {
          const amountMatch = value.match(/^\s*(\d[\d,]*(?:\.\d+)?)/);
          if (amountMatch) {
            // Format with commas for thousands
            const formattedAmount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            value = value.replace(amountMatch[0], `QAR ${formattedAmount}`);
          }
        }
        
        // Add per policy year if missing time period
        const timePatterns = [
          /per\s+policy\s+year/i, /per\s+year/i, /pppy/i,
          /annual/i, /annually/i, /per\s+person/i, /per\s+member/i
        ];
        
        const hasTimeSpecifier = timePatterns.some(pattern => pattern.test(value));
        
        if (!hasTimeSpecifier && value.includes("QAR")) {
          value += " per policy year";
        }
        
        result[field] = value;
      }
    }
  });
  
  // Handle 'Vaccination & Immunization' field with improved logic
  const vaccinationField = "Vaccination & Immunization";
  if (result[vaccinationField]) {
    let value = result[vaccinationField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    // Handle standard responses first
    if (lowerValue === 'not covered') {
      result[vaccinationField] = 'Not covered';
    } else if (lowerValue === 'nil') {
      result[vaccinationField] = 'Nil';
    } else if (lowerValue === 'covered' || 
              (lowerValue.includes('covered') && !lowerValue.includes('not') && !(/\d/.test(value)))) {
      result[vaccinationField] = "Covered";
    } else if (lowerValue.includes('not covered') || lowerValue.includes('not included')) {
      result[vaccinationField] = "Not covered";
    } else {
      // Check if value contains amount without QAR
      if (!lowerValue.includes('qar') && /\d+/.test(lowerValue)) {
        const amountMatch = value.match(/(\d[\d,]*(?:\.\d+)?)/);
        if (amountMatch) {
          // Format with commas for thousands
          const formattedAmount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          value = value.replace(amountMatch[0], `QAR ${formattedAmount}`);
          result[vaccinationField] = value;
        }
      }
    }
  }
  
  // Format psychiatric treatment field
  const psychiatricField = "Psychiatric treatment & Psychotherapy";
  if (result[psychiatricField]) {
    let value = result[psychiatricField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    if (lowerValue === 'not covered') {
      result[psychiatricField] = 'Not covered';
    } else if (lowerValue === 'nil') {
      result[psychiatricField] = 'Nil';
    } else if (lowerValue === 'covered' || 
             (lowerValue.includes('covered') && !lowerValue.includes('not') && 
              (lowerValue.includes('session') || lowerValue.includes('visit') || 
               !(/\d/.test(lowerValue))))) {
      result[psychiatricField] = "Covered";
    } else if (lowerValue.includes('not covered')) {
      result[psychiatricField] = "Not covered";
    } else {
      // Format QAR amounts if present
      if (/\d+/.test(lowerValue)) {
        if (!lowerValue.includes('qar')) {
          const amountMatch = value.match(/(\d[\d,]*(?:\.\d+)?)/);
          if (amountMatch) {
            const formattedAmount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            value = value.replace(amountMatch[0], `QAR ${formattedAmount}`);
          }
        } else {
          // Ensure consistent QAR spacing
          value = value.replace(/QAR\s*(?=\d)/g, "QAR ");
        }
        result[psychiatricField] = value;
      }
    }
  }
  
  // Format dates with improved consistency
  const dateFields = ["Effective Date", "Expiry Date"];
  dateFields.forEach(field => {
    if (result[field]) {
      const value = result[field] as string;
      const trimmed = value.trim();
      
      // Check if the date is already in a standard format (no need to change)
      const standardDatePattern = /^\d{1,2}[\/\-\.](\d{1,2}|[A-Za-z]{3})[\/\-\.](\d{2}|\d{4})$|^[A-Za-z]{3}\/\d{1,2}\/\d{2,4}$|^\d{4}[\/\-\.](\d{1,2}|[A-Za-z]{3})[\/\-\.]\d{1,2}$/;
      if (standardDatePattern.test(trimmed)) {
        result[field] = trimmed;
      } else {
        // Try to extract date in a standard format
        const datePattern = /(?:\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.,]?\s+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\.,]?\s+\d{1,2}(?:st|nd|rd|th)?[\.,]?\s+\d{2,4}|\d{4}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{1,2})/gi;
        const dates = value.match(datePattern);
        if (dates && dates.length > 0) {
          result[field] = dates[0].trim();
        } else {
          result[field] = trimmed;
        }
      }
    }
  });
  
  // Format deductible fields
  const deductibleField = "Deductible on consultation";
  if (result[deductibleField]) {
    let value = result[deductibleField] as string;
    const lowerValue = value.toLowerCase().trim();
    
    if (lowerValue === 'not applicable' || lowerValue === 'nil' || lowerValue === 'none') {
      result[deductibleField] = 'Nil';
    } else if (lowerValue.includes('qar') || /\d+/.test(lowerValue)) {
      // Standardize QAR format
      if (!lowerValue.includes('qar')) {
        const amountMatch = value.match(/(\d[\d,]*(?:\.\d+)?)/);
        if (amountMatch) {
          const formattedAmount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          value = `QAR ${formattedAmount}`;
        }
      } else {
        // Ensure proper spacing and formatting
        value = value.replace(/QAR\s*(?=\d)/g, "QAR ");
        // Extract the amount and reformat it with proper commas
        const amountMatch = value.match(/QAR\s+(\d[\d,]*(?:\.\d+)?)/);
        if (amountMatch) {
          const formattedAmount = amountMatch[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          value = `QAR ${formattedAmount}`;
        }
      }
      result[deductibleField] = value;
    }
  }
  
  // Final validation for Al Ahli Hospital co-insurance
  // This is our last line of defense against incorrect values
  const ahliField = "Provider-specific co-insurance at Al Ahli Hospital";
  const generalCoInsurance = "Co-insurance";
  const inpatientCoInsurance = "Co-insurance on all inpatient treatment";
  
  if (result[ahliField]) {
    const value = result[ahliField] as string;
    if (typeof value === 'string') {
      // Check if it's a simple percentage value
      if (/^\d+%$/.test(value)) {
        // Check if it matches other co-insurance fields
        if (value === result[generalCoInsurance] || value === result[inpatientCoInsurance]) {
          console.warn(`[FORMAT] Detected likely incorrect value in Al Ahli field: '${value}' matches general co-insurance`);
          result[ahliField] = 'Not applicable';
        } else {
          // Even if it doesn't match other fields, if it's just a percentage with no mention of Al Ahli,
          // it's still likely incorrect
          const lowerValue = value.toLowerCase();
          const mentionsAlAhli = lowerValue.includes('al ahli') || lowerValue.includes('ahli hospital');
          if (!mentionsAlAhli) {
            console.warn(`[FORMAT] Forcing correction for Al Ahli field with generic percentage: '${value}'`);
            result[ahliField] = 'Not applicable';
          }
        }
      }
    }
  }
  
  return result;
}


export async function extractDataApi({
  file,
  apiKey,
  fields,
  payerPlan,
  payerPlanName,
}: {
  file: File;
  apiKey: string;
  fields?: string[];
  payerPlan?: PayerPlan;
  payerPlanName?: string;
}): Promise<ExtractedData> {
  assertKey(apiKey);
  const startTime = Date.now();
  let success = false;
  let errorMessage = '';
  let extractedFields = 0;

  try {
    // Log extraction started
    await logExtraction(file.name, 'started', `Starting extraction for ${payerPlanName || payerPlan || 'unknown'}`);

    // Track file upload start
    trackExtractionEvent('file_upload_started', {
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      payer_plan: payerPlanName || 'unknown',
    });

    // 1) Upload file
    const fileId = await uploadFileToOpenAI(file, apiKey);

    // Track successful file upload
    trackExtractionEvent('file_upload_completed', {
      file_name: file.name,
      file_size: file.size,
      payer_plan: payerPlanName || 'unknown',
    });

    // 2) Resolve fields
    const resolvedFields = (fields && fields.length > 0)
      ? fields
      : (payerPlan ? FIELD_MAPPINGS[payerPlan] : []);
    if (!resolvedFields || resolvedFields.length === 0) {
      throw new Error("No fields provided to extract.");
    }
    const prompt = buildPrompt(
      resolvedFields,
      payerPlan ? FIELD_SUGGESTIONS[payerPlan] : undefined,
      payerPlan
    );
    const response = await createAssistantAndRun({ apiKey, fileId, prompt });

    // 3) Parse JSON
    const json = parseJsonOutput(response);

    // Log what was found for debugging
    console.log(`\n=== EXTRACTION DEBUG INFO ===`);
    console.log(`Payer Plan: ${payerPlan}`);
    console.log(`File: ${file.name} (${file.size} bytes)`);
    console.log(`Expected fields (${resolvedFields.length}):`, resolvedFields);
    console.log(`Extracted keys (${Object.keys(json).length}):`, Object.keys(json));
    console.log(`Raw extraction results:`, json);

    // Count extracted fields
    let foundFields = 0;
    
    // Ensure all expected keys exist; fill missing with null
    let normalized: ExtractedData = {};
    for (const key of resolvedFields) {
      const val = Object.prototype.hasOwnProperty.call(json, key) ? json[key] : null;
      normalized[key] = val === undefined ? null : (val as string | null);
      
      if (val !== null && val !== undefined) {
        foundFields++;
        console.log(`✓ "${key}": ${typeof val === 'string' ? val.substring(0, 80) : val}${typeof val === 'string' && val.length > 80 ? '...' : ''}`);
      } else {
        console.log(`✗ "${key}": NOT FOUND`);
      }
    }
    
    // Apply validation layer to catch hallucinations
    console.log(`\n=== VALIDATION LAYER ===`);
    normalized = validateAllExtractedData(normalized, resolvedFields);
    
    extractedFields = foundFields;
    
    // Track successful extraction
    success = true;
    trackExtractionEvent('extraction_completed', {
      file_name: file.name,
      file_size: file.size,
      payer_plan: payerPlanName || 'unknown',
      fields_expected: resolvedFields.length,
      fields_extracted: foundFields,
      extraction_time_ms: Date.now() - startTime,
      extraction_success_rate: (foundFields / resolvedFields.length) * 100,
    });

    // Plan-specific post-processing logic
    if (payerPlan === PAYER_PLANS.QLM) {
      normalized = formatQLMFields(normalized);
      console.log('Applied QLM-specific formatting');
    }
    
    if (payerPlan === PAYER_PLANS.ALKOOT) {
      // Apply Alkoot-specific formatting
      normalized = formatAlkootFields(normalized);
      console.log('Applied Alkoot-specific formatting');
      
      // Log extraction results for debugging
      console.log('Alkoot extraction results:', normalized);
    }

    // No fallback logic - return values as extracted from PDF only

    // Log final summary
    const foundCount = Object.values(normalized).filter(v => v !== null).length;
    const totalCount = resolvedFields.length;
    const successRate = ((foundCount / totalCount) * 100).toFixed(1);
    console.log(`\n=== EXTRACTION SUMMARY ===`);
    console.log(`Fields found: ${foundCount}/${totalCount} (${successRate}%)`);
    console.log(`Payer Plan: ${payerPlan}`);
    console.log(`File: ${file.name}`);
    console.log(`Processing time: ${Date.now() - startTime}ms`);

    // Extra validation - force fix for Al Ahli Hospital issue
    // This is a last resort fix for the specific issue with Al Ahli field and inpatient co-insurance
    const ahliField = 'Provider-specific co-insurance at Al Ahli Hospital';
    const inpatientField = 'Co-insurance on all inpatient treatment';
    if (normalized[ahliField] && normalized[inpatientField] && 
        normalized[ahliField] === normalized[inpatientField] && 
        /^\d+%$/.test(normalized[ahliField] as string)) {
      console.log(`[CRITICAL FIX] Detected identical values for ${ahliField} (${normalized[ahliField]}) ` +
                  `and ${inpatientField} (${normalized[inpatientField]}) - fixing to 'Not applicable'`);
      normalized[ahliField] = 'Not applicable';
    }
    
    console.log(`Final extracted data:`, normalized);
    console.log(`=== END EXTRACTION ===
`);

    // Log successful extraction
    await logExtraction(file.name, 'success', `Extracted ${Object.values(normalized).filter(v => v !== null).length}/${totalCount} fields (${successRate}%)`);

    return normalized;
  } catch (error) {
    console.error("Extraction failed:", error);
    
    // Track extraction failure
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Log extraction error
    await logExtraction(file.name, 'error', errorMsg);
    
    trackExtractionEvent('extraction_failed', {
      file_name: file.name,
      file_size: file.size,
      payer_plan: payerPlanName || 'unknown',
      error_message: errorMsg,
      extraction_time_ms: Date.now() - startTime,
    });
    
    throw error;
  } finally {
    // Track overall extraction attempt
    if (!success) {
      trackExtractionEvent('extraction_attempted', {
        file_name: file.name,
        file_size: file.size,
        payer_plan: payerPlanName || 'unknown',
        success: false,
        extraction_time_ms: Date.now() - startTime,
        error_message: errorMessage,
      });
    }
  }
}

interface CompareDataApiParams {
  file1: File;
  file2: File;
  apiKey: string;
  fields?: string[];
  payerPlan?: PayerPlan;
  payerPlanName?: string;
}

export async function compareDataApi({ 
  file1, 
  file2, 
  apiKey, 
  fields, 
  payerPlan, 
  payerPlanName 
}: CompareDataApiParams): Promise<ComparisonResult[]> {
  // Extract both in parallel
  const [data1, data2] = await Promise.all([
    extractDataApi({ file: file1, apiKey, fields, payerPlan, payerPlanName }),
    extractDataApi({ file: file2, apiKey, fields, payerPlan, payerPlanName }),
  ]);

  const resolvedFields = (fields && fields.length > 0)
    ? fields
    : (payerPlan ? FIELD_MAPPINGS[payerPlan] : Object.keys(data1));
  const results: ComparisonResult[] = resolvedFields.map((field) => {
    const v1 = (data1 as any)[field] ?? null;
    const v2 = (data2 as any)[field] ?? null;

    let status: ComparisonResult["status"] = "same";
    if (v1 === null && v2 === null) status = "missing";
    else if (v1 !== v2) status = "different";

    return { field, file1Value: v1, file2Value: v2, status };
  });

  return results;
}


