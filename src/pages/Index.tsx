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
  const removeCustomField = (index: number) =>
    customFields.length > 1 && setCustomFields(customFields.filter((_, i) => i !== index));
  const updateCustomField = (index: number, value: string) => {
    const newFields = [...customFields];
    newFields[index] = value;
    setCustomFields(newFields);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Please upload at least one PDF file.", variant: "destructive" });
      return;
    }

    if (uploadMode === "compare" && files.length < 2) {
      toast({ title: "Two files required", description: "Please upload two PDFs for comparison.", variant: "destructive" });
      return;
    }

    if (!openAiKey) {
      toast({ title: "Missing Rapid-Secret key", description: "Enter your key to proceed.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    const isCustom = payerPlan === PAYER_PLANS.CUSTOM;

    try {
      toast({ title: "Processing started", description: `Processing ${files.length} file(s)...` });

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
        toast({ title: "Extraction completed", description: `Extracted from ${files[0].name}` });
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
      console.error(error);
      toast({ title: "Processing failed", description: error instanceof Error ? error.message : "Error processing PDFs", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const canProcess = files.length > 0 && (uploadMode === "single" || files.length === 2);
  const hasResults = Boolean(extractedData || comparisonResults);

  const fieldList = payerPlan === PAYER_PLANS.CUSTOM ? customFields : FIELD_MAPPINGS[payerPlan];

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
            <p className="text-sm text-muted-foreground">Extract and structure data from complex PDFs instantly.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel */}
            <div className="space-y-6">
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" /> Configuration / Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">Rapid-Secret Key</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="Enter your key"
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
              {/* Field Preview + Custom Fields merged */}
              <Card className="bg-card shadow-md border border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    {payerPlan === PAYER_PLANS.CUSTOM
                      ? `Custom Fields (${customFields.length})`
                      : `Expected Fields (${FIELD_MAPPINGS[payerPlan].length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto space-y-2">
                  <TooltipProvider>
                    {fieldList.map((field, index) => {
                      const suggestions = FIELD_SUGGESTIONS[payerPlan]?.[field] || [];
                      return (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-2">
                          <div className="flex-1">
                            {payerPlan === PAYER_PLANS.CUSTOM ? (
                              <Input
                                placeholder={`Field ${index + 1}`}
                                value={field}
                                onChange={(e) => updateCustomField(index, e.target.value)}
                              />
                            ) : (
                              <div className="text-sm font-medium text-foreground">{index + 1}. {field}</div>
                            )}
                          </div>

                          {suggestions.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground">
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <div className="font-medium text-foreground mb-1">Also look for:</div>
                                  <ul className="list-disc pl-4 space-y-0.5">
                                    {suggestions.map((s, idx) => (
                                      <li key={idx} className="text-muted-foreground">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {payerPlan === PAYER_PLANS.CUSTOM && customFields.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeCustomField(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}

                    {payerPlan === PAYER_PLANS.CUSTOM && (
                      <Button variant="outline" size="sm" onClick={addCustomField} className="mt-2">
                        <Plus className="h-3 w-3 mr-1" /> Add Field
                      </Button>
                    )}
                  </TooltipProvider>
                </CardContent>
              </Card>

              {/* Results */}
              {hasResults ? (
                extractedData ? (
                  <ExtractedDataTable mode="single" data={extractedData} fileName={files[0]?.name} payerPlan={payerPlan} />
                ) : (
                  <ExtractedDataTable
                    mode="compare"
                    comparisonData={comparisonResults!}
                    fileNames={[files[0]?.name, files[1]?.name]}
                    payerPlan={payerPlan}
                  />
                )
              ) : (
                <Card className="bg-card/60 shadow-md border-dashed border-2 border-border/80">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No data extracted yet</h3>
                    <p className="text-muted-foreground">
                      Upload PDFs and click "Extract Data" or "Compare Files" to see results here.
                    </p>
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
