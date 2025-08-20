// OpenAI extraction service using Responses API with attachments + file_search
// Minimal public surface retained: extractDataApi and compareDataApi
import { FIELD_MAPPINGS, PAYER_PLANS, type PayerPlan, type ExtractedData, type ComparisonResult } from "@/constants/fields";
import { FIELD_SUGGESTIONS } from "@/constants/fields";

const OPENAI_BASE = "https://api.openai.com/v1";

function assertKey(apiKey?: string) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
}

function buildPrompt(fields: string[], fieldHints?: Record<string, string[]>): string {
  const fieldList = fields.map((f) => `- ${f}`).join("\n");
  const hintsSection = fieldHints
    ? "\nField hints (use these to find semantically similar values, but OUTPUT KEYS MUST MATCH EXACTLY):\n" +
      fields
        .map((f) => {
          const hints = fieldHints[f];
          if (!hints || hints.length === 0) return `- ${f}: (no hints)`;
          return `- ${f}: also look for → ${hints.join(", ")}`;
        })
        .join("\n") +
      "\n"
    : "";
  return (
    "You are a precise information extraction engine capable of processing PDF documents, including scanned PDFs with OCR.\n" +
    "Task: Extract the following fields from the attached PDF document.\n" +
    "Rules:\n" +
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
    "- Preserve units, punctuation, and formatting from the source where applicable.\n\n" +
    "Fields to extract (keys must match exactly):\n" +
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
    max_tokens: 1500,
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
  assertKey(apiKey);

  try {
    // 1) Upload file
    const fileId = await uploadFileToOpenAI(file, apiKey);

    // 2) Resolve fields
    const resolvedFields = (fields && fields.length > 0)
      ? fields
      : (payerPlan ? FIELD_MAPPINGS[payerPlan] : []);
    if (!resolvedFields || resolvedFields.length === 0) {
      throw new Error("No fields provided to extract.");
    }
    const prompt = buildPrompt(
      resolvedFields,
      payerPlan ? FIELD_SUGGESTIONS[payerPlan] : undefined
    );
    const response = await createAssistantAndRun({ apiKey, fileId, prompt });

    // 3) Parse JSON
    const json = parseJsonOutput(response);

    // Log what was found for debugging
    console.log(`Extraction results for ${payerPlan}:`, json);
    console.log(`Expected fields:`, fields);
    console.log(`Found fields:`, Object.keys(json));

    // Ensure all expected keys exist; fill missing with null
    const normalized: ExtractedData = {};
    for (const key of resolvedFields) {
      const val = Object.prototype.hasOwnProperty.call(json, key) ? json[key] : null;
      normalized[key] = val === undefined ? null : (val as string | null);
      
      // Log missing fields for debugging
      if (val === null || val === undefined) {
        console.log(`Field "${key}" not found in extraction`);
      }
    }

    // Plan-specific defaulting logic
    if (payerPlan === PAYER_PLANS.ALKOOT) {
      const providerSpecific = "Provider-specific co-insurance at Al Ahli Hospital";
      const generalInpatient = "Co-insurance on all inpatient treatment";
      const providerVal = normalized[providerSpecific];
      const generalVal = normalized[generalInpatient];
      if ((providerVal === null || providerVal === "") && (typeof generalVal === "string" && generalVal.trim().length > 0)) {
        normalized[providerSpecific] = generalVal;
        console.log(`Defaulted "${providerSpecific}" to value of "${generalInpatient}":`, generalVal);
      }
    }

    if (payerPlan === PAYER_PLANS.QLM) {
      const hospitalField = "For Eligible Medical Expenses at Al Ahli Hospital";
      const current = normalized[hospitalField];
      if (current === null || current === "") {
        // 1) Try direct/fuzzy/hints based extraction
        const hints = FIELD_SUGGESTIONS[PAYER_PLANS.QLM]?.[hospitalField] || [];
        const fromSimilar = tryValueFromSimilarKeys(json, hospitalField, hints);
        if (fromSimilar) {
          normalized[hospitalField] = fromSimilar;
          console.log(`Filled "${hospitalField}" via similar key lookup:`, fromSimilar);
        } else {
          // 2) Try hospital-specific heuristic
          const inferred = findHospitalSpecificCoverage(json);
          if (inferred) {
            normalized[hospitalField] = inferred;
            console.log(`Heuristically inferred "${hospitalField}" from raw JSON key(s):`, inferred);
          } else {
            // 3) Fall back to general co-insurance/coverage
            const general = findGeneralCoinsuranceOrCoverage(json);
            if (general) {
              normalized[hospitalField] = general;
              console.log(`Defaulted "${hospitalField}" from general coverage/co-insurance:`, general);
            }
          }
        }

        // 4) If still missing, default to NIL
        const finalVal = normalized[hospitalField];
        if (finalVal === null || finalVal === undefined || finalVal === "") {
          normalized[hospitalField] = "NIL";
          console.log(`Defaulted "${hospitalField}" to NIL`);
        }
      }
    }

    // Log summary
    const foundCount = Object.values(normalized).filter(v => v !== null).length;
    const totalCount = resolvedFields.length;
    console.log(`Extraction summary: ${foundCount}/${totalCount} fields found`);

    return normalized;
  } catch (error) {
    // Fallback: if assistants API fails, try with simple chat completion
    // (This won't work with PDFs but provides a fallback)
    console.warn("Assistants API failed, falling back to chat completion:", error);
    
    const resolvedFields = (fields && fields.length > 0)
      ? fields
      : (payerPlan ? FIELD_MAPPINGS[payerPlan] : []);
    const prompt = buildPrompt(
      resolvedFields,
      payerPlan ? FIELD_SUGGESTIONS[payerPlan] : undefined
    ) + "\n\nNote: Unable to process file attachment. Please provide the document content as text.";
    const response = await callChatCompletion({ apiKey, prompt });
    const json = parseJsonOutput(response);

    const normalized: ExtractedData = {};
    for (const key of resolvedFields) {
      normalized[key] = null; // Set all to null since we can't process the file
    }

    return normalized;
  }
}

export async function compareDataApi({
  file1,
  file2,
  apiKey,
  fields,
  payerPlan,
  payerPlanName,
}: {
  file1: File;
  file2: File;
  apiKey: string;
  fields?: string[];
  payerPlan?: PayerPlan;
  payerPlanName?: string;
}): Promise<ComparisonResult[]> {
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
