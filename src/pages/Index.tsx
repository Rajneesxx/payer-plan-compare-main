import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Zap, ArrowRight, Info, Plus, X } from "lucide-react";
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

  // ========== Helpers ==========
  const canProcess = files.length > 0 && (uploadMode === "single" || files.length === 2);
  const hasResults = Boolean(extractedData || comparisonResults);

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
    } catch (err) {
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

  // ========== Custom Fields Handlers ==========
  const addCustomField = () => setCustomFields([...customFields, ""]);
  const removeCustomField = (index: number) => setCustomFields(customFields.filter((_, i) => i !== index));
  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  // ========== Extraction Handler ==========
  const handleExtract = async () => {
    if (files.length === 0) return toast({ title: "No files selected", variant: "destructive" });
    if (uploadMode === "compare" && files.length < 2)
      return toast({ title: "Two files required", variant: "destructive" });
    if (!openAiKey) return toast({ title: "Missing Rapid-Secret key", variant: "destructive" });

    setIsProcessing(true);
    const isCustom = payerPlan === PAYER_PLANS.CUSTOM;

    try {
      toast({ title: "Processing started", description: `Extracting data from ${files.length} file(s)...` });

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
    } catch (error: any) {
      toast({ title: "Processing failed", description: error?.message || "Extraction error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

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
            <p className="text-sm text-muted-foreground">Helps you instantly extract and structure data from complex PDFs.</p>
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
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">Rapid-Secret Key</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="Enter your Rapid-Secret key"
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                    />
                  </div>

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

                  <Button onClick={handleExtract} disabled={!canProcess || isProcessing} className="w-full mt-2">
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Custom Fields Panel */}
              {payerPlan === PAYER_PLANS.CUSTOM && (
                <Card className="bg-card shadow-md border border-border/70">
                  <CardHeader>
                    <CardTitle>Custom Extraction Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      placeholder="Custom Plan Name"
                      value={customPlanName}
                      onChange={(e) => setCustomPlanName(e.target.value)}
                      className="mb-2 w-full"
                    />
                    {customFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <Input
                          placeholder={`Field ${idx + 1}`}
                          value={field}
                          onChange={(e) => updateCustomField(idx, e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeCustomField(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addCustomField}>
                      <Plus className="h-3 w-3 mr-1" /> Add Field
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Extracted Data / Comparison */}
              {hasResults ? (
                <>
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
                </>
              ) : (
                <Card className="bg-card/60 shadow-md border-dashed border-2 border-border/80 text-center py-16">
                  <FileText className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                  <p>No data extracted yet</p>
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
