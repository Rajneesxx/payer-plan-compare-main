


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

  let hintsSection = "";
  if (fieldHints && typeof fieldHints === "object" && safeFields.length) {
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

  // General extraction instructions that apply to all payer plans
  const specificInstructions = "\n=== GENERAL EXTRACTION RULES ===\n" +
  "1. Search for EXACT field names in the document\n" +
  "2. For tables, look for field names in the left column and values in the right column\n" +
  "3. Preserve all original formatting (QAR, %, dates, etc.)\n" +
  "4. If a field is not found, use 'null' (without quotes)\n" +
  "5. For boolean fields, use 'true' or 'false' (without quotes)\n\n" +
  "=== CRITICAL: DENTAL & OPTICAL BENEFITS EXTRACTION ===\n" +
  "1. For 'Dental Benefit' and 'Optical Benefit' fields, follow these steps:\n" +
  "   a. FIRST, look for a table with 'Benefit' in the first column\n" +
  "   b. Search for the exact field name in the left column\n" +
  "   c. Extract the ENTIRE value from the right column\n" +
  "   d. If not found in tables, search in the document text\n" +
  "   e. If still not found, return 'null'\n\n" +
  "2. Example of what to look for (EXACT FORMAT):\n" +
  "   | Benefit         | Coverage Details             |\n" +
  "   |-----------------|-------------------------------|\n" +
  "   | Dental Benefit  | QAR 1,500 per policy year    |\n" +
  "   | Optical Benefit | QAR 1,000 per policy year    |\n\n" +
  "3. Special Cases:\n" +
  "   - If you see 'Not Covered' or 'Not applicable', use that exact text\n" +
  "   - If the value includes a range (e.g., 'QAR 1,000 - 2,000'), include the full range\n" +
  "   - If there are conditions (e.g., 'up to QAR 1,500'), include them\n" +
  "   - Preserve all original text including 'QAR', commas, and periods\n\n" +
  "4. Common Mistakes to Avoid:\n" +
  "   - Don't skip values that are in a different format than expected\n" +
  "   - Don't truncate or summarize the extracted value";

  return (
    "Extract the following fields from the insurance document with MAXIMUM ACCURACY.\n\n" +
    "=== EXTRACTION RULES ===\n" +
    "1. Search in this order: tables (left column = field, right column = value) → text sections\n" +
    "2. For each field, look for EXACT name matches first, then try variations\n" +
    "3. Extract COMPLETE values including conditions, percentages, and amounts\n" +
    "4. Preserve original formatting (QAR, %, dates, etc.) exactly as shown\n" +
    "5. If field not found, use 'null' (without quotes)\n\n" +
    "=== OUTPUT FORMAT (MUST FOLLOW EXACTLY) ===\n" +
    "```markdown\n" +
    "| Field Name | Value |\n" +
    "|------------|-------|\n" +
    "| Field 1    | Value 1 |\n" +
    "| Field 2    | null |\n" +
    "```\n\n" +
    "=== IMPORTANT ===\n" +
    "- Return ONLY the markdown table, no other text\n" +
    "- Use 'null' for missing fields\n" +
    "- Keep all original formatting\n" +
    "- DO NOT include explanations or notes\n\n" +
    specificInstructions +
    "\nFIELDS TO EXTRACT (exact names):\n" +
    `${fieldList}\n\n` +
    hintsSection +
    "\nReturn ONLY the markdown table with exactly 2 columns, no other text."
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
    response_format: { type: "markdown" },
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

  const response = await res.text();
  return response;
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

function parseMarkdownOutput(resp: any): Record<string, any> {
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

  // Parse markdown table format
  const markdownData = parseMarkdownTable(content);
  return postProcessData(markdownData);
}

/**
 * Post-process the extracted data to fix common issues
 */
function postProcessData(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  
  // Post-process special fields to detect and fix common errors
  const ahliField = 'Provider-specific co-insurance at Al Ahli Hospital';
  const generalCoInsurance = 'Co-insurance';
  const inpatientCoInsurance = 'Co-insurance on all inpatient treatment';
  
  // Check if Al Ahli specific field has a value that doesn't explicitly mention Al Ahli
  if (result[ahliField]) {
    const value = result[ahliField];
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      const mentionsAlAhli = lowerValue.includes('al ahli') || lowerValue.includes('ahli hospital');
      
      // Any percentage value that doesn't explicitly mention Al Ahli Hospital is considered invalid
      if (/\d+%/.test(value) && !mentionsAlAhli) {
        const oldValue = value;
        result[ahliField] = 'Not applicable';
        console.warn(`[VALIDATION] Forced correction for ${ahliField}: was '${oldValue}', set to 'Not applicable' because it doesn't mention Al Ahli explicitly`);
      }
    }
  }
  
  // Extra validation for duplicate values
  if (result[ahliField] && (result[ahliField] === result[generalCoInsurance] || 
      result[ahliField] === result[inpatientCoInsurance])) {
    const oldValue = result[ahliField];
    result[ahliField] = 'Not applicable';
    console.warn(`[VALIDATION] Corrected identical value for ${ahliField}: was '${oldValue}', set to 'Not applicable' due to duplicate values`);
  }
  
  return result;
}

/**
 * Parses a markdown table into a JSON object
 * Expects format:
 * | Field Name | Value |
 * |------------|-------|
 * | Field 1    | Value 1 |
 * | Field 2    | Value 2 |
 */
function parseMarkdownTable(markdown: string): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Split into lines and remove header and separator rows
  const lines = markdown
    .split('\n')
    .filter(line => line.trim().startsWith('|') && !line.includes('---'));

  // Process each line
  for (const line of lines) {
    // Remove leading/trailing | and split by |
    const cells = line
      .trim()
      .slice(1, -1) // Remove leading and trailing |
      .split('|')
      .map(cell => cell.trim());

    if (cells.length >= 2) {
      const field = cells[0];
      const value = cells[1];
      
      // Only add if we have both field and value
      if (field && value) {
        // Convert 'null' or empty values to null
        result[field] = value.toLowerCase() === 'null' || value === '' ? null : value;
      }
    }
  }

  return result;
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

    // 3) Parse Markdown response
    const json = parseMarkdownOutput(response);

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


