/**
 * Demo script showing how to use the PDF to Markdown converter
 * 
 * Usage Example:
 * 
 * ```typescript
 * import { convertPDFToMarkdownApi } from '@/services/extractionApi';
 * 
 * // In your component or function
 * const handleConvert = async (file: File) => {
 *   const apiKey = 'your-openai-api-key';
 *   
 *   try {
 *     const markdown = await convertPDFToMarkdownApi(file, apiKey);
 *     console.log('Converted Markdown:', markdown);
 *     return markdown;
 *   } catch (error) {
 *     console.error('Conversion failed:', error);
 *     throw error;
 *   }
 * };
 * ```
 * 
 * Features:
 * - Preserves all tables exactly as they appear in the PDF
 * - Removes footers from all pages
 * - Keeps header only on the first page
 * - Removes headers from subsequent pages
 * - Returns clean, well-formatted Markdown
 * 
 * Output Format:
 * The function returns a string containing the full Markdown representation
 * of the PDF document. Tables are formatted using standard Markdown table syntax:
 * 
 * | Column 1 | Column 2 |
 * |----------|----------|
 * | Value 1  | Value 2  |
 * 
 * Example Output:
 * ```markdown
 * # Insurance Policy Document
 * 
 * ## Coverage Details
 * 
 * | Benefit Type | Coverage Amount |
 * |--------------|-----------------|
 * | Inpatient    | QAR 100,000     |
 * | Outpatient   | QAR 50,000      |
 * | Dental       | QAR 5,000       |
 * 
 * ## Terms and Conditions
 * 
 * - All claims must be submitted within 30 days
 * - Pre-authorization required for procedures over QAR 10,000
 * - Network providers offer cashless treatment
 * ```
 */

import { convertPDFToMarkdownApi } from '@/services/extractionApi';

/**
 * Test function to convert a PDF to Markdown
 * This is a sample implementation showing how to use the API
 */
export async function testPDFToMarkdown(file: File, apiKey: string): Promise<{
  success: boolean;
  markdown?: string;
  error?: string;
  stats: {
    fileSize: number;
    markdownLength?: number;
    tableCount?: number;
    lineCount?: number;
    processingTime: number;
  };
}> {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting PDF to Markdown conversion...');
    console.log(`📄 File: ${file.name}`);
    console.log(`📦 Size: ${(file.size / 1024).toFixed(2)} KB`);
    
    const markdown = await convertPDFToMarkdownApi(file, apiKey);
    
    const processingTime = Date.now() - startTime;
    const tableCount = (markdown.match(/\|/g) || []).length;
    const lineCount = markdown.split('\n').length;
    
    console.log('✅ Conversion successful!');
    console.log(`📝 Markdown length: ${markdown.length} characters`);
    console.log(`📊 Lines: ${lineCount}`);
    console.log(`🔢 Table separators found: ${tableCount}`);
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log('\n--- MARKDOWN OUTPUT START ---\n');
    console.log(markdown);
    console.log('\n--- MARKDOWN OUTPUT END ---\n');
    
    return {
      success: true,
      markdown,
      stats: {
        fileSize: file.size,
        markdownLength: markdown.length,
        tableCount: Math.floor(tableCount / 2), // Approximate table rows
        lineCount,
        processingTime,
      },
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error('❌ Conversion failed:', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      stats: {
        fileSize: file.size,
        processingTime,
      },
    };
  }
}

/**
 * Save markdown to a file (browser download)
 */
export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse markdown tables from the output
 */
export function parseMarkdownTables(markdown: string): Array<{
  headers: string[];
  rows: string[][];
}> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = markdown.split('\n');
  
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|')) {
      // Skip separator lines
      if (line.includes('---')) {
        continue;
      }
      
      const cells = line
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim());
      
      if (!inTable) {
        // Start new table with headers
        currentTable = { headers: cells, rows: [] };
        inTable = true;
      } else if (currentTable) {
        // Add row to current table
        currentTable.rows.push(cells);
      }
    } else if (inTable && currentTable) {
      // End of table
      tables.push(currentTable);
      currentTable = null;
      inTable = false;
    }
  }
  
  // Add last table if we ended while in one
  if (currentTable) {
    tables.push(currentTable);
  }
  
  return tables;
}

/**
 * Example usage in a React component:
 * 
 * const MyComponent = () => {
 *   const [markdown, setMarkdown] = useState('');
 *   
 *   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (!file) return;
 *     
 *     const apiKey = localStorage.getItem('openai_api_key');
 *     if (!apiKey) {
 *       alert('Please set your OpenAI API key');
 *       return;
 *     }
 *     
 *     const result = await testPDFToMarkdown(file, apiKey);
 *     if (result.success && result.markdown) {
 *       setMarkdown(result.markdown);
 *       
 *       // Optionally parse tables
 *       const tables = parseMarkdownTables(result.markdown);
 *       console.log('Extracted tables:', tables);
 *       
 *       // Optionally download
 *       downloadMarkdown(result.markdown, file.name.replace('.pdf', '.md'));
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <input type="file" accept=".pdf" onChange={handleFileUpload} />
 *       {markdown && <pre>{markdown}</pre>}
 *     </div>
 *   );
 * };
 */

