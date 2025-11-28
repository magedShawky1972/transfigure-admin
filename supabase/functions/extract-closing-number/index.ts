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
    const { imageUrl, brandId, brandName, retryCount = 0 } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Extracting number from image:", imageUrl, "Brand:", brandName, "Retry:", retryCount);

    const systemPrompt = `You are an expert at reading numbers from voice chat app screenshots. Your task is to find and extract the main balance/coins number displayed in the screenshot.

IMPORTANT: These are screenshots from Arabic voice chat apps like:
- بينمو (Binmo)
- سول فري (Soul Free) 
- سيلا شات (Sila Chat)
- صدى لايف (Sada Live)
- هوى شات (Hawa Chat)
- هيلا شات (Hila Chat)
- يوهو (Yoho)

What to look for:
1. The MAIN BALANCE or COINS number - this is usually the largest/most prominent number on the screen
2. It's typically displayed near the top of the screen or in a prominent position
3. The number represents the user's coin/diamond/points balance
4. It may have commas as thousand separators (e.g., 13,489,032)
5. It might be near icons showing coins, diamonds, or currency symbols

Rules:
- Extract ONLY the main balance number (the largest prominent number showing total coins/balance)
- Return ONLY the numeric value (digits only)
- Include commas if present in the original number (e.g., "13,489,032")
- If multiple numbers exist, choose the one that represents the MAIN BALANCE (usually the largest/most prominent)
- If you cannot find a clear balance number, return "NOT_FOUND"
- Do not include any explanation, just the number or NOT_FOUND`;

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
                text: brandName 
                  ? `This is a screenshot from "${brandName}" voice chat app. Find and extract the main balance/coins number displayed on the screen. Return only the number.`
                  : "Find and extract the main balance/coins number displayed on this voice chat app screenshot. Return only the number."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
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
    const extractedText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("Extracted text:", extractedText);

    // Try to parse the number
    let extractedNumber: number | null = null;
    if (extractedText && extractedText !== "NOT_FOUND") {
      // Remove any non-numeric characters except decimal point and minus
      const cleanedText = extractedText.replace(/[^\d.-]/g, "");
      const parsed = parseFloat(cleanedText);
      if (!isNaN(parsed)) {
        extractedNumber = parsed;
      }
    }

    // If extraction failed and we haven't retried too many times, indicate retry is possible
    const canRetry = extractedNumber === null && retryCount < 2;

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedNumber,
        rawText: extractedText,
        canRetry,
        retryCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error extracting number:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
