import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Zap, ArrowRight, Info, Search, Plus, X, Download, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PayerPlanSelector } from "@/components/PayerPlanSelector";
import { PDFUploader } from "@/components/PDFUploader";
import { ExtractedDataTable } from "@/components/ExtractedDataTable";
import { useToast } from "@/hooks/use-toast";
import {
  PAYER_PLANS,
  FIELD_MAPPINGS,
  FIELD_SUGGESTIONS,
  type PayerPlan,
  type ExtractedData,
  type ComparisonResult,
} from "@/constants/fields";
import { extractDataApi, compareDataApi } from "@/services/extractionApi";

const Index = () => {
  const [openAiKey, setOpenAiKey] = useState<string>("");
  const [payerPlan, setPayerPlan] = useState<PayerPlan>(PAYER_PLANS.QLM);
  const [uploadMode, setUploadMode] = useState<"single" | "compare">("single");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[] | null>(null);
  const [customPlanName, setCustomPlanName] = useState<string>("");
  const [customFields, setCustomFields] = useState<string[]>([""]);

  const { toast } = useToast();
  const resolvedCustomFields = customFields.filter((f) => f.trim() !== "");

  const addCustomField = () => setCustomFields([...customFields, ""]);
  const removeCustomField = (index: number) =>
    customFields.length > 1 && setCustomFields(customFields.filter((_, i) => i !== index));
  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  const handleExtract = async () => {
    if (!files.length) return toast({ title: "No files selected", variant: "destructive" });
    if (!openAiKey) return toast({ title: "Enter Rapid-Secret key", variant: "destructive" });
    if (uploadMode === "compare" && files.length < 2)
      return toast({ title: "Upload two files for comparison", variant: "destructive" });

    setIsProcessing(true);
    const isCustom = payerPlan === PAYER_PLANS.CUSTOM;

    try {
      if (uploadMode === "single") {
        const data = await extractDataApi({
          file: files[0],
          apiKey: openAiKey,
          fields: isCustom ? resolvedCustomFields : undefined,
          payerPlan: !isCustom ? payerPlan : undefined,
          payerPlanName: isCustom ? customPlanName : undefined,
        });
        setExtractedData(data);
        setComparisonResults(null);
      } else {
        const results = await compareDataApi({
          file1: files[0],
          file2: files[1],
          apiKey: openAiKey,
          fields: isCustom ? resolvedCustomFields : undefined,
          payerPlan: !isCustom ? payerPlan : undefined,
          payerPlanName: isCustom ? customPlanName : undefined,
        });
        setComparisonResults(results);
        setExtractedData(null);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Extraction failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcess = files.length > 0 && (uploadMode === "single" || files.length === 2);

  const presetFields = FIELD_MAPPINGS[payerPlan] || [];
  const presetSuggestions = FIELD_SUGGESTIONS[payerPlan] || [];

  const downloadData = () => {
    let dataToExport: any[] = [];
    if (extractedData) {
      dataToExport = Object.entries(extractedData).map(([key, value]) => ({ Field: key, Value: value }));
    } else if (comparisonResults) {
      dataToExport = comparisonResults.map((result, index) => ({
        Comparison: `File ${index + 1}`,
        ...result,
      }));
    }

    if (dataToExport.length === 0) return;

    // Helper function to properly escape CSV values
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // If the value contains comma, newline, or quotes, wrap it in quotes and escape internal quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csv = [
      Object.keys(dataToExport[0]).join(","),
      ...dataToExport.map((row) => 
        Object.values(row).map(escapeCsvValue).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted_data_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    let textToCopy = "";
    if (extractedData) {
      textToCopy = Object.entries(extractedData)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    } else if (comparisonResults) {
      textToCopy = comparisonResults
        .map((result, index) => `File ${index + 1}:\n${Object.entries(result).map(([k, v]) => `${k}: ${v}`).join("\n")}`)
        .join("\n\n");
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(
        () => toast({ title: "Copied to clipboard", variant: "default" }),
        () => toast({ title: "Failed to copy", variant: "destructive" })
      );
    }
  };
  // Reset 
  const handlePayerPlanChange = (value) => {
    if (value === PAYER_PLANS.CUSTOM) {
      setExtractedData(null);
      setComparisonResults(null);
      setCustomFields([""]);
      setCustomPlanName("");
    }
    setPayerPlan(value);
  };

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
            {/* Left Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> Configuration / Requirements
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
                    onValueChange={handlePayerPlanChange}
                    options={[
                      { value: PAYER_PLANS.QLM, label: "QLM" },
                      { value: PAYER_PLANS.ALKOOT, label: "ALKOOT" },
                      { value: PAYER_PLANS.CUSTOM, label: "Custom Input" },
                    ]}
                  />

                  {payerPlan === PAYER_PLANS.CUSTOM && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="custom-plan-name">Payer Plan Name</Label>
                        <Input
                          id="custom-plan-name"
                          placeholder="Enter your plan name:"
                          value={customPlanName}
                          onChange={(e) => setCustomPlanName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <PDFUploader mode={uploadMode} onModeChange={setUploadMode} files={files} onFilesChange={setFiles} isLoading={isProcessing} />

                  <Button onClick={handleExtract} disabled={!canProcess || isProcessing} className="w-full mt-2">
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {!extractedData && !comparisonResults && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      {payerPlan === PAYER_PLANS.CUSTOM
                        ? `Custom Extraction (${resolvedCustomFields.length})`
                        : `Expected Fields (${presetFields.length})`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto space-y-4">
                    <TooltipProvider>
                      {payerPlan === PAYER_PLANS.CUSTOM ? (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                Fields to Extract ({customFields.filter(f => f.trim()).length})
                              </Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={addCustomField}
                                className="h-8"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Field
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {customFields.map((field, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="text-xs text-muted-foreground w-6 flex-shrink-0">
                                    {idx + 1}.
                                  </div>
                                  <Input
                                    placeholder={`Field ${idx + 1} `}
                                    value={field}
                                    onChange={(e) => updateCustomField(idx, e.target.value)}
                                    className="flex-1 h-9"
                                  />
                                  {customFields.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCustomField(idx)}
                                      className="h-9 w-9 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {resolvedCustomFields.length > 0 && (
                              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Fields to be extracted:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {resolvedCustomFields.map((field, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                                      {field}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {presetFields.map((field: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                              <div className="flex-1">
                                {idx + 1}. {field}
                              </div>
                              {presetSuggestions[field]?.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground">
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <div className="font-medium mb-1">Also look for:</div>
                                      <ul className="list-disc pl-4">
                                        {presetSuggestions[field].map((s, i) => (
                                          <li key={i}>{s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TooltipProvider>
                  </CardContent>
                </Card>
              )}

              {(extractedData || comparisonResults) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Extracted Data
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" onClick={downloadData} disabled={!extractedData && !comparisonResults}>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                        <Button size="sm" onClick={copyToClipboard} disabled={!extractedData && !comparisonResults}>
                          <Copy className="h-4 w-4 mr-2" /> Copy
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {extractedData && <ExtractedDataTable mode="single" data={extractedData} fileName={files[0]?.name} payerPlan={payerPlan} />}
                    {comparisonResults && (
                      <ExtractedDataTable mode="compare" comparisonData={comparisonResults} fileNames={[files[0]?.name, files[1]?.name]} payerPlan={payerPlan} />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
