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
    const { imageUrl } = await req.json();
    
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

    console.log("Extracting number from image:", imageUrl);

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
            content: `You are a number extraction assistant. Your task is to find and extract the number that is highlighted with a yellow square/box in the image. 
            
Rules:
- Look for any yellow highlighted area, yellow box, or yellow square in the image
- Extract ONLY the number that is inside or near the yellow highlight
- Return ONLY the numeric value (digits only, no text)
- If you find a decimal number, include the decimal point
- If you cannot find a yellow highlighted number, return "NOT_FOUND"
- Do not include any explanation, just the number or NOT_FOUND`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Find and extract the number that is highlighted with a yellow square/box in this image. Return only the number."
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedNumber,
        rawText: extractedText 
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
