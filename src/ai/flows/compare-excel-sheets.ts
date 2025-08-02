'use server';

/**
 * @fileOverview Compares two Excel sheets, highlighting differences and suggesting key columns for comparison.
 *
 * - compareExcelSheets - A function that handles the comparison process.
 * - CompareExcelSheetsInput - The input type for the compareExcelSheets function.
 * - CompareExcelSheetsOutput - The return type for the compareExcelSheets function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CompareExcelSheetsInputSchema = z.object({
  excelSheet1DataUri: z
    .string()
    .describe(
      "The first Excel sheet as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  excelSheet2DataUri: z
    .string()
    .describe(
      "The second Excel sheet as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type CompareExcelSheetsInput = z.infer<typeof CompareExcelSheetsInputSchema>;

const CompareExcelSheetsOutputSchema = z.object({
  comparisonResult: z.string().describe('The comparison result between the two Excel sheets, highlighting differences and suggesting key columns.'),
  suggestedKeyColumn: z.string().describe('The suggested key column for comparing the two Excel sheets.'),
});
export type CompareExcelSheetsOutput = z.infer<typeof CompareExcelSheetsOutputSchema>;

export async function compareExcelSheets(input: CompareExcelSheetsInput): Promise<CompareExcelSheetsOutput> {
  return compareExcelSheetsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'compareExcelSheetsPrompt',
  input: {schema: CompareExcelSheetsInputSchema},
  output: {schema: CompareExcelSheetsOutputSchema},
  prompt: `You are an expert in comparing Excel sheets and identifying discrepancies.

You will receive two Excel sheets in data URI format. Your task is to compare these sheets, highlight the differences, and suggest the most relevant column for comparison.

Consider the content and structure of both sheets to determine the key column that would best serve as a basis for comparison.

Sheet 1: {{media url=excelSheet1DataUri}}
Sheet 2: {{media url=excelSheet2DataUri}}

Comparison Result: A detailed comparison highlighting added, removed, and changed rows, and any structural differences between the sheets.
Suggested Key Column: The name of the column that is most suitable for comparing the two sheets. For example, it could be an "ID" column, "Name" column, etc.
`,
});

const compareExcelSheetsFlow = ai.defineFlow(
  {
    name: 'compareExcelSheetsFlow',
    inputSchema: CompareExcelSheetsInputSchema,
    outputSchema: CompareExcelSheetsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
