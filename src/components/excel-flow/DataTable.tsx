"use client";

import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import type { ExcelSheet, ExcelRow } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal, ArrowUpDown, Plus, Trash2, Download, EyeOff, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataTableProps {
  sheet: ExcelSheet;
  onUpdate: (newData: ExcelRow[]) => void;
}

export default function DataTable({ sheet, onUpdate }: DataTableProps) {
  const [data, setData] = useState<ExcelRow[]>(sheet.data);
  const [columns, setColumns] = useState(() =>
    data.length > 0 ? Object.keys(data[0]) : []
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    columns.reduce((acc, col) => ({ ...acc, [col]: true }), {})
  );
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);

  const { toast } = useToast();

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredData = useMemo(() => {
    let filtered = [...data];
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((row) =>
          String(row[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });
    return filtered;
  }, [data, filters]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);
  
  const currentColumns = useMemo(() => columns.filter(col => visibleColumns[col]), [columns, visibleColumns]);

  const addRow = () => {
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col]: "" }), {});
    const newData = [...data, newRow];
    setData(newData);
    onUpdate(newData);
  };

  const removeRow = (rowIndex: number) => {
    const newData = data.filter((_, i) => i !== rowIndex);
    setData(newData);
    onUpdate(newData);
  };

  const addColumn = () => {
    const newColumnName = prompt("Enter new column name:");
    if (newColumnName && !columns.includes(newColumnName)) {
      setColumns([...columns, newColumnName]);
      setVisibleColumns(prev => ({...prev, [newColumnName]: true}));
      const newData = data.map(row => ({...row, [newColumnName]: ''}));
      setData(newData);
      onUpdate(newData);
    } else if (newColumnName) {
      toast({ variant: 'destructive', title: "Column already exists" });
    }
  };

  const removeColumn = (colToRemove: string) => {
    if(confirm(`Are you sure you want to delete column "${colToRemove}"?`)){
        setColumns(columns.filter(col => col !== colToRemove));
        setVisibleColumns(prev => {
            const newVisible = {...prev};
            delete newVisible[colToRemove];
            return newVisible;
        });
        const newData = data.map(row => {
            const newRow = {...row};
            delete newRow[colToRemove];
            return newRow;
        });
        setData(newData);
        onUpdate(newData);
    }
  };

  const handleEdit = (rowIndex: number, colKey: string, value: any) => {
    const newData = [...data];
    newData[rowIndex][colKey] = value;
    setData(newData);
    onUpdate(newData);
    setEditingCell(null);
  }

  const exportToExcel = () => {
    const dataToExport = sortedData.map(row => {
      return currentColumns.reduce((acc, col) => {
        acc[col] = row[col];
        return acc;
      }, {} as ExcelRow);
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    XLSX.writeFile(workbook, `${sheet.name}-export.xlsx`);
  };

  const getColumnStats = useCallback((col: string) => {
    const values = data.map(row => Number(row[col])).filter(val => !isNaN(val));
    if(values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
        count: values.length,
        sum,
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
    }
  }, [data]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{sheet.name}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addRow}><Plus className="mr-2" />Add Row</Button>
          <Button variant="outline" onClick={addColumn}><Plus className="mr-2" />Add Column</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><SlidersHorizontal className="mr-2" /> View</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={visibleColumns[col]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns({ ...visibleColumns, [col]: !!checked })
                  }
                >
                  {col}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={exportToExcel}><Download className="mr-2" />Export</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {currentColumns.map((col) => {
                const stats = getColumnStats(col);
                return (
                    <TableHead key={col}>
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2">
                                <span onClick={() => handleSort(col)} className="cursor-pointer hover:text-primary">{col}</span>
                                {sortConfig?.key === col && <ArrowUpDown className="h-4 w-4" />}
                           </div>
                           <div className="flex items-center gap-1">
                                {stats && (
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Calculator size={14}/></Button></PopoverTrigger>
                                        <PopoverContent className="w-64">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">Column Stats</h4>
                                                <p className="text-sm text-muted-foreground">Statistics for '{col}'</p>
                                                <div className="text-sm">
                                                    <div><strong>Count:</strong> {stats.count.toLocaleString()}</div>
                                                    <div><strong>Sum:</strong> {stats.sum.toLocaleString()}</div>
                                                    <div><strong>Average:</strong> {stats.avg.toLocaleString()}</div>
                                                    <div><strong>Min:</strong> {stats.min.toLocaleString()}</div>
                                                    <div><strong>Max:</strong> {stats.max.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeColumn(col)}><EyeOff size={14}/></Button>
                           </div>
                        </div>
                    </TableHead>
                )
              })}
              <TableHead>Actions</TableHead>
            </TableRow>
            <TableRow>
              {currentColumns.map((col) => (
                <TableHead key={`${col}-filter`}>
                  <Input
                    placeholder={`Filter ${col}...`}
                    value={filters[col] || ""}
                    onChange={(e) =>
                      setFilters({ ...filters, [col]: e.target.value })
                    }
                    className="h-8"
                  />
                </TableHead>
              ))}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {currentColumns.map((col) => (
                  <TableCell key={col} onDoubleClick={() => setEditingCell({rowIndex, colKey: col})}>
                    {editingCell?.rowIndex === rowIndex && editingCell?.colKey === col ? (
                      <Input 
                        autoFocus
                        defaultValue={row[col]}
                        onBlur={(e) => handleEdit(rowIndex, col, e.target.value)}
                        onKeyDown={(e) => {
                          if(e.key === 'Enter') handleEdit(rowIndex, col, e.currentTarget.value);
                          if(e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <span className="truncate block">{String(row[col])}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeRow(rowIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sortedData.length === 0 && <div className="text-center p-8 text-muted-foreground">No data to display.</div>}
    </div>
  );
}
