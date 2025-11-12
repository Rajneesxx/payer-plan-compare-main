/**
 * SIMPLIFIED PDF EXTRACTION
 * 
 * Simple approach:
 * 1. Extract text from PDF using pdfjs-dist
 * 2. Send text to OpenAI with extraction prompt
 * 3. Parse and return results
 */

import { FIELD_MAPPINGS, PAYER_PLANS, type PayerPlan, type ExtractedData } from "@/constants/fields";
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o"; // Using gpt-4o for reliability

function assertKey(apiKey?: string) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
  return apiKey;
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(file: File): Promise<string> {
  console.log('[PDF Parser] Starting text extraction...');
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  console.log(`[PDF Parser] Total pages: ${pdf.numPages}`);
  
  let fullText = '';
  
  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Combine all text items
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    fullText += `\n\n=== PAGE ${pageNum} ===\n\n${pageText}`;
  }
  
  console.log(`[PDF Parser] Extracted ${fullText.length} characters`);
  return fullText;
}

/**
 * Call OpenAI API to extract fields
 */
async function extractFieldsWithOpenAI(
  pdfText: string,
  fieldsToExtract: string[],
  apiKey: string
): Promise<Record<string, any>> {
  console.log('[OpenAI] Sending extraction request...');
  
  const prompt = `You are a data extraction expert. Extract the following fields from the insurance policy document text below.

FIELDS TO EXTRACT:
${fieldsToExtract.map((field, idx) => `${idx + 1}. ${field}`).join('\n')}

IMPORTANT RULES:
1. Extract ONLY the actual values, not descriptions or explanations
2. If a field has multiple values (like different hospital co-payments), list them clearly
3. For co-insurance/deductible fields, extract the percentage or amount (e.g., "20%", "QAR 100")
4. For coverage amounts, extract the number with currency (e.g., "QAR 7,500", "Unlimited")
5. If a field is not found or not applicable, return "Not Found"
6. Be precise - extract exactly what's stated in the document

DOCUMENT TEXT:
${pdfText}

OUTPUT FORMAT:
Return a JSON object where keys are the field names and values are the extracted data.
Example:
{
  "Policy Number": "12345",
  "Category": "Premium",
  "Co-insurance": "20%",
  "Dental Benefit": "QAR 7,500, 20% co-insurance, nil deductible"
}

Now extract the fields:`;

  const response = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  console.log('[OpenAI] Response received:', content);
  
  return JSON.parse(content);
}

/**
 * Main extraction function - SIMPLIFIED
 */
export async function extractDataApi({
  file,
  payerPlan,
  apiKey,
}: {
  file: File;
  payerPlan: PayerPlan;
  apiKey?: string;
}): Promise<ExtractedData> {
  console.log('\n=== SIMPLIFIED EXTRACTION START ===');
  console.log('File:', file.name);
  console.log('Payer Plan:', payerPlan);
  
  const key = assertKey(apiKey);
  const startTime = Date.now();

  try {
    // Step 1: Extract text from PDF
    const pdfText = await extractTextFromPDF(file);
    
    // Step 2: Get fields to extract
    const fieldsMapping = FIELD_MAPPINGS[payerPlan];
    if (!fieldsMapping) {
      throw new Error(`No field mappings found for payer plan: ${payerPlan}`);
    }
    
    const fieldsToExtract = Object.keys(fieldsMapping);
    console.log(`[Extraction] Extracting ${fieldsToExtract.length} fields`);
    
    // Step 3: Extract fields using OpenAI
    const extractedData = await extractFieldsWithOpenAI(pdfText, fieldsToExtract, key);
    
    // Step 4: Normalize the results
    const normalized: ExtractedData = {};
    for (const field of fieldsToExtract) {
      const value = extractedData[field];
      normalized[field] = value && value !== "Not Found" ? String(value) : null;
    }
    
    const processingTime = Date.now() - startTime;
    const foundCount = Object.values(normalized).filter(v => v !== null).length;
    const totalCount = fieldsToExtract.length;
    const successRate = Math.round((foundCount / totalCount) * 100);
    
    console.log(`\n=== EXTRACTION COMPLETE ===`);
    console.log(`Found: ${foundCount}/${totalCount} fields (${successRate}%)`);
    console.log(`Processing time: ${processingTime}ms`);
    console.log('Results:', normalized);
    
    return normalized;
    
  } catch (error) {
    console.error('[Extraction] Failed:', error);
    throw error;
  }
}

/**
 * Compare data - simplified placeholder
 */
export async function compareDataApi(): Promise<any> {
  throw new Error('Compare function not implemented in simplified version');
}

