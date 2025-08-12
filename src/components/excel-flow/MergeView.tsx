
"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import type { ExcelFile, ExcelRow, ExcelSheet } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, Link2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "./DataTable";

interface MergeViewProps {
  files: ExcelFile[];
}

interface SheetIdentifier {
  fileIndex: number;
  sheetIndex: number;
  name: string;
}

interface MergeResult {
    sheet: ExcelSheet,
    key: string;
}

export default function MergeView({ files }: MergeViewProps) {
  const [leftSheetIdentifier, setLeftSheetIdentifier] = useState<SheetIdentifier | null>(null);
  const [rightSheetIdentifier, setRightSheetIdentifier] = useState<SheetIdentifier | null>(null);
  const [leftKeyColumn, setLeftKeyColumn] = useState<string | null>(null);
  const [rightKeyColumn, setRightKeyColumn] = useState<string | null>(null);
  const [columnsToMerge, setColumnsToMerge] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const { toast } = useToast();

  const sheetOptions = useMemo(() => files.flatMap((file, fileIndex) =>
    file.sheets.map((sheet, sheetIndex) => ({
      fileIndex,
      sheetIndex,
      name: `${file.name} - ${sheet.name}`,
    }))
  ), [files]);

  const leftSheet = useMemo(() => leftSheetIdentifier ? files[leftSheetIdentifier.fileIndex].sheets[leftSheetIdentifier.sheetIndex] : null, [files, leftSheetIdentifier]);
  const rightSheet = useMemo(() => rightSheetIdentifier ? files[rightSheetIdentifier.fileIndex].sheets[rightSheetIdentifier.sheetIndex] : null, [files, rightSheetIdentifier]);

  const leftSheetColumns = useMemo(() => {
    if (!leftSheet) return [];
    return leftSheet.data.length > 0 ? Object.keys(leftSheet.data[0]) : [];
  }, [leftSheet]);

  const rightSheetColumns = useMemo(() => {
    if (!rightSheet) return [];
    return rightSheet.data.length > 0 ? Object.keys(rightSheet.data[0]) : [];
  }, [rightSheet]);

  const mergeableColumns = useMemo(() => rightSheetColumns.filter(c => c !== rightKeyColumn), [rightSheetColumns, rightKeyColumn]);

  useEffect(() => {
    setResult(null);
    setLeftKeyColumn(null);
  }, [leftSheetIdentifier]);

  useEffect(() => {
    setResult(null);
    setRightKeyColumn(null);
    setColumnsToMerge([]);
  }, [rightSheetIdentifier]);

  const handleDataUpdate = (newData: ExcelRow[]) => {
    if (!result) return;
    setResult({ ...result, sheet: { ...result.sheet, data: newData }});
  }

  const runMerge = () => {
    if (!leftSheet || !rightSheet || !leftKeyColumn || !rightKeyColumn || columnsToMerge.length === 0) {
        toast({ variant: "destructive", title: "Missing Information", description: "Please select both sheets, their key columns, and at least one column to merge." });
        return;
    }
    
    setIsLoading(true);

    setTimeout(() => {
        try {
            const rightDataMap = new Map<any, ExcelRow>();
            rightSheet.data.forEach(row => {
                const key = row[rightKeyColumn];
                if (key !== null && key !== undefined) {
                    rightDataMap.set(key, row);
                }
            });

            const mergedData = leftSheet.data.map(leftRow => {
                const newRow = { ...leftRow };
                const matchKey = leftRow[leftKeyColumn];
                const rightRow = rightDataMap.get(matchKey);

                if (rightRow) {
                    columnsToMerge.forEach(col => {
                        // Avoid overwriting existing columns in the left sheet
                        if (!(col in newRow)) { 
                           newRow[col] = rightRow[col];
                        } else {
                            newRow[`${col}_(Merged)`] = rightRow[col];
                        }
                    });
                }
                return newRow;
            });
            
            const newSheetName = `Merged_${leftSheet.name}_${rightSheet.name}`;
            setResult({ sheet: { name: newSheetName, data: mergedData }, key: newSheetName });
            
        } catch (error) {
            console.error("Merge failed:", error);
            toast({ variant: "destructive", title: "Merge Failed", description: "An unexpected error occurred during the merge. Please check the console." });
        } finally {
            setIsLoading(false);
        }
    }, 50);
  }

   const exportToExcel = () => {
    if (!result) return;
    const worksheet = XLSX.utils.json_to_sheet(result.sheet.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, result.sheet.name);
    XLSX.writeFile(workbook, `${result.sheet.name}.xlsx`);
  };

  if (files.length < 1) {
    return (
        <Card className="w-full max-w-lg text-center shadow-lg border-dashed border-2 mx-auto mt-10">
           <CardHeader>
               <CardTitle>No Files Uploaded</CardTitle>
           </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">Please upload at least one file to use the merge tool.</p>
          </CardContent>
       </Card>
    )
  }
  
  if (sheetOptions.length < 2 && !(files.length === 1 && files[0].sheets.length > 1)) {
    return (
        <Card className="w-full max-w-lg text-center shadow-lg border-dashed border-2 mx-auto mt-10">
           <CardHeader>
               <CardTitle>Not Enough Sheets</CardTitle>
           </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">You need at least two sheets across your files to run a merge.</p>
          </CardContent>
       </Card>
    )
  }

  return (
    <div className="w-full space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Merge Sheets (VLOOKUP)</CardTitle>
          <CardDescription>
            Select two sheets to merge data from the 'Right' sheet into the 'Left' sheet based on a common key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Left Sheet (Base)</label>
                <Select onValueChange={(value) => setLeftSheetIdentifier(JSON.parse(value))}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Base Sheet" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                        <SelectLabel>Sheets</SelectLabel>
                        {sheetOptions.map((opt, index) => (
                            <SelectItem key={`${opt.name}-${index}-left`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                        ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Right Sheet (Lookup)</label>
                <Select onValueChange={(value) => setRightSheetIdentifier(JSON.parse(value))}>
                <SelectTrigger>
                    <SelectValue placeholder="Select Lookup Sheet" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                    <SelectLabel>Sheets</SelectLabel>
                    {sheetOptions.map((opt, index) => (
                        <SelectItem key={`${opt.name}-${index}-right`} value={JSON.stringify(opt)}>{opt.name}</SelectItem>
                    ))}
                    </SelectGroup>
                </SelectContent>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Key Column for Left Sheet</label>
                <Select onValueChange={setLeftKeyColumn} disabled={!leftSheet} value={leftKeyColumn ?? ""}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Key Column..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                        <SelectLabel>Columns in {leftSheet?.name}</SelectLabel>
                        {leftSheetColumns.map((col) => (
                            <SelectItem key={`${col}-left`} value={col}>{col}</SelectItem>
                        ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Key Column for Right Sheet</label>
                <Select onValueChange={setRightKeyColumn} disabled={!rightSheet} value={rightKeyColumn ?? ""}>
                <SelectTrigger>
                    <SelectValue placeholder="Select Key Column..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                    <SelectLabel>Columns in {rightSheet?.name}</SelectLabel>
                    {rightSheetColumns.map((col) => (
                        <SelectItem key={`${col}-right`} value={col}>{col}</SelectItem>
                    ))}
                    </SelectGroup>
                </SelectContent>
                </Select>
            </div>
          </div>
          <div className="space-y-2">
              <label className="text-sm font-medium">Columns to Merge</label>
              <MultiSelect
                options={mergeableColumns.map(col => ({ label: col, value: col }))}
                selected={columnsToMerge}
                onChange={setColumnsToMerge}
                placeholder="Select columns to add..."
                disabled={!rightKeyColumn}
              />
              <p className="text-xs text-muted-foreground">Select columns from the Right sheet to add to the Left sheet.</p>
          </div>
        </CardContent>
        <CardFooter>
             <Button onClick={runMerge} disabled={isLoading || columnsToMerge.length === 0} className="w-full md:w-auto">
                {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Merging...
                </>
                ) : (
                    <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Run Merge
                    </>
                )}
            </Button>
        </CardFooter>
      </Card>
      
      {isLoading && (
        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground text-lg">Merging your sheets...</p>
          </CardContent>
        </Card>
      )}

      {result && leftSheet && rightSheet &&(
         <Card className="shadow-lg">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Merge Result</CardTitle>
                        <CardDescription>
                           Merged data from '{leftSheet.name}' and '{rightSheet.name}'.
                        </CardDescription>
                    </div>
                     <Button onClick={exportToExcel} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Result
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <DataTable 
                    key={result.key}
                    sheet={result.sheet}
                    onUpdate={handleDataUpdate}
                />
            </CardContent>
         </Card>
      )}

    </div>
  );
}
