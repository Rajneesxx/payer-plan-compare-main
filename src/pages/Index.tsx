// Index.tsx
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
  const presetSuggestions = FIELD_SUGGESTIONS[payerPlan] || {};

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="rounded-3xl bg-foreground/5 shadow-lg ring-1 ring-black/5 p-6 backdrop-blur-sm">
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-semibold">
              <span className="text-[hsl(var(--brand-gray))]">Rapid</span>
              <span className="ml-1 text-[hsl(var(--brand-orange))]">Extractor</span>
            </h1>
            <p className="text-sm text-muted-foreground">Extract and structure data from PDFs instantly.</p>
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
                  <Label htmlFor="openai-key">Rapid-Secret Key</Label>
                  <Input id="openai-key" type="password" value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} />

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

                  <Button onClick={handleExtract} disabled={!canProcess || isProcessing} className="w-full mt-2">
                    {isProcessing ? "Processing..." : uploadMode === "single" ? "Extract Data" : "Compare Files"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: always visible */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    {payerPlan === PAYER_PLANS.CUSTOM
                      ? `Custom Extraction (${resolvedCustomFields.length})`
                      : `Expected Fields (${presetFields.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto space-y-2">
                  <TooltipProvider>
                    {payerPlan === PAYER_PLANS.CUSTOM ? (
                      <>
                        <div>
                          <Label>Payer Plan Name</Label>
                          <Input
                            placeholder="Enter custom payer plan name"
                            value={customPlanName}
                            onChange={(e) => setCustomPlanName(e.target.value)}
                          />
                        </div>
                        <div className="mt-2">
                          <Label>Fields to extract ({customFields.length})</Label>
                          {customFields.map((field, idx) => (
                            <div key={idx} className="flex items-center gap-2 mt-1">
                              <Input
                                placeholder={`Field ${idx + 1}`}
                                value={field}
                                onChange={(e) => updateCustomField(idx, e.target.value)}
                                className="flex-1"
                              />
                              {customFields.length > 1 && (
                                <Button variant="ghost" size="sm" onClick={() => removeCustomField(idx)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={addCustomField} className="mt-2">
                            <Plus className="h-3 w-3 mr-1" /> Add Field
                          </Button>
                        </div>
                      </>
                    ) : (
                      presetFields.map((field: string, idx: number) => (
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
                      ))
                    )}
                  </TooltipProvider>
                </CardContent>
              </Card>

              {/* Results table */}
              {extractedData && <ExtractedDataTable mode="single" data={extractedData} fileName={files[0]?.name} payerPlan={payerPlan} />}
              {comparisonResults && (
                <ExtractedDataTable mode="compare" comparisonData={comparisonResults} fileNames={[files[0]?.name, files[1]?.name]} payerPlan={payerPlan} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
