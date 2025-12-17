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
    const { fileData, fileName, selectionArea, pageNumber, totalPages } = await req.json();

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

    console.log("Processing page:", pageNumber, "of", totalPages, "from file:", fileName);
    console.log("Selection area:", selectionArea);

    // Build area selection instruction for the AI
    let areaInstruction = "";
    if (selectionArea && selectionArea.width > 0 && selectionArea.height > 0) {
      const leftPercent = Math.round(selectionArea.x);
      const topPercent = Math.round(selectionArea.y);
      const rightPercent = Math.round(selectionArea.x + selectionArea.width);
      const bottomPercent = Math.round(selectionArea.y + selectionArea.height);
      
      areaInstruction = `
IMPORTANT: The user has selected a specific area of the document to extract. 
Focus ONLY on the content within this region:
- Left edge: ${leftPercent}% from left
- Top edge: ${topPercent}% from top  
- Right edge: ${rightPercent}% from left
- Bottom edge: ${bottomPercent}% from top

Ignore any content outside this selected area.`;
    }

    // Use Lovable AI to extract tabular data - using flash model for better accuracy
    const systemPrompt = `Extract table data from this image as JSON. Return ONLY: {"tableData": [["Header1","Header2"],["Val1","Val2"]]}
Rules: Pure JSON only, no markdown, Arabic text OK, use "" for empty cells.${areaInstruction ? ` Extract only from area: left ${Math.round(selectionArea.x)}% to ${Math.round(selectionArea.x + selectionArea.width)}%, top ${Math.round(selectionArea.y)}% to ${Math.round(selectionArea.y + selectionArea.height)}%` : ''}`;

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
            role: "user",
            content: [
              {
                type: "text",
                text: systemPrompt
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

    // Parse the JSON response
    let tableData: any[][] = [];
    let jsonContent = content;
    
    // Remove markdown code blocks if present
    jsonContent = jsonContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    // Strategy 1: Direct parse
    try {
      const parsed = JSON.parse(jsonContent);
      tableData = parsed.tableData || (Array.isArray(parsed) ? parsed : []);
      console.log("Direct parse succeeded");
    } catch (e1) {
      console.log("Direct parse failed, trying repair...");
      
      // Strategy 2: Find last complete row and close JSON
      try {
        // Find the position of tableData array
        const tableDataStart = jsonContent.indexOf('"tableData"');
        if (tableDataStart === -1) throw new Error("No tableData found");
        
        const arrayStart = jsonContent.indexOf('[', tableDataStart);
        if (arrayStart === -1) throw new Error("No array found");
        
        // Find all complete rows (ending with ])
        let lastCompleteRowEnd = -1;
        let depth = 0;
        let inStr = false;
        
        for (let i = arrayStart; i < jsonContent.length; i++) {
          const c = jsonContent[i];
          const prev = i > 0 ? jsonContent[i-1] : '';
          
          if (c === '"' && prev !== '\\') inStr = !inStr;
          if (inStr) continue;
          
          if (c === '[') depth++;
          if (c === ']') {
            depth--;
            if (depth === 1) { // End of a row (depth 1 = inside outer array)
              lastCompleteRowEnd = i;
            }
          }
        }
        
        if (lastCompleteRowEnd > arrayStart) {
          // Truncate at last complete row and close the JSON
          const truncated = jsonContent.substring(0, lastCompleteRowEnd + 1) + ']}';
          console.log("Attempting to parse truncated JSON ending at:", lastCompleteRowEnd);
          const parsed = JSON.parse(truncated);
          tableData = parsed.tableData || [];
          console.log("Truncated parse succeeded with", tableData.length, "rows");
        } else {
          throw new Error("No complete rows found");
        }
      } catch (e2) {
        console.error("All parsing strategies failed:", e2);
        
        // Strategy 3: Extract any arrays we can find
        const rowMatches = jsonContent.match(/\["[^"]*"(?:,"[^"]*")*\]/g);
        if (rowMatches && rowMatches.length > 0) {
          const parsedRows: any[][] = [];
          for (const row of rowMatches) {
            try { parsedRows.push(JSON.parse(row)); } catch { /* skip invalid */ }
          }
          tableData = parsedRows;
          console.log("Extracted", tableData.length, "rows via regex");
        }
        
        if (tableData.length === 0) {
          throw new Error("Could not parse table data from AI response");
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