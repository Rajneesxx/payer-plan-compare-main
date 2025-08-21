import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Zap, ArrowRight, Info, Search, Plus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PayerPlanSelector } from "@/components/PayerPlanSelector";
import { PDFUploader } from "@/components/PDFUploader";
import { ExtractedDataTable } from "@/components/ExtractedDataTable";
import { useToast } from "@/hooks/use-toast";
import { PAYER_PLANS, FIELD_MAPPINGS, FIELD_SUGGESTIONS, type PayerPlan, type ExtractedData, type ComparisonResult } from "@/constants/fields";
import { extractDataApi, compareDataApi } from "@/services/extractionApi";
import { cn } from "@/lib/utils";
import { extractDataApi } from "@/services/extractDataApi";
import { copyToClipboard, downloadJSON } from "@/lib/utils";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<object | null>(null);

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF first.");
    setLoading(true);

    try {
      // Example: pass payer + fields
      const extracted = await extractDataApi(file, "BlueCross", ["ClaimID", "Amount"]);
      setResult(extracted);
    } catch (err) {
      console.error("Extraction failed:", err);
      alert("Failed to extract data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">PDF Extractor</h1>

      {/* File input */}
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Extracting..." : "Extract Data"}
      </button>

      {/* Show results */}
      {result && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Extracted Data</h2>
          <pre className="bg-black text-white p-2 rounded overflow-x-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>

          <div className="flex gap-3 mt-3">
            <button
              onClick={() => copyToClipboard(result)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Copy
            </button>
            <button
              onClick={() => downloadJSON(result)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


const Index = () => {
  const [openAiKey, setOpenAiKey] = useState<string>("");
  const [payerPlan, setPayerPlan] = useState<PayerPlan>(PAYER_PLANS.QLM);
  const [uploadMode, setUploadMode] = useState<'single' | 'compare'>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[] | null>(null);
  const [customPlanName, setCustomPlanName] = useState<string>("");
  const [customFields, setCustomFields] = useState<string[]>([""]);
  
  const resolvedCustomFields = customFields.filter(field => field.trim() !== "");
  
  const { toast } = useToast();

  const addCustomField = () => {
    setCustomFields([...customFields, ""]);
  };

  const removeCustomField = (index: number) => {
    if (customFields.length > 1) {
      setCustomFields(customFields.filter((_, i) => i !== index));
    }
  };

  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one PDF file to extract data.",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === 'compare' && files.length < 2) {
      toast({
        title: "Two files required",
        description: "Please upload two PDF files for comparison.",
        variant: "destructive",
      });
      return;
    }

    if (!openAiKey) {
      toast({
        title: "Missing Rapid-Secret key",
        description: "Please enter your Rapid-secret key to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      toast({
        title: "Processing started",
        description: `Extracting data from ${files.length} file${files.length > 1 ? 's' : ''}...`,
      });

      if (uploadMode === 'single') {
        const data = await extractDataApi({
          file: files[0],
          apiKey: openAiKey,
          fields: resolvedCustomFields.length > 0 ? resolvedCustomFields : undefined,
          payerPlan: resolvedCustomFields.length === 0 ? payerPlan : undefined,
          payerPlanName: customPlanName || undefined,
        });

        setExtractedData(data);
        setComparisonResults(null);

        toast({
          title: "Extraction completed",
          description: `Successfully extracted data from ${files[0].name}`,
        });
      } else {
        const results = await compareDataApi({
          file1: files[0],
          file2: files[1],
          apiKey: openAiKey,
          fields: resolvedCustomFields.length > 0 ? resolvedCustomFields : undefined,
          payerPlan: resolvedCustomFields.length === 0 ? payerPlan : undefined,
          payerPlanName: customPlanName || undefined,
        });

        setComparisonResults(results);
        setExtractedData(null);

        toast({
          title: "Comparison completed",
          description: `Successfully compared ${files[0].name} and ${files[1].name}`,
        });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "An error occurred while processing the PDF files. Please check your OpenAI API key and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcess = files.length > 0 && (uploadMode === 'single' || files.length === 2);
  const hasResults = Boolean(extractedData || comparisonResults);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="rounded-3xl bg-foreground/5 shadow-lg ring-1 ring-black/5 p-6 backdrop-blur-sm">
        {/* Header */}
        <div className="mb-10">
  <div className="mx-auto w-fit rounded-3xl bg-foreground/5 backdrop-blur-sm">
    <div className="flex flex-col items-center bg-white/80 px-6 py-4 rounded-2xl shadow-md border border-border">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-[hsl(var(--brand-gray))]">Rapid</span>
          <span className="ml-1 text-[hsl(var(--brand-orange))]">Extractor</span>
        </h1>
        <p className="text-sm text-muted-foreground">Helps you instantly extract and structure data from complex PDFs.</p>
        <p className="text-sm text-muted-foreground">The tool processes files in real-time; no setup, no hassle</p>
        <p className="text-sm text-muted-foreground">so you can quickly turn unstructured PDFs into structured data</p>
        <p className="text-sm text-muted-foreground">for analysis, comparison, or automation.</p>
      </div>
    </div>
  </div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card shadow-md border border-border/70">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Configuration/Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key" className="text-sm font-medium text-foreground">
                    Rapid-Secret Key
                  </Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="Enter your Rapid-Secret key"
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    className="w-full bg-card border-border shadow-sm"
                  />
                </div>
                
                <Separator />
                
                <PayerPlanSelector
                  value={payerPlan}
                  onValueChange={setPayerPlan}
                />
                
                <Separator />
                
                <PDFUploader
                  mode={uploadMode}
                  onModeChange={setUploadMode}
                  files={files}
                  onFilesChange={setFiles}
                  isLoading={isProcessing}
                />
                
                <Button
                  onClick={handleExtract}
                  disabled={!canProcess || isProcessing}
                  className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200 rounded-lg"
                  size="lg"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      {uploadMode === 'single' ? 'Extract Data' : 'Compare Files'}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Field Preview */}
            <Card className="bg-card shadow-md border border-border/70">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  {resolvedCustomFields.length > 0 ? `Custom Fields (${resolvedCustomFields.length})` : `Expected Fields (${FIELD_MAPPINGS[payerPlan].length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TooltipProvider>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(resolvedCustomFields.length > 0 ? resolvedCustomFields : FIELD_MAPPINGS[payerPlan]).map((field, index) => {
                      const suggestions = FIELD_SUGGESTIONS[payerPlan]?.[field] || [];
                      return (
                        <div key={field} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div className="text-sm font-medium text-foreground">
                            {index + 1}. {field}
                          </div>
                          {suggestions.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="View alternative names">
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <div className="mb-1 font-medium text-foreground">Also look for</div>
                                  <ul className="list-disc pl-4 space-y-0.5">
                                    {suggestions.map((s, idx) => (
                                      <li key={idx} className="text-muted-foreground">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          {!hasResults ? (
            <div className="lg:col-span-1 space-y-6">
              {/* Custom Plan + Fields */}
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-lg">Custom Extraction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-plan" className="text-sm font-medium text-foreground">
                      Payer Plan Name
                    </Label>
                    <Input 
                      id="custom-plan" 
                      placeholder="Enter payer plan name (e.g., QLM, ALKOOT, OTHER)" 
                      value={customPlanName} 
                      onChange={(e) => setCustomPlanName(e.target.value)} 
                      className="w-full bg-card border-border shadow-sm" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground">
                        Fields to extract ({resolvedCustomFields.length})
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomField}
                        className="h-8 px-3"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Field
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customFields.map((field, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            placeholder={`Field ${index + 1} (e.g., Patient Name, Policy Number, etc.)`}
                            value={field}
                            onChange={(e) => updateCustomField(index, e.target.value)}
                            className="flex-1 bg-card border-border shadow-sm"
                          />
                          {customFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCustomField(index)}
                              className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      If provided, these fields will be used instead of the preset mapping. Add multiple fields using the "Add Field" button.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Empty state when no results */}
              <Card className="bg-card/60 shadow-md border-dashed border-2 border-border/80">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No data extracted yet
                  </h3>
                  <p className="text-muted-foreground">
                    Upload PDF files and click "Extract Data" or "Compare Files" to see results here.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="lg:col-span-1">
              {extractedData && (
                <ExtractedDataTable
                  mode="single"
                  data={extractedData}
                  fileName={files[0]?.name}
                  payerPlan={payerPlan}
                />
              )}
              {comparisonResults && (
                <ExtractedDataTable
                  mode="compare"
                  comparisonData={comparisonResults}
                  fileNames={[files[0]?.name, files[1]?.name]}
                  payerPlan={payerPlan}
                />
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};


