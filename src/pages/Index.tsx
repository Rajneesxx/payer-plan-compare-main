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
      console.error(err);
      toast({ title: "Download failed", description: "Could not generate JSON.", variant: "destructive" });
    }
  };

  const copyJson = async (data: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({ title: "Copied!", description: "Data copied to clipboard." });
    } catch (err) {
      console.error(err);
      toast({ title: "Copy failed", description: "Could not copy.", variant: "destructive" });
    }
  };

  const addCustomField = () => setCustomFields([...customFields, ""]);
  const removeCustomField = (i: number) => customFields.length > 1 && setCustomFields(customFields.filter((_, idx) => idx !== i));
  const updateCustomField = (i: number, val: string) => {
    const updated = [...customFields];
    updated[i] = val;
    setCustomFields(updated);
  };

  const handleExtract = async () => {
    if (files.length === 0 || (uploadMode === "compare" && files.length < 2) || !openAiKey) return;
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
      toast({ title: "Processing failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcess = files.length > 0 && (uploadMode === "single" || files.length === 2);
  const hasResults = Boolean(extractedData || comparisonResults);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="rounded-3xl bg-foreground/5 shadow-lg ring-1 ring-black/5 p-6 backdrop-blur-sm">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold">
              <span className="text-[hsl(var(--brand-gray))]">Rapid</span>
              <span className="ml-1 text-[hsl(var(--brand-orange))]">Extractor</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Instantly extract and structure data from complex PDFs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Configuration */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Configuration / Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">Rapid-Secret Key</Label>
                    <Input id="openai-key" type="password" value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} />
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

                  <PDFUploader mode={uploadMode} onModeChange={setUploadMode} files={files} onFilesChange={setFiles} isLoading={isProcessing} />

                  <Button onClick={handleExtract} disabled={!canProcess || isProcessing} className="w-full bg-gradient-primary">
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Fields Preview + Custom Extraction */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    {payerPlan === PAYER_PLANS.CUSTOM
                      ? `Custom Fields (${resolvedCustomFields.length})`
                      : `Expected Fields (${FIELD_MAPPINGS[payerPlan].length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TooltipProvider>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(payerPlan === PAYER_PLANS.CUSTOM ? resolvedCustomFields : FIELD_MAPPINGS[payerPlan]).map((field, index) => {
                        const suggestions = FIELD_SUGGESTIONS[payerPlan]?.[field] || [];
                        return (
                          <div key={field} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <div className="text-sm font-medium">{index + 1}. {field}</div>
                            {suggestions.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button aria-label="View alternative names">
                                    <Info className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <ul>{suggestions.map((s,i) => <li key={i}>{s}</li>)}</ul>
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

              {/* Custom Extraction panel only for custom */}
              {payerPlan === PAYER_PLANS.CUSTOM && (
                <Card className="bg-card shadow-md border border-border/70">
                  <CardHeader>
                    <CardTitle>Custom Extraction</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Input placeholder="Custom Plan Name" value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)} />
                    <div className="space-y-2">
                      {customFields.map((f, i) => (
                        <div key={i} className="flex gap-2">
                          <Input placeholder={`Field ${i+1}`} value={f} onChange={(e) => updateCustomField(i,e.target.value)} />
                          {customFields.length > 1 && <Button variant="ghost" onClick={() => removeCustomField(i)}><X /></Button>}
                        </div>
                      ))}
                      <Button onClick={addCustomField} size="sm"><Plus /> Add Field</Button>
                    </div>
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
