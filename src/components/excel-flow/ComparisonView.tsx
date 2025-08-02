"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { compareExcelSheets, CompareExcelSheetsOutput } from "@/ai/flows/compare-excel-sheets";
import type { ExcelFile, ExcelRow } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitCompareArrows, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DataTable from "./DataTable";

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

  const sheetOptions = useMemo(() => files.flatMap((file, fileIndex) =>
    file.sheets.map((sheet, sheetIndex) => ({
      fileIndex,
      sheetIndex,
      name: `${file.name} - ${sheet.name}`,
    }))
  ), [files]);

  useEffect(() => {
    setResult(null);
  }, [sheet1, sheet2]);

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
      
      const sheetToCsvDataURI = (data: ExcelRow[]): string => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        const base64Csv = btoa(csvString);
        return `data:text/csv;base64,${base64Csv}`;
      };

      const uri1 = sheetToCsvDataURI(data1);
      const uri2 = sheetToCsvDataURI(data2);
      
      const comparisonResult = await compareExcelSheets({
        excelSheet1DataUri: uri1,
        excelSheet2DataUri: uri2,
      });

      setResult(comparisonResult);
    } catch (error) {
      console.error("Comparison failed:", error);
      toast({ variant: "destructive", title: "Comparison Failed", description: "An AI error occurred during the comparison. Please check the console and try again." });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResultUpdate = (newData: ExcelRow[]) => {
    if(!result) return;
    
    // We only update the data part, keeping the status
    const updatedComparisonData = result.comparison.map((item, index) => {
        if(newData[index]) {
            const { comparisonStatus, ...rest } = newData[index];
            return {
                ...item,
                data: rest
            }
        }
        return item;
    });

    setResult({ ...result, comparison: updatedComparisonData });
  }

  const exportToExcel = () => {
    if (!result || !result.comparison) return;

    const dataToExport = result.comparison.map(item => ({
      'Status': item.comparisonStatus,
      ...item.data
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison_Result");
    XLSX.writeFile(workbook, `Comparison-Result.xlsx`);
  }

  const resultSheet = useMemo(() => {
    if(!result) return null;
    return {
        name: "Comparison Result",
        data: result.comparison.map(row => ({
            comparisonStatus: row.comparisonStatus,
            ...row.data
        }))
    }
  }, [result]);


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
    <div className="w-full space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Compare Excel Sheets</CardTitle>
          <CardDescription>
            Select two sheets to compare. The AI will analyze the differences and suggest a key column for matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select onValueChange={(value) => setSheet1(JSON.parse(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Sheet 1" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sheets</SelectLabel>
                  {sheetOptions.map((opt, index) => (
                    <SelectItem key={`${opt.name}-${index}-1`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
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
                    <SelectItem key={`${opt.name}-${index}-2`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
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
        </CardFooter>
      </Card>
      
      {isLoading && (
        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground text-lg">AI is analyzing your sheets...</p>
            <p className="text-muted-foreground text-sm">This may take a moment for large files.</p>
          </CardContent>
        </Card>
      )}

      {result && resultSheet && (
         <Card className="shadow-lg">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Comparison Result</CardTitle>
                        <CardDescription>
                        The comparison results are shown below. You can filter, sort, and edit the data directly.
                        </CardDescription>
                    </div>
                     <Button onClick={exportToExcel} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Result
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Alert className="mb-6">
                    <GitCompareArrows className="h-4 w-4" />
                    <AlertTitle>Comparison Key</AlertTitle>
                    <AlertDescription>
                        The AI used the column <span className="font-bold text-primary">{result.keyColumn}</span> for the comparison.
                    </AlertDescription>
                </Alert>
                <DataTable
                    key={sheet1?.name + sheet2?.name}
                    sheet={resultSheet}
                    onUpdate={handleResultUpdate}
                    isComparisonResult={true}
                />
            </CardContent>
         </Card>
      )}

    </div>
  );
}
