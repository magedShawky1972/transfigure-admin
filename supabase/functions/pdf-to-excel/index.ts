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

    // Use Lovable AI to extract tabular data from the PDF
    const systemPrompt = `You are an expert at extracting tabular data from PDF documents. Extract ALL data into a 2D array format.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Output format: {"tableData": [["Header1", "Header2"], ["Val1", "Val2"]]}
3. First row = headers, subsequent rows = data
4. Handle Arabic text properly
5. Replace null/empty with empty string ""
6. Keep response compact - no extra whitespace`;

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
                text: `Extract tabular data from this PDF as JSON: {"tableData": [[headers], [row1], [row2]...]}`
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
        max_tokens: 16384,
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
    
    console.log("AI response length:", content.length);
    console.log("AI response preview:", content.substring(0, 500));

    // Parse the JSON response with multiple fallback strategies
    let tableData: any[][] = [];
    let jsonContent = content;
    
    // Remove markdown code blocks if present
    if (jsonContent.includes("```json")) {
      jsonContent = jsonContent.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    } else if (jsonContent.includes("```")) {
      jsonContent = jsonContent.replace(/```\s*/g, "");
    }
    
    jsonContent = jsonContent.trim();
    
    // Try to find and parse the JSON object
    try {
      // Strategy 1: Direct parse
      const parsed = JSON.parse(jsonContent);
      tableData = parsed.tableData || parsed;
    } catch (e1) {
      console.log("Direct parse failed, trying extraction...");
      
      try {
        // Strategy 2: Extract JSON object containing tableData
        const jsonMatch = jsonContent.match(/\{[\s\S]*"tableData"\s*:\s*\[[\s\S]*\]\s*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          tableData = parsed.tableData;
        } else {
          throw new Error("No tableData object found");
        }
      } catch (e2) {
        console.log("JSON extraction failed, trying array extraction...");
        
        try {
          // Strategy 3: Extract just the array
          const arrayMatch = jsonContent.match(/\[\s*\[[\s\S]*?\]\s*(?:,\s*\[[\s\S]*?\]\s*)*\]/);
          if (arrayMatch) {
            tableData = JSON.parse(arrayMatch[0]);
          } else {
            throw new Error("No array found");
          }
        } catch (e3) {
          console.log("Array extraction failed, trying to repair truncated JSON...");
          
          // Strategy 4: Try to repair truncated JSON
          let repaired = jsonContent;
          
          // If it starts with { and contains tableData, try to close it
          if (repaired.includes('"tableData"') && repaired.includes('[')) {
            // Find all unclosed brackets and quotes
            let openBrackets = 0;
            let openBraces = 0;
            let inString = false;
            let lastGoodIndex = 0;
            
            for (let i = 0; i < repaired.length; i++) {
              const char = repaired[i];
              const prevChar = i > 0 ? repaired[i-1] : '';
              
              if (char === '"' && prevChar !== '\\') {
                inString = !inString;
              }
              
              if (!inString) {
                if (char === '[') openBrackets++;
                if (char === ']') {
                  openBrackets--;
                  if (openBrackets >= 0) lastGoodIndex = i;
                }
                if (char === '{') openBraces++;
                if (char === '}') {
                  openBraces--;
                  if (openBraces >= 0) lastGoodIndex = i;
                }
              }
            }
            
            // Try to close any open structures
            if (inString) repaired += '"';
            while (openBrackets > 0) {
              repaired += ']';
              openBrackets--;
            }
            while (openBraces > 0) {
              repaired += '}';
              openBraces--;
            }
            
            try {
              const parsed = JSON.parse(repaired);
              tableData = parsed.tableData || parsed;
              console.log("Repaired JSON successfully");
            } catch (e4) {
              console.error("All parsing strategies failed");
              throw new Error("Could not parse table data from AI response");
            }
          } else {
            throw new Error("Could not parse table data from AI response");
          }
        }
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