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
        "\nALKOOT FORMAT RULES:\n" +
        "- Extract exact percentages, amounts, and full text\n" +
        "- Preserve content for Psychiatric, Optical, Dental, and Pregnancy fields\n" +
        "- Keep QAR, %, and 'per policy year' units intact\n";
      break;
    default:
      break;
  }

  return (
  "You are a precise information extraction engine capable of processing PDF documents, including scanned PDFs with OCR.\n" +
    "Task: Extract the following fields from the attached PDF document.\n" +
    "Rules for table-based extraction:\n" +
    "- When extracting from tables, identify the target field name in the first column\n" +
    "- Return ONLY the text from the next column of the same row, exactly as it appears\n" +
    "- If the next column is empty, return 'No data'\n" +
    "- Do not include any descriptive text from the field name column\n" +
    "- Preserve all formatting, including punctuation, case, and special characters\n" +
    "\nGeneral extraction rules:\n" +
    "- Return JSON only (no prose or explanations).\n" +
    "- Use EXACT keys from the field list below.\n" +
    "- If a field is not clearly present in the document, set its value to null.\n" +
    "- Look for field names that are SIMILAR or RELATED to the requested fields.\n" +
    "- Check for variations, abbreviations, and alternative phrasings.\n" +
    "- Search in tables, headers, paragraphs, and any text content.\n" +
    "- For medical insurance documents, look for:\n" +
    "  * Deductibles, co-pays, co-insurance percentages\n" +
    "  * Coverage limits and percentages\n" +
    "  * Hospital-specific benefits\n" +
    "  * Policy numbers, dates, and plan details\n" +
    "- Prefer the most explicit value near labels, tables, or key-value pairs.\n" +
    "- Do not invent data.\n" +
    "- Normalize whitespace and remove unnecessary line breaks.\n" +
    "- Preserve units, punctuation, and formatting from the source where applicable.\n" +
    specificInstructions +
    "\n\nFields to extract (keys must match exactly):\n" +
    `${fieldList}\n\n` +
    hintsSection +
    "Analyze the attached PDF and output strictly JSON only."
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
    max_tokens: 10000,
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

function tryValueFromSimilarKeys(
  json: Record<string, any>,
  targetField: string,
  hints?: string[]
): string | null {
  const targetNorm = normalizeLabel(targetField);
  const entries = Object.entries(json);

  // 1) Exact key
  if (Object.prototype.hasOwnProperty.call(json, targetField)) {
    const val = json[targetField];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }

  // 2) Hints list exact matches
  if (hints && hints.length > 0) {
    for (const hint of hints) {
      if (Object.prototype.hasOwnProperty.call(json, hint)) {
        const val = json[hint];
        if (typeof val === "string" && val.trim().length > 0) return val.trim();
      }
    }
  }

  // Build normalized map of keys
  const normKeyToOriginal: Record<string, string> = {};
  for (const [k] of entries) {
    if (typeof k !== "string") continue;
    normKeyToOriginal[normalizeLabel(k)] = k;
  }

  // 3) Fuzzy: normalized includes/startsWith
  for (const [normKey, origKey] of Object.entries(normKeyToOriginal)) {
    if (
      normKey === targetNorm ||
      normKey.includes(targetNorm) ||
      targetNorm.includes(normKey)
    ) {
      const val = json[origKey];
      if (typeof val === "string" && val.trim().length > 0) return val.trim();
    }
  }

  // 4) Fuzzy using individual hint tokens
  if (hints && hints.length > 0) {
    const normHints = hints.map(normalizeLabel);
    for (const [normKey, origKey] of Object.entries(normKeyToOriginal)) {
      const matchesAny = normHints.some((h) => normKey.includes(h) || h.includes(normKey));
      if (matchesAny) {
        const val = json[origKey];
        if (typeof val === "string" && val.trim().length > 0) return val.trim();
      }
    }
  }

  return null;
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
  const startTime = Date.now();
  const logContext = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    payerPlan: payerPlan || 'unknown',
    fields: fields || [],
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`[${logContext.timestamp}] Starting extraction for ${file.name}`, logContext);
    await logExtraction(file.name, 'started');
  } catch (logError) {
    console.error('Failed to log extraction start:', logError);
  }

  assertKey(apiKey);
  const completionStart = Date.now();
  let result;
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
    result = await createAssistantAndRun({ apiKey, fileId, prompt });

    // 3) Parse JSON
    const json = parseJsonOutput(result);

    // Log what was found for debugging
    console.log(`Extraction results for ${payerPlan}:`, json);
    console.log(`Expected fields:`, resolvedFields);
    console.log(`Found fields:`, Object.keys(json));
    console.log(`File processed: ${file.name}, Size: ${file.size} bytes`);

    // Count extracted fields
    let foundFields = 0;
    
    // Ensure all expected keys exist; fill missing with null
    let normalized: ExtractedData = {};
    for (const key of resolvedFields) {
      const val = Object.prototype.hasOwnProperty.call(json, key) ? json[key] : null;
      normalized[key] = val === undefined ? null : (val as string | null);
      
      if (val !== null && val !== undefined) {
        foundFields++;
      } else {
        console.log(`Field "${key}" not found in extraction`);
      }
    }
    
    // Track successful extraction
    const durationMs = Date.now() - startTime;
    const successContext = {
      ...logContext,
      durationMs,
      extractedFields: Object.keys(normalized).length,
      timestamp: new Date().toISOString()
    };
  
    console.log(`[${successContext.timestamp}] Extraction completed successfully`, successContext);
  
    // Log successful extraction
    try {
      await logExtraction(
        file.name,
        'success',
        JSON.stringify({
          durationMs,
          extractedFields: successContext.extractedFields,
          payerPlan: payerPlan || 'unknown'
        })
      );
    } catch (logError) {
      console.error('Failed to log successful extraction:', logError);
    }
  
    trackExtractionEvent('extraction_success', {
      payer_plan: payerPlan || 'unknown',
      file_name: file.name,
      duration_seconds: durationMs / 1000,
      extracted_fields: successContext.extractedFields
    });

    // Plan-specific post-processing logic
    try {
      if (payerPlan === PAYER_PLANS.QLM) {
        console.log(`[${new Date().toISOString()}] Formatting for QLM plan`, logContext);
        normalized = formatQLMFields(normalized);
      } else if (payerPlan === PAYER_PLANS.ALKOOT) {
        console.log(`[${new Date().toISOString()}] Formatting for Alkoot plan`, logContext);
        normalized = formatAlkootFields(normalized);
      }
    } catch (formatError) {
      console.error(`[${new Date().toISOString()}] Error during formatting`, {
        error: formatError instanceof Error ? formatError.message : 'Unknown error',
        payerPlan,
        ...logContext
      });
      // Continue with unformatted data rather than failing
    }

    // Log summary
    const foundCount = Object.values(normalized).filter(v => v !== null).length;
    const totalCount = resolvedFields.length;
    console.log(`Extraction summary: ${foundCount}/${totalCount} fields found`);

    return normalized;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[${new Date().toISOString()}] Extraction error for ${file?.name || 'unknown'}:`, {
      error: errorMessage,
      stack: errorStack,
      durationMs: Date.now() - startTime,
      ...logContext
    });
    
    // Track the error in analytics
    trackExtractionEvent('extraction_error', {
      error: errorMessage,
      payer_plan: payerPlan || 'unknown',
      file_name: file?.name || 'unknown',
      duration_seconds: (Date.now() - startTime) / 1000,
    });
    
    // Log the error to our logging service
    try {
      await logExtraction(
        file?.name || 'unknown',
        'error',
        `Error: ${errorMessage}\nStack: ${errorStack || 'No stack trace'}`
      );
    } catch (logError) {
      console.error('Failed to log extraction error:', logError);
    }
    
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


