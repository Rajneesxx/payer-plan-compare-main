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

  const resolvedCustomFields = customFields.filter((f) => f.trim() !== "");
  const { toast } = useToast();

  const addCustomField = () => setCustomFields([...customFields, ""]);
  const removeCustomField = (index: number) => customFields.length > 1 && setCustomFields(customFields.filter((_, i) => i !== index));
  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  const exportJson = (data: unknown, filename: string) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `Saved as ${filename}` });
    } catch {
      toast({ title: "Download failed", description: "Could not generate JSON.", variant: "destructive" });
    }
  };

  const copyJson = async (data: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({ title: "Copied!", description: "Data copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy.", variant: "destructive" });
    }
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({ title: "No files", description: "Please upload PDFs.", variant: "destructive" });
      return;
    }
    if (uploadMode === "compare" && files.length < 2) {
      toast({ title: "Two files required", description: "Upload 2 PDFs to compare.", variant: "destructive" });
      return;
    }
    if (!openAiKey) {
      toast({ title: "Missing key", description: "Enter Rapid-Secret key.", variant: "destructive" });
      return;
    }

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
        toast({ title: "Extraction completed", description: `Extracted data from ${files[0].name}` });
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
        toast({ title: "Comparison completed", description: `Compared ${files[0].name} & ${files[1].name}` });
      }
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Error processing PDFs.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcess = files.length > 0 && (uploadMode === "single" || files.length === 2);
  const hasResults = Boolean(extractedData || comparisonResults);
  const isCustom = payerPlan === PAYER_PLANS.CUSTOM;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="rounded-3xl bg-foreground/5 shadow-lg ring-1 ring-black/5 p-6 backdrop-blur-sm">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="text-[hsl(var(--brand-gray))]">Rapid</span>
              <span className="ml-1 text-[hsl(var(--brand-orange))]">Extractor</span>
            </h1>
            <p className="text-sm text-muted-foreground">Instantly extract and structure data from PDFs.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel */}
            <div className="space-y-6">
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> Configuration / Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Rapid-Secret Key"
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    className="w-full bg-card border-border shadow-sm"
                  />

                  <Separator />

                  <PayerPlanSelector
                    value={payerPlan}
                    onValueChange={setPayerPlan}
                    options={[
                      { value: PAYER_PLANS.QLM, label: "QLM" },
                      { value: PAYER_PLANS.ALKOOT, label: "ALKOOT" },
                      { value: PAYER_PLANS.CUSTOM, label: "Custom Extraction" },
                    ]}
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
                    className="w-full bg-gradient-primary rounded-lg flex items-center justify-center gap-2"
                  >
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Custom Fields or Preset Fields */}
              {isCustom ? (
                <Card className="bg-card shadow-md border border-border/70">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" /> Custom Fields ({resolvedCustomFields.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      placeholder="Custom Payer Plan Name"
                      value={customPlanName}
                      onChange={(e) => setCustomPlanName(e.target.value)}
                      className="w-full bg-card border-border shadow-sm"
                    />
                    {customFields.map((f, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder={`Field ${idx + 1}`}
                          value={f}
                          onChange={(e) => updateCustomField(idx, e.target.value)}
                          className="flex-1 bg-card border-border shadow-sm"
                        />
                        {customFields.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeCustomField(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                      <Plus className="h-3 w-3 mr-1" /> Add Field
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card shadow-md border border-border/70">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" /> Expected Fields ({FIELD_MAPPINGS[payerPlan].length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TooltipProvider>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {FIELD_MAPPINGS[payerPlan].map((f, idx) => (
                          <div key={f} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <div className="text-sm font-medium text-foreground">{idx + 1}. {f}</div>
                            {FIELD_SUGGESTIONS[payerPlan]?.[f]?.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                    <Info className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="mb-1 font-medium text-foreground">Also look for</div>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                      {FIELD_SUGGESTIONS[payerPlan][f].map((s, i) => (
                                        <li key={i} className="text-muted-foreground">{s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ))}
                      </div>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              )}

              {/* Results */}
              {hasResults ? (
                <>
                  {extractedData && (
                    <div className="space-y-4">
                      <ExtractedDataTable mode="single" data={extractedData} fileName={files[0]?.name} payerPlan={payerPlan} />
                      <Button onClick={() => exportJson(extractedData, "extracted.json")} className="bg-gradient-primary">Download JSON</Button>
                      <Button variant="outline" onClick={() => copyJson(extractedData)}>Copy JSON</Button>
                    </div>
                  )}
                  {comparisonResults && (
                    <div className="space-y-4">
                      <ExtractedDataTable mode="compare" comparisonData={comparisonResults} fileNames={[files[0]?.name, files[1]?.name]} payerPlan={payerPlan} />
                      <Button onClick={() => exportJson(comparisonResults, "comparison.json")} className="bg-gradient-primary">Download JSON</Button>
                      <Button variant="outline" onClick={() => copyJson(comparisonResults)}>Copy JSON</Button>
                    </div>
                  )}
                </>
              ) : (
                <Card className="bg-card/60 shadow-md border-dashed border-2 border-border/80">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No data extracted yet</h3>
                    <p className="text-muted-foreground">Upload PDFs and click "Extract Data" or "Compare Files" to see results.</p>
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
