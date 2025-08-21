import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExtractedDataTable } from "@/components/ExtractedDataTable";
import { extractDataApi } from "@/services/extractDataApi";
import { compareDataApi } from "@/services/compareDataApi";
import { useToast } from "@/hooks/use-toast";

export default function IndexPage() {
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [comparisonResults, setComparisonResults] = useState<any | null>(null);
  const [payerPlan, setPayerPlan] = useState<string>("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    setFiles(selectedFiles);
  };

  const handleExtract = async () => {
    try {
      if (mode === "single" && files.length === 1) {
        const data = await extractDataApi(files[0], payerPlan);
        setExtractedData(data);
        setComparisonResults(null);
      } else if (mode === "compare" && files.length === 2) {
        const results = await compareDataApi(files[0], files[1], payerPlan);
        setComparisonResults(results);
        setExtractedData(null);
      } else {
        toast({
          title: "Invalid Upload",
          description: "Please upload the correct number of files.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong during extraction.",
        variant: "destructive",
      });
    }
  };

  // 🔹 Download JSON
  const exportJson = (data: any, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 🔹 Copy to Clipboard
  const copyToClipboard = async (data: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({
        title: "Copied!",
        description: "Extracted data copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-4">
        <Button
          variant={mode === "single" ? "default" : "outline"}
          onClick={() => setMode("single")}
        >
          Single Extract
        </Button>
        <Button
          variant={mode === "compare" ? "default" : "outline"}
          onClick={() => setMode("compare")}
        >
          Compare
        </Button>
      </div>

      {/* File Upload */}
      <div>
        <input
          type="file"
          accept="application/pdf"
          multiple={mode === "compare"}
          onChange={handleFileUpload}
        />
      </div>

      {/* Payer Plan Input */}
      <div>
        <input
          type="text"
          placeholder="Enter Payer Plan"
          value={payerPlan}
          onChange={(e) => setPayerPlan(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {/* Extract Button */}
      <Button onClick={handleExtract} className="bg-gradient-primary">
        {mode === "single" ? "Extract Data" : "Compare Data"}
      </Button>

      {/* Results */}
      {extractedData && (
        <div className="space-y-4">
          <ExtractedDataTable
            mode="single"
            data={extractedData}
            fileName={files[0]?.name}
            payerPlan={payerPlan}
          />
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => exportJson(extractedData, `${files[0]?.name}-extracted.json`)}
              className="bg-gradient-primary"
            >
              Download JSON
            </Button>
            <Button variant="outline" onClick={() => copyToClipboard(extractedData)}>
              Copy to Clipboard
            </Button>
          </div>
        </div>
      )}

      {comparisonResults && (
        <div className="space-y-4">
          <ExtractedDataTable
            mode="compare"
            comparisonData={comparisonResults}
            fileNames={[files[0]?.name, files[1]?.name]}
            payerPlan={payerPlan}
          />
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() =>
                exportJson(
                  comparisonResults,
                  `comparison-${files[0]?.name}-${files[1]?.name}.json`
                )
              }
              className="bg-gradient-primary"
            >
              Download JSON
            </Button>
            <Button variant="outline" onClick={() => copyToClipboard(comparisonResults)}>
              Copy to Clipboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
