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
    const { fileData, fileName, selectionArea, autoDetectTable, pageNumber, totalPages } = await req.json();

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
    console.log("Auto-detect table:", autoDetectTable);

    // Build the prompt based on mode
    let systemPrompt = "";
    
    if (autoDetectTable) {
      // Auto-detect mode: AI finds and extracts table areas automatically
      systemPrompt = `Analyze this image and automatically detect any TABLE areas. Extract ONLY the tabular data (rows and columns) from the detected table(s).
IGNORE all non-table content such as: headers, footers, logos, titles, paragraphs, watermarks, page numbers.
Return ONLY: {"tableData": [["Header1","Header2"],["Val1","Val2"]]}
Rules: Pure JSON only, no markdown, Arabic text OK, use "" for empty cells. IMPORTANT: Convert ALL Arabic numerals (٠١٢٣٤٥٦٧٨٩) to English numerals (0123456789).`;
    } else if (selectionArea && selectionArea.width > 0 && selectionArea.height > 0) {
      // Manual selection mode
      const leftPercent = Math.round(selectionArea.x);
      const topPercent = Math.round(selectionArea.y);
      const rightPercent = Math.round(selectionArea.x + selectionArea.width);
      const bottomPercent = Math.round(selectionArea.y + selectionArea.height);
      
      systemPrompt = `Extract table data from this image as JSON. Return ONLY: {"tableData": [["Header1","Header2"],["Val1","Val2"]]}
Rules: Pure JSON only, no markdown, Arabic text OK, use "" for empty cells. IMPORTANT: Convert ALL Arabic numerals (٠١٢٣٤٥٦٧٨٩) to English numerals (0123456789).
Extract only from area: left ${leftPercent}% to ${rightPercent}%, top ${topPercent}% to ${bottomPercent}%`;
    } else {
      // Fallback: extract all table data from the page
      systemPrompt = `Extract table data from this image as JSON. Return ONLY: {"tableData": [["Header1","Header2"],["Val1","Val2"]]}
Rules: Pure JSON only, no markdown, Arabic text OK, use "" for empty cells. IMPORTANT: Convert ALL Arabic numerals (٠١٢٣٤٥٦٧٨٩) to English numerals (0123456789).`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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

    const sanitize = (s: string) =>
      s
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

    let jsonContent = sanitize(content);

    const tryParse = (s: string) => {
      const parsed = JSON.parse(s);
      const td = parsed?.tableData ?? (Array.isArray(parsed) ? parsed : []);
      return td as any[][];
    };

    const extractJsonObject = (s: string) => {
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) return null;
      return s.slice(start, end + 1);
    };

    const extractTableDataArray = (s: string) => {
      const keyPos = s.indexOf('"tableData"');
      if (keyPos === -1) return null;
      const arrayStart = s.indexOf("[", keyPos);
      if (arrayStart === -1) return null;

      // Bracket-match the tableData array (tolerant to trailing junk after it)
      let depth = 0;
      let inStr = false;
      for (let i = arrayStart; i < s.length; i++) {
        const c = s[i];
        const prev = i > 0 ? s[i - 1] : "";
        if (c === '"' && prev !== "\\") inStr = !inStr;
        if (inStr) continue;
        if (c === "[") depth++;
        if (c === "]") {
          depth--;
          if (depth === 0) {
            return s.slice(arrayStart, i + 1);
          }
        }
      }

      // Truncated: return whatever we got (we'll attempt row-based repair next)
      return s.slice(arrayStart);
    };

    // Strategy 1: direct parse
    try {
      tableData = tryParse(jsonContent);
      console.log("Direct parse succeeded");
    } catch {
      console.log("Direct parse failed, trying extraction...");

      // Strategy 2: extract the JSON object portion and parse
      try {
        const obj = extractJsonObject(jsonContent);
        if (!obj) throw new Error("No JSON object found");
        tableData = tryParse(obj);
        console.log("Object extraction parse succeeded");
      } catch {
        console.log("Object extraction failed, trying tableData array repair...");

        // Strategy 3: extract tableData array; if truncated, keep only complete rows
        try {
          const arr = extractTableDataArray(jsonContent);
          if (!arr) throw new Error("No tableData array found");

          // If it's complete, this will work
          try {
            const wrapped = `{"tableData": ${arr}}`;
            tableData = tryParse(wrapped);
            console.log("Array wrapped parse succeeded");
          } catch {
            // Truncated: keep only complete rows and close the structure
            let lastCompleteRowEnd = -1;
            let depth = 0;
            let inStr = false;
            for (let i = 0; i < arr.length; i++) {
              const c = arr[i];
              const prev = i > 0 ? arr[i - 1] : "";
              if (c === '"' && prev !== "\\") inStr = !inStr;
              if (inStr) continue;
              if (c === "[") depth++;
              if (c === "]") {
                depth--;
                // depth === 1 means we just closed a row inside the outer array
                if (depth === 1) lastCompleteRowEnd = i;
              }
            }

            if (lastCompleteRowEnd <= 0) throw new Error("No complete rows found");
            const repairedArr = arr.slice(0, lastCompleteRowEnd + 1) + "]";
            const wrapped = `{"tableData": ${repairedArr}}`;
            tableData = tryParse(wrapped);
            console.log("Repaired truncated parse succeeded with", tableData.length, "rows");
          }
        } catch (e) {
          console.error("All parsing strategies failed:", e);

          // Strategy 4: regex row extraction (supports strings + numbers + null/bool)
          const token = '(?:"(?:\\\\.|[^"\\\\])*"|null|true|false|-?\\d+(?:\\.\\d+)?)';
          const rowRe = new RegExp(`\\[(?:\\s*${token}\\s*)(?:,\\s*${token}\\s*)*\\]`, "g");
          const rowMatches = jsonContent.match(rowRe);

          if (rowMatches && rowMatches.length > 0) {
            const parsedRows: any[][] = [];
            for (const row of rowMatches) {
              try {
                parsedRows.push(JSON.parse(row));
              } catch {
                /* skip invalid */
              }
            }
            tableData = parsedRows;
            console.log("Extracted", tableData.length, "rows via regex");
          }

          if (tableData.length === 0) {
            throw new Error("Could not parse table data from AI response");
          }
        }
      }
    }


    // Convert Arabic numerals to English numerals in all cells
    const arabicToEnglishNumerals = (str: string): string => {
      const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      let result = str;
      arabicNumerals.forEach((arabic, index) => {
        result = result.replace(new RegExp(arabic, 'g'), index.toString());
      });
      return result;
    };

    // Convert Arabic number format where first comma from right is decimal, second is thousands
    // Example: "1,234,56" -> "1234.56"
    const convertArabicNumberFormat = (str: string): string => {
      // Check if the string looks like a number with commas (digits and commas only, possibly with minus)
      const numberPattern = /^-?[\d,]+$/;
      if (!numberPattern.test(str.trim())) {
        return str;
      }
      
      const trimmed = str.trim();
      const commas = (trimmed.match(/,/g) || []).length;
      
      if (commas === 0) {
        return str;
      }
      
      if (commas === 1) {
        // Single comma = decimal separator
        return trimmed.replace(',', '.');
      }
      
      // Multiple commas: first from right is decimal, rest are thousands
      const lastCommaIndex = trimmed.lastIndexOf(',');
      const beforeLastComma = trimmed.substring(0, lastCommaIndex);
      const afterLastComma = trimmed.substring(lastCommaIndex + 1);
      
      // Remove all remaining commas (thousands separators) and add decimal point
      const cleanedNumber = beforeLastComma.replace(/,/g, '') + '.' + afterLastComma;
      return cleanedNumber;
    };

    // Apply conversions to all table cells
    tableData = tableData.map(row => 
      row.map((cell: any) => {
        if (typeof cell === 'string') {
          let result = arabicToEnglishNumerals(cell);
          result = convertArabicNumberFormat(result);
          return result;
        }
        return cell;
      })
    );

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