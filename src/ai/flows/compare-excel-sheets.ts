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
  prompt: `You are an expert data analyst specializing in comparing and merging data from different Excel sheets provided as CSV data.

You will receive two sheets as CSV data. Your task is to perform a detailed comparison and return a structured result.

1.  **Identify the Key Column:** Analyze both sheets to find the most suitable column to use as a unique identifier for matching rows. This is often an ID, email, or phone number column, even if the column names differ (e.g., "Phone Number" vs "member phone").
2.  **Compare and Merge:**
    *   Iterate through the rows of both sheets.
    *   If a row from Sheet 1 has a matching key in Sheet 2, merge their data. The 'comparisonStatus' for this row should be "Matched".
    *   If a row from Sheet 1 does not have a matching key in Sheet 2, its 'comparisonStatus' should be "In Sheet 1 Only".
    *   If a row from Sheet 2 does not have a matching key in Sheet 1, its 'comparisonStatus' should be "In Sheet 2 Only".
3.  **Format Output:** Return the result as a JSON object with two fields:
    *   "keyColumn": The name of the column you identified and used for the comparison.
    *   "comparison": An array of objects, where each object has:
        *   "comparisonStatus": One of "Matched", "In Sheet 1 Only", or "In Sheet 2 Only".
        *   "data": A JSON string representing the object containing all the columns and values for that row. For matched rows, this will be a merged record. Ensure this is a valid, escaped JSON string.

Sheet 1 (CSV format):
{{media url=excelSheet1DataUri}}

Sheet 2 (CSV format):
{{media url=excelSheet2DataUri}}
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
