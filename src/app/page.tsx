"use client";

import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import type { ExcelFile, ExcelSheet } from "@/components/excel-flow/types";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, GitCompareArrows, Sheet as SheetIcon, File as FileIcon } from "lucide-react";
import DataTable from "@/components/excel-flow/DataTable";
import ComparisonView from "@/components/excel-flow/ComparisonView";
import { useToast } from "@/hooks/use-toast";

type ActiveView =
  | { type: "none" }
  | { type: "sheet"; fileIndex: number; sheetIndex: number }
  | { type: "compare" };

export default function Home() {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>({ type: "none" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newExcelFiles: ExcelFile[] = [];
    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const excelFile: ExcelFile = {
            name: file.name,
            sheets: workbook.SheetNames.map((sheetName) => ({
              name: sheetName,
              data: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]),
            })),
          };
          newExcelFiles.push(excelFile);
          if (newExcelFiles.length === selectedFiles.length) {
            setFiles((prevFiles) => [...prevFiles, ...newExcelFiles]);
            if (activeView.type === "none" && newExcelFiles.length > 0 && newExcelFiles[0].sheets.length > 0) {
              setActiveView({ type: 'sheet', fileIndex: files.length, sheetIndex: 0 });
            }
          }
        } catch (error) {
          console.error("Error parsing file:", error);
          toast({
            variant: "destructive",
            title: "File Error",
            description: `Could not parse ${file.name}. Please ensure it is a valid Excel file.`,
          });
        }
      };
      reader.onerror = () => {
        toast({
            variant: "destructive",
            title: "File Error",
            description: `Could not read the file ${file.name}.`,
          });
      };
      reader.readAsBinaryString(file);
    });
    event.target.value = ''; // Reset file input
  };
  
  const handleDataUpdate = (fileIndex: number, sheetIndex: number, newData: any[]) => {
    setFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      updatedFiles[fileIndex].sheets[sheetIndex].data = newData;
      return updatedFiles;
    })
  }

  const activeSheet = useMemo(() => {
    if (activeView.type === "sheet") {
      return files[activeView.fileIndex]?.sheets[activeView.sheetIndex];
    }
    return null;
  }, [files, activeView]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <SheetIcon className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-semibold">ExcelFlow</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-2" /> Upload Files
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx, .xls"
                multiple
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView({ type: "compare" })} isActive={activeView.type === "compare"}>
                <GitCompareArrows />
                Compare Sheets
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel>Files</SidebarGroupLabel>
              {files.map((file, fileIndex) => (
                <div key={`${file.name}-${fileIndex}`} className="mt-2">
                    <p className="flex items-center gap-2 font-medium text-sm px-2 text-sidebar-foreground/90"><FileIcon size={16}/>{file.name}</p>
                    <SidebarMenu>
                        {file.sheets.map((sheet, sheetIndex) => (
                            <SidebarMenuItem key={`${sheet.name}-${sheetIndex}`}>
                                <SidebarMenuButton onClick={() => setActiveView({ type: "sheet", fileIndex, sheetIndex })} isActive={activeView.type === "sheet" && activeView.fileIndex === fileIndex && activeView.sheetIndex === sheetIndex}>
                                    <SheetIcon />
                                    {sheet.name}
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </div>
              ))}
            </SidebarGroup>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between border-b p-2">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            {activeView.type === 'none' && (
                <div className="flex items-center justify-center h-full">
                    <Card className="w-full max-w-md text-center">
                        <CardHeader>
                            <CardTitle>Welcome to ExcelFlow</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="mt-4 text-muted-foreground">
                                Upload one or more Excel files to get started.
                            </p>
                            <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                                Upload Files
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            {activeView.type === 'sheet' && activeSheet && (
                <DataTable 
                    key={`${files[activeView.fileIndex].name}-${activeSheet.name}`}
                    sheet={activeSheet} 
                    onUpdate={(newData) => handleDataUpdate(activeView.fileIndex, activeView.sheetIndex, newData)}
                />
            )}
            {activeView.type === 'compare' && <ComparisonView files={files} />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
