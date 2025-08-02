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
      "The first Excel sheet as a text/csv data URI. Expected format: 'data:text/csv;base64,<encoded_data>'."
    ),
  excelSheet2DataUri: z
    .string()
    .describe(
        "The second Excel sheet as a text/csv data URI. Expected format: 'data:text/csv;base64,<encoded_data>'."
    ),
  keyColumn1: z.string().describe('The key column name for the first sheet.'),
  keyColumn2: z.string().describe('The key column name for the second sheet.'),
});
export type CompareExcelSheetsInput = z.infer<typeof CompareExcelSheetsInputSchema>;

const ComparisonRowSchema = z.object({
  comparisonStatus: z.enum(["Matched", "In Sheet 1 Only", "In Sheet 2 Only"]),
  // data is now a string that we will parse as JSON. This avoids the schema issue with dynamic keys.
  data: z.string().describe("A JSON string representing the merged data for the row.")
});

const CompareExcelSheetsOutputSchema = z.object({
  // The keyColumn is now derived from the input, but we'll keep it in the output for consistency on the frontend.
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
  // We pass the user-selected key directly to the flow and get it back.
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
  prompt: `You are an expert data analyst. Your task is to compare two CSV datasets based on user-provided key columns.

**Instructions:**

1.  **Use Provided Key Columns:**
    *   For Sheet 1, the key column is: '{{{keyColumn1}}}'
    *   For Sheet 2, the key column is: '{{{keyColumn2}}}'
2.  **Compare and Merge Data:**
    *   "Matched": Rows where the value in '{{{keyColumn1}}}' from Sheet 1 matches the value in '{{{keyColumn2}}}' from Sheet 2. Merge their data.
    *   "In Sheet 1 Only": Rows from Sheet 1 with no matching key in Sheet 2.
    *   "In Sheet 2 Only": Rows from Sheet 2 with no matching key in Sheet 1.
3.  **Format Output:** The final output MUST be a single JSON object. This object must have two top-level properties:
    *   'keyColumn': A string containing the name of the primary key column you used from Sheet 1, which is '{{{keyColumn1}}}'.
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
    // If the model for some reason still fails to provide a keyColumn, we will inject it ourselves from the input to prevent a crash.
    if (output && !output.keyColumn) {
      output.keyColumn = input.keyColumn1;
    }
    return output!;
  }
);
