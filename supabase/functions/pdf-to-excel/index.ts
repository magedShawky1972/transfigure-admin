import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileData, fileName } = await req.json();

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: "No file data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing PDF file:", fileName);

    // Use AI to extract tabular data from the PDF
    const systemPrompt = `You are an expert at extracting tabular data from PDF documents. Your task is to analyze the provided PDF content and extract ALL data into a structured table format.

Instructions:
1. Identify all tabular data, lists, or structured information in the document
2. Convert the data into a 2D array format suitable for Excel
3. The first row should be headers/column names
4. Each subsequent row should contain the data
5. If the PDF contains multiple tables, combine them if they have similar structure, or use the most comprehensive one
6. Handle Arabic text properly - preserve RTL text as-is
7. Clean up any formatting issues, extra spaces, or special characters
8. If no clear table exists, extract key-value pairs as a two-column table

IMPORTANT: Return ONLY a valid JSON object with a "tableData" key containing a 2D array. No explanations, no markdown, just the JSON.

Example output format:
{"tableData": [["Column1", "Column2", "Column3"], ["Value1", "Value2", "Value3"], ["Value4", "Value5", "Value6"]]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all tabular data from this PDF document and return it as a JSON object with a "tableData" key containing a 2D array. The file name is: ${fileName}`
              },
              {
                type: "image_url",
                image_url: {
                  url: fileData
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("AI response:", content.substring(0, 500));

    // Parse the JSON response
    let tableData: any[][] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"tableData"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        tableData = parsed.tableData;
      } else {
        // Try direct parse
        const parsed = JSON.parse(content);
        tableData = parsed.tableData || parsed;
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // Fallback: try to extract any array-like structure
      const arrayMatch = content.match(/\[\s*\[[\s\S]*\]\s*\]/);
      if (arrayMatch) {
        tableData = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error("Could not parse table data from AI response");
      }
    }

    if (!Array.isArray(tableData) || tableData.length === 0) {
      throw new Error("No valid table data extracted from PDF");
    }

    console.log("Extracted table data rows:", tableData.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tableData,
        rowCount: tableData.length,
        columnCount: tableData[0]?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
