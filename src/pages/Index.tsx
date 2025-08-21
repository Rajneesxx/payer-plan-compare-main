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

  const resolvedCustomFields = customFields.filter((field) => field.trim() !== "");
  const { toast } = useToast();

  const addCustomField = () => setCustomFields([...customFields, ""]);
  const removeCustomField = (index: number) => {
    if (customFields.length > 1) setCustomFields(customFields.filter((_, i) => i !== index));
  };
  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  // JSON copy/download helpers
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
      toast({ title: "Download failed", description: "Could not generate the JSON file.", variant: "destructive" });
    }
  };

  const copyJson = async (data: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({ title: "Copied!", description: "Extracted data copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Please upload at least one PDF file.", variant: "destructive" });
      return;
    }
    if (uploadMode === "compare" && files.length < 2) {
      toast({ title: "Two files required", description: "Please upload two PDF files for comparison.", variant: "destructive" });
      return;
    }
    if (!openAiKey) {
      toast({ title: "Missing Rapid-Secret key", description: "Enter your Rapid-secret key to proceed.", variant: "destructive" });
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
        toast({ title: "Extraction completed", description: `Successfully extracted data from ${files[0].name}` });
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
        toast({ title: "Comparison completed", description: `Successfully compared ${files[0].name} and ${files[1].name}` });
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

                  <Button onClick={handleExtract} disabled={!canProcess || isProcessing} className="w-full bg-gradient-primary rounded-lg">
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                  </Button>

                  {/* Custom Fields panel only when Custom Extraction selected */}
                  {isCustom && (
                    <div className="mt-4 space-y-2">
                      <Input
                        placeholder="Custom Payer Plan Name"
                        value={customPlanName}
                        onChange={(e) => setCustomPlanName(e.target.value)}
                        className="w-full bg-card border-border shadow-sm"
                      />
                      {customFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            placeholder={`Field ${idx + 1}`}
                            value={field}
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Panel */}
            {hasResults && (
              <div className="space-y-4">
                {extractedData && (
                  <div className="space-y-4">
                    <ExtractedDataTable mode="single" data={extractedData} fileName={files[0]?.name} payerPlan={payerPlan} />
                    <Button onClick={() => exportJson(extractedData, "extracted.json")} className="bg-gradient-primary">
                      Download JSON
                    </Button>
                  </div>
                )}
                {comparisonResults && (
                  <div className="space-y-4">
                    <ExtractedDataTable mode="compare" comparisonData={comparisonResults} fileNames={[files[0]?.name, files[1]?.name]} payerPlan={payerPlan} />
                    <Button onClick={() => exportJson(comparisonResults, "comparison.json")} className="bg-gradient-primary">
                      Download JSON
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
