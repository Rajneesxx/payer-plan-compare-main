# PDF to Markdown Conversion Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Upload PDF File │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Enter API Key    │
                    └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONVERSION PROCESS                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Validate Input  │
                    │  - Check API key │
                    │  - Verify PDF    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Convert to Base64│
                    │  fileToBase64()  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Build Request   │
                    │  - Model: gpt-4o │
                    │  - Temp: 0       │
                    │  - Max: 16000    │
                    └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OPENAI API PROCESSING                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Send to GPT-4o │
                    │   with Prompt    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  AI Analysis:    │
                    │  1. Read PDF     │
                    │  2. Identify     │
                    │     structure    │
                    │  3. Parse tables │
                    │  4. Filter H/F   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Generate        │
                    │  Markdown Output │
                    └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT PROCESSING                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Receive Response │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Extract Content  │
                    │ from API result  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Return Markdown │
                    │  to Application  │
                    └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
          ┌──────────────┐      ┌──────────────┐
          │ Display Raw  │      │   Render     │
          │  Markdown    │      │   Preview    │
          └──────────────┘      └──────────────┘
                    │                    │
                    └─────────┬──────────┘
                              ▼
                    ┌──────────────────┐
                    │  User Actions:   │
                    │  - Download      │
                    │  - Copy          │
                    │  - View Stats    │
                    └──────────────────┘
```

---

## Detailed Step-by-Step Process

### Phase 1: Input Preparation

```
Step 1: User uploads PDF file
  ↓
Step 2: File is validated (type, size)
  ↓
Step 3: File is converted to Base64 encoding
  ↓
Step 4: Base64 data is prepared for API request
```

### Phase 2: API Request Construction

```
Create OpenAI API request with:
  
  • Model: "gpt-4o"
  • Temperature: 0 (deterministic)
  • Max Tokens: 16,000
  • Detail: "high" (for best quality)
  
  • Content:
    - Text prompt with instructions
    - PDF as base64 image_url
```

### Phase 3: AI Processing (Inside OpenAI)

```
GPT-4o analyzes the PDF:

1. PAGE DETECTION
   ├─ Identifies number of pages
   ├─ Separates page content
   └─ Maps page structure

2. HEADER IDENTIFICATION
   ├─ Detects header on page 1 → KEEP
   ├─ Detects headers on pages 2+ → REMOVE
   └─ Preserves important title info

3. FOOTER DETECTION
   ├─ Identifies page numbers → REMOVE
   ├─ Detects copyright notices → REMOVE
   ├─ Finds disclaimers at bottom → REMOVE
   └─ Removes all footer elements

4. TABLE PARSING
   ├─ Identifies table boundaries
   ├─ Extracts headers and rows
   ├─ Preserves cell content
   └─ Converts to Markdown format

5. CONTENT EXTRACTION
   ├─ Extracts body text
   ├─ Preserves formatting
   ├─ Maintains structure
   └─ Keeps lists and bullets

