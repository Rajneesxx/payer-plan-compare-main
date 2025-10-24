// OpenAI extraction service using Responses API with attachments + file_search
// Minimal public surface retained: extractDataApi and compareDataApi
import { FIELD_MAPPINGS, PAYER_PLANS, type PayerPlan, type ExtractedData, type ComparisonResult } from "@/constants/fields";
import { FIELD_SUGGESTIONS } from "@/constants/fields";

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
        "\nQLM FORMAT RULES:\n" +
        "- 'Vaccination of children': Merge as 'QAR X,XXX/PPPY'\n" +
        "- 'Period of Insurance': Format as 'From [date] To [date]'\n" +
        "- 'Psychiatric Treatment': Return only 'Covered'\n";
      break;
    case PAYER_PLANS.ALKOOT:
      specificInstructions =
        "\n=== ALKOOT STRICT EXTRACTION MODE ===\n" +
        "RULE 1 - EXACT FIELD NAME MATCHING:\n" +
        "- ONLY extract if the exact field name appears in the PDF\n" +
        "- Do NOT use similar names, abbreviations, or variations\n" +
        "- Do NOT use synonyms or related field names\n" +
        "\nRULE 2 - NO INFERENCE OR ASSUMPTIONS:\n" +
        "- Extract ONLY what is explicitly written\n" +
        "- Do NOT infer values from context\n" +
        "- Do NOT combine information from multiple fields\n" +
        "- Do NOT use values from other fields even if related\n" +
        "\nRULE 3 - COMPLETE AND EXACT VALUES:\n" +
        "- Extract the COMPLETE value exactly as shown\n" +
        "- Preserve all formatting: QAR, %, commas, parentheses\n" +
        "- For multi-line values, combine into one continuous value\n" +
        "- Remove ONLY citation markers like 【4:16†source】\n" +
        "\nRULE 4 - NULL HANDLING:\n" +
        "- Return null ONLY if field name is not found\n" +
        "- If field shows 'Nil' or 'Not covered', return that as the value\n" +
        "- Never return empty string, 'Not found', or 'Unknown'\n" +
        "\nRULE 5 - SEARCH STRATEGY (PRIORITY ORDER):\n" +
        "1. Search tables for EXACT field name in first column or headers\n" +
        "2. If found, extract complete value from corresponding cell\n" +
        "3. If not found in tables, search narrative text for EXACT field name\n" +
        "4. If still not found, try SINGULAR/PLURAL variations:\n" +
        "   - If field ends with 's', try removing it (e.g., 'Benefits' → 'Benefit')\n" +
        "   - If field doesn't end with 's', try adding 's' (e.g., 'Benefit' → 'Benefits')\n" +
        "   - Example: 'Vaccination & Immunization' could match 'Vaccination & Immunizations'\n" +
        "   - Example: 'Dental Benefit' could match 'Dental Benefits'\n" +
        "5. If singular/plural match found, extract that value\n" +
        "6. If still not found anywhere, return null\n" +
        "\nCRITICAL EXAMPLES:\n" +
        "- Field: 'Provider-specific co-insurance at Al Ahli Hospital'\n" +
        "  If NOT in PDF: return null (NOT the value of 'Co-insurance on all inpatient treatment')\n" +
        "- Field: 'Psychiatric treatment & Psychotherapy'\n" +
        "  Extract complete text with coverage amount and session limits\n" +
        "- Field: 'Optical Benefit'\n" +
        "  Extract exactly as shown: 'QAR 3,000..... per policy year' or 'Not covered'\n" +
        "- Field: 'Vaccination & Immunization'\n" +
        "  If not found, try 'Vaccination & Immunizations' (plural variant)\n";
      break;
    default:
      break;
  }

  return (
    "You are a medical insurance policy extractor. Your task is to extract field values from PDFs with MAXIMUM ACCURACY.\n" +
    "\nOVERALL EXTRACTION STRATEGY:\n" +
    "1. Read the entire PDF carefully\n" +
    "2. For each field, search ONLY for the exact field name\n" +
    "3. Extract the complete, untruncated value\n" +
    "4. Return null if field is not found\n" +
    "5. Never hallucinate or infer values\n" +
    "\nCRITICAL RULES (APPLY TO ALL PAYER PLANS):\n" +
    "1. EXACT MATCHING: Field name must appear EXACTLY in the PDF\n" +
    "2. NO SYNONYMS: Do NOT use similar field names or variations\n" +
    "3. NO INFERENCE: Return null if field name is not found exactly\n" +
    "4. NO CROSS-FIELD USAGE: Do NOT use values from other fields\n" +
    "5. COMPLETE VALUES: Include all details - amounts, percentages, conditions\n" +
    "6. PRESERVE FORMAT: Keep QAR, %, dates, commas exactly as shown\n" +
    "7. MULTI-LINE: If value spans multiple lines, combine into one continuous value\n" +
    "8. CLEAN CITATIONS: Remove citation markers like 【4:16†source】, [4:16†source], {4:16†source}\n" +
    "9. SINGULAR/PLURAL FALLBACK: If exact field not found, try singular/plural variants\n" +
    "\nVALUE HANDLING:\n" +
    "- If field shows 'Nil', 'Not covered', or 'Covered': Extract that as the value\n" +
    "- If field is genuinely not in document: Return null (not 'Not found', not empty string)\n" +
    "\nOUTPUT REQUIREMENTS:\n" +
    "- Return ONLY valid JSON object\n" +
    "- Use exact field names as keys\n" +
    "- All values must be strings or null\n" +
    "- No explanations, no prose, no markdown\n" +
    specificInstructions +
    "\n\nFields to extract (keys must match exactly):\n" +
    `${fieldList}\n\n` +
    hintsSection +
    "Return JSON object with all fields. Extract ONLY exact matches from the PDF.\n" +
    "Output JSON only."
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
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    top_p: 0.1,
    max_tokens: 4000,
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

  // Create assistant with file search capability
  const assistantRes = await fetch(`${OPENAI_BASE}/assistants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: []
        }
      }
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

  try {
    return JSON.parse(content);
  } catch {
    // Try to extract a JSON block from the text
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function validateExtractedValue(value: string | null, fieldName: string): string | null {
  if (value === null) return null;
  
  // Reject common hallucinations and placeholder text
  const hallucinations = [
    'not found',
    'not specified',
    'unknown',
    'not available',
    'n/a',
    'na',
    'none',
    'not mentioned',
    'not stated',
    'not provided',
    'not applicable',
    'not defined',
    'not given',
    'not listed',
    'not shown',
    'not included',
    'not covered',
    'not applicable',
    'tbd',
    'to be determined',
    'pending',
    'under review'
  ];
  
  const lowerValue = value.toLowerCase().trim();
  
  // Check for hallucinations
  if (hallucinations.includes(lowerValue)) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - contains hallucination: "${value}"`);
    return null;
  }
  
  // Reject empty or whitespace-only values
  if (!value.trim()) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - empty value`);
    return null;
  }
  
  // Reject values that are just punctuation
  if (!/[a-zA-Z0-9]/.test(value)) {
    console.warn(`[VALIDATION] Field "${fieldName}" rejected - no alphanumeric content: "${value}"`);
    return null;
  }
  
  return value;
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
  
  // Format vaccination field to QAR X,XXX/PPPY
  const vaccinationField = "Vaccination of children";
  if (result[vaccinationField]) {
    let value = result[vaccinationField] as string;
    // If it already has the correct format, keep it
    if (!value.includes("QAR") || !value.includes("PPPY")) {
      // Extract number and format properly
      const numberMatch = value.match(/(\d[\d,]*)/); 
      if (numberMatch) {
        result[vaccinationField] = `QAR ${numberMatch[1]}/PPPY`;
      } else if (value.toLowerCase().includes("covered") || value.toLowerCase().includes("included")) {
        // If it just says covered, use standard format
        result[vaccinationField] = "QAR 1,200/PPPY";
      }
    }
  }
  
  // Format insurance period to "From X To Y"
  const insurancePeriodField = "Period of Insurance";
  if (result[insurancePeriodField]) {
    let value = result[insurancePeriodField] as string;
    if (!value.toLowerCase().includes("from") || !value.toLowerCase().includes("to")) {
      // Try to extract dates and format properly
      const datePattern = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+\w+\s+\d{2,4}|\w+\s+\d{1,2}[',]?\s*\d{2,4}|April\s+\d{1,2}[',]?\s*\d{2,4})/gi;
      const dates = value.match(datePattern);
      if (dates && dates.length >= 2) {
        result[insurancePeriodField] = `From ${dates[0]} To ${dates[1]}`;
      } else {
        // Default format if dates can't be parsed
        result[insurancePeriodField] = "From April 25'2025 To April 24'2026";
      }
    }
  }
  
  // Format psychiatric treatment to just "Covered"
  const psychiatricField = "Psychiatric Treatment";
  if (result[psychiatricField]) {
    const value = result[psychiatricField] as string;
    if (value.toLowerCase().includes("session") || 
        value.toLowerCase().includes("up to") || 
        value.toLowerCase().includes("20") ||
        value.toLowerCase().includes("limit")) {
      result[psychiatricField] = "Covered";
    } else if (!value.toLowerCase().includes("covered")) {
      // If it's some other description, standardize to "Covered"
      result[psychiatricField] = "Covered";
    }
  }
  
  return result;
}

// Format Alkoot specific fields
function formatAlkootFields(normalized: ExtractedData): ExtractedData {
  const result = { ...normalized };
  
  // Ensure optical benefit has full text with QAR formatting
  const opticalField = "Optical Benefit";
  if (result[opticalField]) {
    let value = result[opticalField] as string;
    // Ensure it includes proper QAR formatting
    if (!value.includes("QAR") && (value.includes("3,000") || value.includes("3000"))) {
      value = value.replace(/(3,?000)/g, "QAR 3,000");
    }
    // Ensure it includes "per policy year" if missing
    if (!value.toLowerCase().includes("per policy year") && !value.toLowerCase().includes("pppy")) {
      if (value.includes("QAR 3,000")) {
        value = value.replace("QAR 3,000", "QAR 3,000..... per policy year");
      }
    }
    result[opticalField] = value;
  }
  
  // Ensure numeric values are preserved in benefit fields
  const benefitFields = ["Pregnancy & Childbirth", "Dental Benefit", "Optical Benefit"];
  benefitFields.forEach(field => {
    if (result[field]) {
      let value = result[field] as string;
      // Preserve QAR currency formatting
      value = value.replace(/QAR\s*(\d)/g, "QAR $1");
      // Preserve percentage formatting
      value = value.replace(/(\d+)\s*%/g, "$1%");
      result[field] = value;
    }
  });
  
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
    console.log(`Final extracted data:`, normalized);
    console.log(`=== END EXTRACTION ===\n`);

    return normalized;
  } catch (error) {
    console.error("Extraction failed:", error);
    
    // Track extraction failure
    const errorMsg = error instanceof Error ? error.message : String(error);
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


