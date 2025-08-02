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
  // Changed to expect CSV data as a text-based data URI
  excelSheet1DataUri: z
    .string()
    .describe(
      "The first Excel sheet as a text/csv data URI. Expected format: 'data:text/csv;base64,<encoded_data>'."
    ),
  excelSheet2DataUri: z
    .string()
    .describe(
        "The second Excel sheet as a text/csv data URI. Expected format: 'data:text/csv;base64,<encoded_data>'."
    ),
});
export type CompareExcelSheetsInput = z.infer<typeof CompareExcelSheetsInputSchema>;

const ComparisonRowSchema = z.object({
  comparisonStatus: z.enum(["Matched", "In Sheet 1 Only", "In Sheet 2 Only"]),
  // data is now a string that we will parse as JSON. This avoids the schema issue with dynamic keys.
  data: z.string().describe("A JSON string representing the merged data for the row.")
});

const CompareExcelSheetsOutputSchema = z.object({
  keyColumn: z.string().describe('The name of the column used as the key for comparison.'),
  comparison: z.array(ComparisonRowSchema).describe("An array of rows representing the comparison result. Each row has a status and the combined data from the sheets."),
});

// The final output type we'll use in the application, with `data` parsed.
export type CompareExcelSheetsOutput = {
    keyColumn: string;
    comparison: {
        comparisonStatus: "Matched" | "In Sheet 1 Only" | "In Sheet 2 Only";
        data: Record<string, any>;
    }[];
};


export async function compareExcelSheets(input: CompareExcelSheetsInput): Promise<CompareExcelSheetsOutput> {
  const result = await compareExcelSheetsFlow(input);

  // Parse the `data` string in each comparison item.
  const parsedComparison = result.comparison.map(item => {
    try {
        return {
            ...item,
            data: JSON.parse(item.data),
        };
    } catch (e) {
        console.error("Failed to parse row data:", item.data);
        // Return a default structure on error to prevent crashes
        return {
            ...item,
            data: { error: 'Failed to parse data' }
        };
    }
  });

  return {
    ...result,
    comparison: parsedComparison,
  }
}

const prompt = ai.definePrompt({
  name: 'compareExcelSheetsPrompt',
  input: {schema: CompareExcelSheetsInputSchema},
  output: {schema: CompareExcelSheetsOutputSchema},
  model: 'googleai/gemini-2.0-flash',
  prompt: `You are an expert data analyst. Your task is to compare two CSV datasets and return a structured JSON result.

**Instructions:**

1.  **Identify Key Column:** Analyze the headers and data of both sheets to determine the best column for matching rows. This is likely an ID, email, or phone number column.
2.  **Compare and Merge Data:**
    *   "Matched": Rows with the same key in both sheets. Merge their data.
    *   "In Sheet 1 Only": Rows from Sheet 1 with no matching key in Sheet 2.
    *   "In Sheet 2 Only": Rows from Sheet 2 with no matching key in Sheet 1.
3.  **Format Output:** The final output MUST be a single JSON object. This object must have two top-level properties:
    *   'keyColumn': A string containing the name of the column you chose for matching.
    *   'comparison': An array of objects. Each object in this array must contain:
        *   'comparisonStatus': One of "Matched", "In Sheet 1 Only", or "In Sheet 2 Only".
        *   'data': A valid, escaped JSON string representing the row's data.

**Data:**

Sheet 1 (CSV):
{{media url=excelSheet1DataUri}}

Sheet 2 (CSV):
{{media url=excelSheet2DataUri}}

**CRITICAL:** Now, generate the complete JSON object as described in the "Format Output" section.
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
