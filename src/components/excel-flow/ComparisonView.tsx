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
      toast({ variant: "destructive", title: "Comparison Failed", description: "An error occurred during the comparison. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
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
                  {sheetOptions.map((opt) => (
                    <SelectItem key={opt.name} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
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
                  {sheetOptions.map((opt) => (
                    <SelectItem key={opt.name} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCompare} disabled={isLoading || !sheet1 || !sheet2} className="w-full">
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
      
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Result</CardTitle>
            <CardDescription>
              Suggested Key Column for comparison: <span className="font-bold text-primary">{result.suggestedKeyColumn}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm font-code overflow-x-auto">
              {result.comparisonResult}
            </pre>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && (
         <Card className="text-center">
             <CardHeader>
                 <CardTitle>No Files Uploaded</CardTitle>
             </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Please upload at least one Excel file to use the comparison tool.</p>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
