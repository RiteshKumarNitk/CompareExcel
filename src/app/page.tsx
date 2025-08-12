
"use client";

import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import type { ExcelFile } from "@/components/excel-flow/types";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUp, GitCompareArrows, Sheet as SheetIcon, File as FileIcon, X, Loader2, Link2 } from "lucide-react";
import DataTable from "@/components/excel-flow/DataTable";
import ComparisonView from "@/components/excel-flow/ComparisonView";
import MergeView from "@/components/excel-flow/MergeView";
import { useToast } from "@/hooks/use-toast";

type ActiveView =
  | { type: "none" }
  | { type: "sheet"; fileIndex: number; sheetIndex: number }
  | { type: "compare" }
  | { type: "merge" };

export default function Home() {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>({ type: "none" });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
  
    setIsUploading(true);

    const filePromises = Array.from(selectedFiles).map((file) => {
      if (files.some(f => f.name === file.name)) {
        toast({
          variant: 'destructive',
          title: 'File Exists',
          description: `The file "${file.name}" is already loaded.`,
        });
        return Promise.resolve(null);
      }

      return new Promise<ExcelFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' }); // Use 'array' for better large file support
            const excelFile: ExcelFile = {
              name: file.name,
              sheets: workbook.SheetNames.map((sheetName) => ({
                name: sheetName,
                data: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]),
              })),
            };
            resolve(excelFile);
          } catch (error) {
            console.error('Error parsing file:', error);
            toast({
              variant: 'destructive',
              title: 'File Error',
              description: `Could not parse ${file.name}. Please ensure it is a valid Excel file.`,
            });
            resolve(null);
          }
        };
        reader.onerror = () => {
          toast({
            variant: 'destructive',
            title: 'File Error',
            description: `Could not read the file ${file.name}.`,
          });
          resolve(null);
        };
        reader.readAsArrayBuffer(file); // Use readAsArrayBuffer
      });
    });
  
    Promise.all(filePromises).then((results) => {
      const newExcelFiles = results.filter((file): file is ExcelFile => file !== null);
      if (newExcelFiles.length > 0) {
        setFiles((prevFiles) => {
          const updatedFiles = [...prevFiles, ...newExcelFiles];
          if (activeView.type === 'none' && updatedFiles.length > 0 && updatedFiles[0].sheets.length > 0) {
            setActiveView({ type: 'sheet', fileIndex: prevFiles.length, sheetIndex: 0 });
          }
          return updatedFiles;
        });
      }
      setIsUploading(false);
    });
  
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const handleDataUpdate = (fileIndex: number, sheetIndex: number, newData: any[]) => {
    setFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      const newSheetData = {...updatedFiles[fileIndex].sheets[sheetIndex], data: newData};
      updatedFiles[fileIndex].sheets[sheetIndex] = newSheetData;
      return [...updatedFiles];
    })
  }

  const removeFile = (fileIndex: number) => {
    setFiles(prevFiles => {
        const updatedFiles = prevFiles.filter((_, i) => i !== fileIndex);
        if (activeView.type === 'sheet' && activeView.fileIndex === fileIndex) {
            setActiveView({ type: 'none' });
        } else if (activeView.type === 'sheet' && activeView.fileIndex > fileIndex) {
            setActiveView({ type: 'sheet', fileIndex: activeView.fileIndex - 1, sheetIndex: activeView.sheetIndex });
        }
        return updatedFiles;
    });
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
          <div className="flex items-center gap-2 p-4">
            <SheetIcon className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-semibold">ExcelFlow</h1>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-0">
          <div className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <Button
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <FileUp className="mr-2" />}
                  {isUploading ? 'Processing...' : 'Upload Files'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  multiple
                  disabled={isUploading}
                />
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView({ type: "merge" })} isActive={activeView.type === "merge"}>
                  <Link2 />
                  Merge Sheets
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView({ type: "compare" })} isActive={activeView.type === "compare"}>
                  <GitCompareArrows />
                  Compare Sheets
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
          
          <SidebarSeparator />

          <SidebarGroup className="flex-1 overflow-y-auto">
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            {files.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">No files uploaded.</p>
            ) : (
                files.map((file, fileIndex) => (
                  <div key={`${file.name}-${fileIndex}`} className="mt-2">
                      <div className="flex items-center justify-between gap-2 font-medium text-sm px-2 text-sidebar-foreground/90">
                        <div className="flex items-center gap-2 truncate">
                           <FileIcon size={16}/>
                           <span className="truncate" title={file.name}>{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(fileIndex)}>
                            <X size={14} />
                        </Button>
                      </div>
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
                ))
            )}
            </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center border-b p-2 h-14">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/30 relative">
            {isUploading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="flex items-center gap-4 text-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p>Processing your files, please wait...</p>
                </div>
              </div>
            )}
            {activeView.type === 'none' && !isUploading && (
                <div className="flex items-center justify-center h-full">
                    <Card className="w-full max-w-lg text-center shadow-lg border-dashed border-2">
                        <CardHeader>
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                                <FileUp className="h-10 w-10 text-primary" />
                            </div>
                            <CardTitle className="text-2xl">Welcome to ExcelFlow</CardTitle>
                            <CardDescription className="text-base">
                                Your powerful AI-assisted tool for comparing and analyzing Excel files.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-6 text-muted-foreground">
                                Upload one or more Excel files to get started.
                            </p>
                            <Button size="lg" onClick={() => fileInputRef.current?.click()}>
                                Upload Your First File
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
            {activeView.type === 'merge' && <MergeView files={files} />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
