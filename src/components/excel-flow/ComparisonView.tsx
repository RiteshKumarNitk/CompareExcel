"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { compareExcelSheets, CompareExcelSheetsOutput } from "@/ai/flows/compare-excel-sheets";
import type { ExcelFile, ExcelRow } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitCompareArrows } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface ComparisonViewProps {
  files: ExcelFile[];
}

interface SheetIdentifier {
  fileIndex: number;
  sheetIndex: number;
  name: string;
}

export default function ComparisonView({ files }: ComparisonViewProps) {
  const [sheet1, setSheet1] = useState<SheetIdentifier | null>(null);
  const [sheet2, setSheet2] = useState<SheetIdentifier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompareExcelSheetsOutput | null>(null);
  const { toast } = useToast();

  const sheetOptions = files.flatMap((file, fileIndex) =>
    file.sheets.map((sheet, sheetIndex) => ({
      fileIndex,
      sheetIndex,
      name: `${file.name} - ${sheet.name}`,
    }))
  );

  const handleCompare = async () => {
    if (!sheet1 || !sheet2) {
      toast({ variant: "destructive", title: "Please select two sheets to compare." });
      return;
    }
    if (sheet1.name === sheet2.name) {
        toast({ variant: "destructive", title: "Please select two different sheets." });
        return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const data1 = files[sheet1.fileIndex].sheets[sheet1.sheetIndex].data;
      const data2 = files[sheet2.fileIndex].sheets[sheet2.sheetIndex].data;

      const sheetToDataURI = async (data: ExcelRow[], sheetName: string): Promise<string> => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
      };

      const [uri1, uri2] = await Promise.all([
        sheetToDataURI(data1, files[sheet1.fileIndex].sheets[sheet1.sheetIndex].name),
        sheetToDataURI(data2, files[sheet2.fileIndex].sheets[sheet2.sheetIndex].name),
      ]);
      
      const comparisonResult = await compareExcelSheets({
        excelSheet1DataUri: uri1,
        excelSheet2DataUri: uri2,
      });

      setResult(comparisonResult);
    } catch (error) {
      console.error("Comparison failed:", error);
      toast({ variant: "destructive", title: "Comparison Failed", description: "An AI error occurred during the comparison. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (files.length < 1) {
    return (
        <Card className="text-center shadow-lg">
           <CardHeader>
               <CardTitle>No Files Uploaded</CardTitle>
           </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">Please upload at least one Excel file to use the comparison tool.</p>
          </CardContent>
       </Card>
    )
  }

  if (sheetOptions.length < 2) {
    return (
        <Card className="text-center shadow-lg">
           <CardHeader>
               <CardTitle>Not Enough Sheets</CardTitle>
           </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">You need at least two sheets across your files to run a comparison.</p>
          </CardContent>
       </Card>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Compare Excel Sheets</CardTitle>
          <CardDescription>
            Select two sheets to compare. The AI will analyze the differences and suggest a key column for matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select onValueChange={(value) => setSheet1(JSON.parse(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Sheet 1" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sheets</SelectLabel>
                  {sheetOptions.map((opt, index) => (
                    <SelectItem key={`${opt.name}-${index}`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setSheet2(JSON.parse(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Sheet 2" />
              </SelectTrigger>
              <SelectContent>
                 <SelectGroup>
                  <SelectLabel>Sheets</SelectLabel>
                  {sheetOptions.map((opt, index) => (
                    <SelectItem key={`${opt.name}-${index}`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCompare} disabled={isLoading || !sheet1 || !sheet2} className="w-full md:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
                <>
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Compare Sheets
                </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {isLoading && (
        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">AI is analyzing your sheets...</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Comparison Result</CardTitle>
            <CardDescription>
              Based on the analysis, here are the differences found between the two sheets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <GitCompareArrows className="h-4 w-4" />
              <AlertTitle>Suggested Key Column</AlertTitle>
              <AlertDescription>
                The AI suggests using <span className="font-bold text-primary">{result.suggestedKeyColumn}</span> for the most accurate comparison.
              </AlertDescription>
            </Alert>
            
            <Textarea
              readOnly
              className="bg-muted font-code text-sm min-h-[300px] resize-y"
              value={result.comparisonResult}
            />
          </CardContent>
        </Card>
      )}

    </div>
  );
}
