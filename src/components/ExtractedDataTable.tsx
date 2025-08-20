import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
import type { ExtractedData, ComparisonResult } from "@/constants/fields";
import { FIELD_SUGGESTIONS, PAYER_PLANS } from "@/constants/fields";
import { cn } from "@/lib/utils";

interface ExtractedDataTableProps {
  mode: 'single' | 'compare';
  data?: ExtractedData;
  comparisonData?: ComparisonResult[];
  fileName?: string;
  fileNames?: [string, string];
  payerPlan?: keyof typeof PAYER_PLANS;
}

export const ExtractedDataTable = ({ 
  mode, 
  data, 
  comparisonData, 
  fileName, 
  fileNames,
  payerPlan
}: ExtractedDataTableProps) => {
  if (mode === 'single' && data) {
    const foundCount = Object.values(data).filter(v => v !== null).length;
    const totalCount = Object.keys(data).length;
    const confidence = Math.round((foundCount / totalCount) * 100);

    return (
      <Card className="bg-card shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Extracted Data - {fileName}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {foundCount}/{totalCount} fields found ({confidence}% confidence)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {foundCount < totalCount && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Some fields couldn't be extracted</p>
                  <p className="text-amber-700">
                    This is common with medical insurance documents. Check the suggestions below for alternative field names, 
                    or ensure your PDF is clear and readable. You can also try re-uploading the document.
                  </p>
                </div>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-semibold text-foreground">Field</TableHead>
                <TableHead className="font-semibold text-foreground">Value</TableHead>
                <TableHead className="font-semibold text-foreground w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(data).map(([field, value]) => (
                <TableRow key={field} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{field}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {value || (
                      <div className="space-y-2">
                        <span className="text-muted-foreground italic">Not found</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {value ? (
                      <Badge variant="secondary" className="bg-success-light text-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Found
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Missing
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'compare' && comparisonData && fileNames) {
    return (
      <Card className="bg-card shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Comparison Results
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              File 1: {fileNames[0]}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-accent rounded-full"></div>
              File 2: {fileNames[1]}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-semibold text-foreground">Field</TableHead>
                <TableHead className="font-semibold text-foreground">File 1</TableHead>
                <TableHead className="font-semibold text-foreground">File 2</TableHead>
                <TableHead className="font-semibold text-foreground w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonData.map((item) => (
                <TableRow 
                  key={item.field} 
                  className={cn(
                    "border-border hover:bg-muted/50",
                    item.status === 'different' && "bg-diff-changed",
                    item.status === 'missing' && "bg-muted/30"
                  )}
                >
                  <TableCell className="font-medium text-foreground">{item.field}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.file1Value || <span className="text-muted-foreground italic">Not found</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.file2Value || <span className="text-muted-foreground italic">Not found</span>}
                  </TableCell>
                  <TableCell>
                    {item.status === 'same' && (
                      <Badge variant="secondary" className="bg-success-light text-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Same
                      </Badge>
                    )}
                    {item.status === 'different' && (
                      <Badge variant="secondary" className="bg-warning-light text-warning">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Different
                      </Badge>
                    )}
                    {item.status === 'missing' && (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Missing
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return null;
};