6. MARKDOWN GENERATION
   ├─ Creates proper headers (#, ##, ###)
   ├─ Formats tables (| separator)
   ├─ Preserves bold/italic
   └─ Outputs clean Markdown
```

### Phase 4: Response Processing

```
Receive API response:
  ↓
Extract markdown content from JSON
  ↓
Validate output (not empty, has content)
  ↓
Return to application
```

### Phase 5: Display & Actions

```
Application receives markdown:
  ↓
Display in two views:
  ├─ Raw view (code block)
  └─ Rendered view (HTML)
  ↓
Calculate statistics:
  ├─ Line count
  ├─ Table count
  └─ File size
  ↓
Enable actions:
  ├─ Download as .md file
  ├─ Copy to clipboard
  └─ Further processing
```

---

## Data Flow Diagram

```
┌─────────┐
│   PDF   │  Original document with multiple pages
└────┬────┘
     │
     │ (uploaded)
     ▼
┌─────────┐
│ Base64  │  Encoded representation
└────┬────┘
     │
     │ (sent to API)
     ▼
┌─────────┐
│ GPT-4o  │  AI model processes
└────┬────┘
     │
     │ (returns)
     ▼
┌─────────┐
│Markdown │  Clean, formatted text
└────┬────┘
     │
     ├─────────┬─────────┐
     │         │         │
     ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Display │ │Download│ │Process │
└────────┘ └────────┘ └────────┘
```

---

## Component Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Application Layer                       │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │        PDFMarkdownConverter.tsx                   │    │
│  │        (UI Component)                             │    │
│  │                                                    │    │
│  │  • File upload interface                          │    │
│  │  • API key management                             │    │
│  │  • Loading states                                 │    │
│  │  • Result display                                 │    │
│  │  • Action buttons                                 │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                        │
│                   │ calls                                  │
│                   ▼                                        │
│  ┌──────────────────────────────────────────────────┐    │
│  │        extractionApi.ts                           │    │
│  │        (Service Layer)                            │    │
│  │                                                    │    │
│  │  convertPDFToMarkdownApi()                        │    │
│  │    ↓                                              │    │
│  │  convertPDFToMarkdown()                           │    │
│  │    ↓                                              │    │
│  │  fileToBase64()                                   │    │
│  │    ↓                                              │    │
│  │  fetch(OpenAI API)                                │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                        │
└───────────────────┼────────────────────────────────────────┘
                    │
                    │ HTTP Request
                    ▼
┌───────────────────────────────────────────────────────────┐
│                   OpenAI API                               │
│                                                            │
│  • GPT-4o model                                           │
│  • Vision processing                                      │
│  • Markdown generation                                    │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

---

## Table Preservation Flow

```
PDF Table Input:
┌──────────────┬──────────────┬──────────────┐
│ Field Name   │ Value        │ Notes        │
├──────────────┼──────────────┼──────────────┤
│ Inpatient    │ QAR 500,000  │ Full cover   │
│ Outpatient   │ QAR 50,000   │ 90% co-ins   │
└──────────────┴──────────────┴──────────────┘

        ↓ AI Processing ↓

Markdown Table Output:
| Field Name | Value       | Notes      |
|------------|-------------|------------|
| Inpatient  | QAR 500,000 | Full cover |
| Outpatient | QAR 50,000  | 90% co-ins |

        ↓ Rendering ↓

Display:
┌──────────────┬──────────────┬──────────────┐
│ Field Name   │ Value        │ Notes        │
├──────────────┼──────────────┼──────────────┤
│ Inpatient    │ QAR 500,000  │ Full cover   │
│ Outpatient   │ QAR 50,000   │ 90% co-ins   │
└──────────────┴──────────────┴──────────────┘
```

---

## Header/Footer Processing Flow

```
PAGE 1:
┌─────────────────────────────────┐
│ [HEADER: Company | Title]       │ ← KEEP THIS
├─────────────────────────────────┤
│ Content...                      │ ← KEEP
├─────────────────────────────────┤
│ [FOOTER: Page 1 | Copyright]    │ ← REMOVE THIS
└─────────────────────────────────┘

PAGE 2:
┌─────────────────────────────────┐
│ [HEADER: Company | Title]       │ ← REMOVE THIS
├─────────────────────────────────┤
│ Content...                      │ ← KEEP
├─────────────────────────────────┤
│ [FOOTER: Page 2 | Copyright]    │ ← REMOVE THIS
└─────────────────────────────────┘

PAGE 3:
┌─────────────────────────────────┐
│ [HEADER: Company | Title]       │ ← REMOVE THIS
├─────────────────────────────────┤
│ Content...                      │ ← KEEP
├─────────────────────────────────┤
│ [FOOTER: Page 3 | Copyright]    │ ← REMOVE THIS
└─────────────────────────────────┘

        ↓ Processing ↓

OUTPUT MARKDOWN:
# Company | Title       (from page 1 header)

[Content from page 1]

[Content from page 2]

[Content from page 3]

(No footers, no duplicate headers)
```

---

## Error Handling Flow

```
Start Conversion
  ↓
Check API Key?
  ├─ No → Return Error: "Missing API key"
  └─ Yes ↓
     Check File Valid?
       ├─ No → Return Error: "Invalid file"
       └─ Yes ↓
          Convert to Base64?
            ├─ Fail → Return Error: "File read error"
            └─ Success ↓
               Send to API?
                 ├─ Network Error → Return Error: "Network failed"
                 ├─ API Error → Return Error: "API error: [details]"
                 └─ Success ↓
                    Parse Response?
                      ├─ Empty → Return Error: "No content"
                      └─ Success → Return Markdown ✓
```

---

## Performance Optimization

```
Sequential Processing:
PDF → Base64 → API → Response → Display
(Total: ~10 seconds)

Potential Optimization (Future):
PDF → Base64 ┬→ Chunk 1 → API
              ├→ Chunk 2 → API  } Parallel
              └→ Chunk 3 → API
                    ↓
              Merge Results → Display
(Total: ~4 seconds)
```

---

## Integration Points

```
Current System:
┌─────────┐
│   PDF   │
└────┬────┘
     │
     ▼
┌─────────┐
│ Extract │ (Current extraction flow)
│  Fields │
└────┬────┘
     │
     ▼
┌─────────┐
│ Display │
└─────────┘

With Markdown Converter:
┌─────────┐
│   PDF   │
└────┬────┘
     │
     ├──────────────┐
     │              │
     ▼              ▼
┌─────────┐   ┌──────────┐
│ Extract │   │ Markdown │ (New feature)
│  Fields │   │ Convert  │
└────┬────┘   └────┬─────┘
     │              │
     │              ├→ View
     │              ├→ Download
     │              └→ Process
     │
     ▼
┌─────────┐
│ Display │
└─────────┘
```

---

This flow diagram shows the complete journey from PDF input to Markdown output!

