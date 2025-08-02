export type ExcelRow = Record<string, any>;

export type ExcelSheet = {
  name: string;
  data: ExcelRow[];
};

export type ExcelFile = {
  name: string;
  sheets: ExcelSheet[];
};
