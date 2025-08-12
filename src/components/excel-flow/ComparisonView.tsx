
"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import type { ExcelFile, ExcelRow } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitCompareArrows, Download, CheckCircle, XCircle, ArrowRightLeft, CircleDot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DataTable from "./DataTable";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

interface ComparisonViewProps {
  files: ExcelFile[];
}

interface SheetIdentifier {
  fileIndex: number;
  sheetIndex: number;
  name: string;
}

type ComparisonStatus = "Unchanged" | "Changed" | "In Sheet 2 Only" | "In Sheet 1 Only";

interface ComparisonResult {
    comparison: {
        status: ComparisonStatus;
        key: string | number;
        data1: ExcelRow | null;
        data2: ExcelRow | null;
    }[];
    allColumns: string[];
}

type FilterStatus = "all" | ComparisonStatus;


export default function ComparisonView({ files }: ComparisonViewProps) {
  const [sheet1, setSheet1] = useState<SheetIdentifier | null>(null);
  const [sheet2, setSheet2] = useState<SheetIdentifier | null>(null);
  const [keyColumn1, setKeyColumn1] = useState<string | null>(null);
  const [keyColumn2, setKeyColumn2] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const { toast } = useToast();

  const sheetOptions = useMemo(() => files.flatMap((file, fileIndex) =>
    file.sheets.map((sheet, sheetIndex) => ({
      fileIndex,
      sheetIndex,
      name: `${file.name} - ${sheet.name}`,
    }))
  ), [files]);

  const sheet1Columns = useMemo(() => {
    if (!sheet1) return [];
    const data = files[sheet1.fileIndex]?.sheets[sheet1.sheetIndex]?.data;
    return data && data.length > 0 ? Object.keys(data[0]) : [];
  }, [files, sheet1]);

  const sheet2Columns = useMemo(() => {
    if (!sheet2) return [];
    const data = files[sheet2.fileIndex]?.sheets[sheet2.sheetIndex]?.data;
    return data && data.length > 0 ? Object.keys(data[0]) : [];
  }, [files, sheet2]);

  useEffect(() => {
    setResult(null);
    setFilter('all');
    setKeyColumn1(null);
    setKeyColumn2(null);
  }, [sheet1, sheet2]);
  
  useEffect(() => {
    if (keyColumn1 && !sheet1Columns.includes(keyColumn1)) {
        setKeyColumn1(null);
    }
  }, [keyColumn1, sheet1Columns]);

  useEffect(() => {
    if (keyColumn2 && !sheet2Columns.includes(keyColumn2)) {
        setKeyColumn2(null);
    }
  }, [keyColumn2, sheet2Columns]);

  const runLocalComparison = (
    data1: ExcelRow[],
    data2: ExcelRow[],
    key1: string,
    key2: string
  ): ComparisonResult => {
    
    const groupRowsByKey = (data: ExcelRow[], keyColumn: string): Map<any, ExcelRow[]> => {
        const map = new Map<any, ExcelRow[]>();
        data.forEach(row => {
            const key = row[keyColumn];
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key)!.push(row);
        });
        return map;
    };

    const map1 = groupRowsByKey(data1, key1);
    const map2 = groupRowsByKey(data2, key2);

    const comparison: ComparisonResult['comparison'] = [];
    const allKeys = new Set([...map1.keys(), ...map2.keys()]);
    const allColumns = new Set([...sheet1Columns, ...sheet2Columns]);

    allKeys.forEach(key => {
        const rows1 = map1.get(key) || [];
        const rows2 = map2.get(key) || [];
        const maxRows = Math.max(rows1.length, rows2.length);

        for (let i = 0; i < maxRows; i++) {
            const row1 = rows1[i] || null;
            const row2 = rows2[i] || null;

            if (row1 && row2) {
                let isChanged = false;
                for (const col of allColumns) {
                    if (String(row1[col] ?? '') !== String(row2[col] ?? '')) {
                        isChanged = true;
                        break;
                    }
                }
                comparison.push({ status: isChanged ? "Changed" : "Unchanged", key, data1: row1, data2: row2 });
            } else if (row1) {
                comparison.push({ status: "In Sheet 1 Only", key, data1: row1, data2: null });
            } else if (row2) {
                comparison.push({ status: "In Sheet 2 Only", key, data1: null, data2: row2 });
            }
        }
    });
    
    return { comparison, allColumns: Array.from(allColumns) };
  };


  const handleCompare = async () => {
    if (!sheet1 || !sheet2 || !keyColumn1 || !keyColumn2) {
      toast({ variant: "destructive", title: "Please select two sheets and a key column for each." });
      return;
    }
    if (sheet1.fileIndex === sheet2.fileIndex && sheet1.sheetIndex === sheet2.sheetIndex && keyColumn1 === keyColumn2) {
        toast({ variant: "destructive", title: "Cannot compare a sheet with itself using the same key column." });
        return;
    }

    setIsLoading(true);
    setResult(null);
    setFilter('all');

    setTimeout(() => {
        try {
            const data1 = files[sheet1.fileIndex].sheets[sheet1.sheetIndex].data;
            const data2 = files[sheet2.fileIndex].sheets[sheet2.sheetIndex].data;
            
            const comparisonResult = runLocalComparison(data1, data2, keyColumn1, keyColumn2);
            setResult(comparisonResult);

        } catch (error) {
            console.error("Comparison failed:", error);
            toast({ variant: "destructive", title: "Comparison Failed", description: "An unexpected error occurred during the comparison. Please check the console and try again." });
        } finally {
            setIsLoading(false);
        }
    }, 50);
  };

  const exportToExcel = () => {
    if (!result || !result.comparison) return;

    const dataToExport = result.comparison.map((item, index) => {
        const base: ExcelRow = { 'S.No.': index + 1, 'Key': item.key, 'Status': item.status };
        result.allColumns.forEach(col => {
            if (col !== keyColumn1 && col !== keyColumn2) {
                base[`${col} (Sheet 1)`] = item.data1?.[col] ?? '';
                base[`${col} (Sheet 2)`] = item.data2?.[col] ?? '';
            }
        });
        return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison_Result");
    XLSX.writeFile(workbook, `Comparison-Result.xlsx`);
  }

  const resultStats = useMemo(() => {
    if (!result) return null;
    return {
        all: result.comparison.length,
        Unchanged: result.comparison.filter(i => i.status === 'Unchanged').length,
        Changed: result.comparison.filter(i => i.status === 'Changed').length,
        'In Sheet 2 Only': result.comparison.filter(i => i.status === 'In Sheet 2 Only').length,
        'In Sheet 1 Only': result.comparison.filter(i => i.status === 'In Sheet 1 Only').length,
    }
  }, [result]);

  const filteredResult = useMemo(() => {
    if (!result) return null;
    if (filter === 'all') return result.comparison;
    return result.comparison.filter(item => item.status === filter);
  }, [result, filter]);


  if (files.length < 1) {
    return (
        <Card className="w-full max-w-lg text-center shadow-lg border-dashed border-2 mx-auto mt-10">
           <CardHeader>
               <CardTitle>No Files Uploaded</CardTitle>
           </CardHeader>
          <CardContent>
              <p className="text-muted-foreground">Please upload at least one Excel file to use the comparison tool.</p>
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
            Select two sheets and the key column for each to use for matching rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Sheet 1 (Reference)</label>
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
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Sheet 2 (To Compare)</label>
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Key Column for Sheet 1</label>
                <Select onValueChange={setKeyColumn1} disabled={!sheet1} value={keyColumn1 ?? ""}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Key Column..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                        <SelectLabel>Columns in {sheet1?.name}</SelectLabel>
                        {sheet1Columns.map((col) => (
                            <SelectItem key={`${col}-1`} value={col}>{col}</SelectItem>
                        ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Key Column for Sheet 2</label>
                <Select onValueChange={setKeyColumn2} disabled={!sheet2} value={keyColumn2 ?? ""}>
                <SelectTrigger>
                    <SelectValue placeholder="Select Key Column..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                    <SelectLabel>Columns in {sheet2?.name}</SelectLabel>
                    {sheet2Columns.map((col) => (
                        <SelectItem key={`${col}-2`} value={col}>{col}</SelectItem>
                    ))}
                    </SelectGroup>
                </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
             <Button onClick={handleCompare} disabled={isLoading || !sheet1 || !sheet2 || !keyColumn1 || !keyColumn2} className="w-full md:w-auto">
                {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparing...
                </>
                ) : (
                    <>
                        <GitCompareArrows className="mr-2 h-4 w-4" />
                        Run Comparison
                    </>
                )}
            </Button>
        </CardFooter>
      </Card>
      
      {isLoading && (
        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground text-lg">Comparing your sheets...</p>
            <p className="text-muted-foreground text-sm">This may take a moment for large files.</p>
          </CardContent>
        </Card>
      )}

      {result && filteredResult && resultStats && (
         <Card className="shadow-lg">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Comparison Result</CardTitle>
                        <CardDescription>
                            Showing {filteredResult.length} of {result.comparison.length} total rows.
                        </CardDescription>
                    </div>
                     <Button onClick={exportToExcel} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export Result
                    </Button>
                </div>
                <Alert className="mt-4">
                    <AlertTitle>Comparison Keys</AlertTitle>
                    <AlertDescription>
                        Sheet 1 ({sheet1?.name}) key: <strong>{keyColumn1}</strong> <br />
                        Sheet 2 ({sheet2?.name}) key: <strong>{keyColumn2}</strong>
                    </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2 pt-4 flex-wrap">
                    <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All ({resultStats.all})</Button>
                    <Button variant={filter === 'Changed' ? 'default' : 'outline'} onClick={() => setFilter('Changed')}>Changed ({resultStats.Changed})</Button>
                    <Button variant={filter === 'In Sheet 2 Only' ? 'default' : 'outline'} onClick={() => setFilter('In Sheet 2 Only')}>In Sheet 2 Only ({resultStats['In Sheet 2 Only']})</Button>
                    <Button variant={filter === 'In Sheet 1 Only' ? 'default' : 'outline'} onClick={() => setFilter('In Sheet 1 Only')}>In Sheet 1 Only ({resultStats['In Sheet 1 Only']})</Button>
                    <Button variant={filter === 'Unchanged' ? 'default' : 'outline'} onClick={() => setFilter('Unchanged')}>Unchanged ({resultStats.Unchanged})</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="p-2 text-left font-semibold sticky left-0 bg-card z-10 w-16">S.No.</th>
                                <th className="p-2 text-left font-semibold sticky left-16 bg-card z-10">Key: {keyColumn1} / {keyColumn2}</th>
                                <th className="p-2 text-left font-semibold sticky left-48 bg-card z-10">Status</th>
                                {result.allColumns.filter(c => c !== keyColumn1 && c !== keyColumn2).map(col => (
                                    <th key={col} className="p-2 text-center font-semibold border-l" colSpan={2}>{col}</th>
                                ))}
                            </tr>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left font-semibold sticky left-0 bg-muted/50 z-10"></th>
                                <th className="p-2 text-left font-semibold sticky left-16 bg-muted/50 z-10"></th>
                                <th className="p-2 text-left font-semibold sticky left-48 bg-muted/50 z-10"></th>
                                {result.allColumns.filter(c => c !== keyColumn1 && c !== keyColumn2).map(col => (
                                    <React.Fragment key={col}>
                                        <th className="p-2 text-center font-medium text-muted-foreground border-l w-48">Sheet 1 Value</th>
                                        <th className="p-2 text-center font-medium text-muted-foreground border-l w-48">Sheet 2 Value</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResult.map((item, index) => {
                                const val1 = item.data1;
                                const val2 = item.data2;

                                const getStatusBadge = (status: ComparisonStatus) => {
                                    switch(status) {
                                        case 'In Sheet 2 Only': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1" /> In Sheet 2 Only</Badge>;
                                        case 'In Sheet 1 Only': return <Badge variant="destructive"><XCircle className="mr-1"/> In Sheet 1 Only</Badge>;
                                        case 'Changed': return <Badge variant="secondary" className="bg-amber-400 text-black hover:bg-amber-500"><ArrowRightLeft className="mr-1" /> Changed</Badge>;
                                        case 'Unchanged': return <Badge variant="outline"><CircleDot className="mr-1"/> Unchanged</Badge>;
                                    }
                                }
                                
                                return (
                                <tr key={`${item.key}-${index}`} className="border-b hover:bg-muted/50">
                                    <td className="p-2 sticky left-0 bg-card z-10">{index + 1}</td>
                                    <td className="p-2 sticky left-16 bg-card z-10 font-medium">{String(item.key)}</td>
                                    <td className="p-2 sticky left-48 bg-card z-10">{getStatusBadge(item.status)}</td>
                                    {result.allColumns.filter(c => c !== keyColumn1 && c !== keyColumn2).map(col => {
                                        const v1 = val1?.[col] ?? '';
                                        const v2 = val2?.[col] ?? '';
                                        const isDifferent = item.status === 'Changed' && String(v1) !== String(v2);

                                        if(item.status === 'In Sheet 1 Only') {
                                           return <td key={`${col}-1`} className="p-2 border-l bg-red-500/10" colSpan={2}>{v1}</td>;
                                        }
                                        if(item.status === 'In Sheet 2 Only') {
                                            return <td key={`${col}-2`} className="p-2 border-l bg-green-500/10" colSpan={2}>{v2}</td>;
                                        }

                                        return (
                                            <React.Fragment key={col}>
                                                <td className={cn("p-2 border-l", isDifferent && "bg-amber-500/10")}>{String(v1)}</td>
                                                <td className={cn("p-2 border-l", isDifferent && "bg-amber-500/10 font-semibold text-amber-800")}>{String(v2)}</td>
                                            </React.Fragment>
                                        )
                                    })}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 {filteredResult.length === 0 && <div className="text-center p-8 text-muted-foreground">No data to display for the selected filter.</div>}
            </CardContent>
         </Card>
      )}

    </div>
  );
}

    