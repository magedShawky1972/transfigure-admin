import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, imageData, fileName } = await req.json();

    if (!invoiceId || !imageData) {
      return new Response(
        JSON.stringify({ error: "Missing invoiceId or imageData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Extracting cost from invoice:", invoiceId, "File:", fileName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from("software_license_invoices")
      .update({ ai_extraction_status: "processing" })
      .eq("id", invoiceId);

    // Prepare the prompt for AI extraction
    const systemPrompt = `You are an invoice data extractor. Analyze the invoice image and extract the following information:
1. Total amount/cost (look for "Total", "Amount Due", "Grand Total", "المبلغ الإجمالي", "المجموع", "Subtotal")
2. Currency (USD, SAR, EUR, etc. - look for currency symbols like $, ﷼, € or text)

Return ONLY valid JSON in this exact format:
{"cost": 123.45, "currency": "USD"}

Rules:
- Extract only the final total amount, not subtotals or individual items
- If multiple amounts exist, extract the largest one (usually the grand total)
- If no currency is explicitly stated, assume USD
- Convert Arabic numerals (٠١٢٣٤٥٦٧٨٩) to English numerals
- If you cannot find any amount, return {"cost": null, "currency": null, "error": "Could not extract cost from invoice"}
- Do NOT include markdown, just pure JSON`;

    // Call AI to extract invoice data - imageData should be base64 data URL
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
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: imageData } }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      // Update with error status
      await supabase
        .from("software_license_invoices")
        .update({ 
          ai_extraction_status: "error",
          ai_extraction_error: `AI gateway error: ${response.status}`
        })
        .eq("id", invoiceId);

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
    
    console.log("AI response:", content);

    // Parse the JSON response
    let extractedData: { cost: number | null; currency: string | null; error?: string } = {
      cost: null,
      currency: null
    };

    try {
      // Clean up markdown if present
      let jsonContent = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      
      // Extract JSON object if wrapped in other text
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      extractedData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      extractedData = { cost: null, currency: null, error: "Failed to parse AI response" };
    }

    // Calculate SAR conversion if we have a cost
    let costSar: number | null = null;
    if (extractedData.cost !== null && extractedData.currency) {
      // Get currency rates from database
      const { data: currencies } = await supabase
        .from("currencies")
        .select("id, currency_code, is_base")
        .eq("is_active", true);

      const { data: rates } = await supabase
        .from("currency_rates")
        .select("currency_id, rate_to_base, conversion_operator");

      if (currencies && rates) {
        const currencyInfo = currencies.find(c => c.currency_code === extractedData.currency);
        const sarInfo = currencies.find(c => c.currency_code === "SAR");
        
        if (currencyInfo && sarInfo) {
          const currencyRate = rates.find(r => r.currency_id === currencyInfo.id);
          
          // Convert to base currency (SAR) using the operator
          if (currencyRate && currencyRate.rate_to_base) {
            const operator = currencyRate.conversion_operator || 'multiply';
            if (operator === 'multiply') {
              costSar = extractedData.cost * currencyRate.rate_to_base;
            } else {
              costSar = extractedData.cost / currencyRate.rate_to_base;
            }
          } else if (currencyInfo.is_base) {
            costSar = extractedData.cost;
          } else if (extractedData.currency === "SAR") {
            costSar = extractedData.cost;
          } else if (extractedData.currency === "USD") {
            // Default USD to SAR conversion
            costSar = extractedData.cost * 3.75;
          } else {
            costSar = extractedData.cost;
          }
        } else if (extractedData.currency === "USD") {
          costSar = extractedData.cost * 3.75;
        } else if (extractedData.currency === "SAR") {
          costSar = extractedData.cost;
        }
      } else if (extractedData.currency === "USD") {
        costSar = extractedData.cost * 3.75;
      } else if (extractedData.currency === "SAR") {
        costSar = extractedData.cost;
      }
    }

    // Update the invoice record with extracted data
    const updateData: Record<string, any> = {
      ai_extraction_status: extractedData.cost !== null ? "completed" : "error",
      ai_extraction_error: extractedData.error || null,
    };

    if (extractedData.cost !== null) {
      updateData.extracted_cost = extractedData.cost;
      updateData.cost_currency = extractedData.currency;
      updateData.cost_sar = costSar;
    }

    const { error: updateError } = await supabase
      .from("software_license_invoices")
      .update(updateData)
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Failed to update invoice:", updateError);
      throw updateError;
    }

    console.log("Invoice updated successfully:", {
      cost: extractedData.cost,
      currency: extractedData.currency,
      costSar
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        cost: extractedData.cost,
        currency: extractedData.currency,
        costSar,
        error: extractedData.error
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error extracting invoice cost:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
