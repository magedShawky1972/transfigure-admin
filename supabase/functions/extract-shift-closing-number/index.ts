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
    const { imageUrl, brandId, brandName } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brandId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get Supabase client to fetch training data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch training data for this brand
    const { data: trainingData, error: trainingError } = await supabase
      .from("brand_closing_training")
      .select("image_path, expected_number, notes")
      .eq("brand_id", brandId)
      .single();

    let trainingContext = "";
    let trainingImageUrl = "";

    if (trainingData && !trainingError) {
      // Get the training image URL
      if (trainingData.image_path) {
        const { data: signedUrlData } = await supabase.storage
          .from("closing-training")
          .createSignedUrl(trainingData.image_path, 3600);
        
        if (signedUrlData?.signedUrl) {
          trainingImageUrl = signedUrlData.signedUrl;
        }
      }

      trainingContext = `
TRAINING DATA FOR THIS BRAND (${brandName || "unknown"}):
- The expected closing number location was marked with a yellow square in the training image
- The expected number from training is: ${trainingData.expected_number || "unknown"}
- Notes: ${trainingData.notes || "none"}

IMPORTANT: Use the training image to understand WHERE the closing balance number is typically located in this brand's interface. 
The training image has a yellow square highlighting the exact location. Find the same location in the new image and extract the number from there.
`;
    }

    console.log("Extracting closing number for brand:", brandId, brandName);
    console.log("Has training data:", !!trainingData);

    // Build messages array for extraction and validation
    const messages: any[] = [
      {
        role: "system",
        content: `You are a number extraction assistant specialized in reading closing balance numbers from point-of-sale or financial system screenshots.

Your task is to:
1. FIRST - Validate if the uploaded image matches the expected brand interface (${brandName || "the specified brand"})
2. SECOND - If valid, extract the closing balance number from the image

${trainingContext}

Rules for brand validation:
- Compare the new image with the training image to verify they show the SAME brand/application interface
- Look for brand identifiers like logos, app names, or distinctive UI elements
- If the image shows a DIFFERENT brand's interface (different app name, different UI layout), mark it as INVALID

Rules for number extraction:
- Look for the closing balance / total / remaining balance number in the image
- If training data is provided, use the training image to learn WHERE the number is located, then find the same location in the new image
- Extract ONLY the numeric value (digits only, no currency symbols or text)
- If you find a decimal number, include the decimal point

Response format (JSON):
{
  "isValidBrand": true/false,
  "extractedNumber": "number or NOT_FOUND",
  "brandMismatchReason": "explanation if invalid, empty if valid"
}

IMPORTANT: Return ONLY valid JSON, no other text.`
      }
    ];

    // Add user message with both training image (if available) and the new image
    const userContent: any[] = [];
    
    if (trainingImageUrl) {
      userContent.push({
        type: "text",
        text: `Here is the training image for brand "${brandName}" showing WHERE the closing number is located (marked with yellow square):`
      });
      userContent.push({
        type: "image_url",
        image_url: { url: trainingImageUrl }
      });
      userContent.push({
        type: "text",
        text: `Now validate if this NEW image is for the SAME brand "${brandName}" and extract the number from the SAME LOCATION:`
      });
    } else {
      userContent.push({
        type: "text",
        text: `Find and extract the closing balance number from this image for brand "${brandName}":`
      });
    }

    userContent.push({
      type: "image_url",
      image_url: { url: imageUrl }
    });

    messages.push({
      role: "user",
      content: userContent
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
    
    console.log("AI Response:", extractedText);

    // Try to parse the JSON response
    let isValidBrand = true;
    let extractedNumber: number | null = null;
    let brandMismatchReason = "";

    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedText = extractedText;
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const jsonResponse = JSON.parse(cleanedText);
      isValidBrand = jsonResponse.isValidBrand !== false;
      brandMismatchReason = jsonResponse.brandMismatchReason || "";

      if (jsonResponse.extractedNumber && jsonResponse.extractedNumber !== "NOT_FOUND") {
        const cleanedNumber = String(jsonResponse.extractedNumber).replace(/[^\d.-]/g, "");
        const parsed = parseFloat(cleanedNumber);
        if (!isNaN(parsed)) {
          extractedNumber = parsed;
        }
      }
    } catch (parseError) {
      console.log("Failed to parse JSON, falling back to text extraction");
      // Fallback: try to extract number from the text directly
      if (extractedText && extractedText !== "NOT_FOUND") {
        const cleanedText = extractedText.replace(/[^\d.-]/g, "");
        const parsed = parseFloat(cleanedText);
        if (!isNaN(parsed)) {
          extractedNumber = parsed;
        }
      }
    }

    console.log("Parsed result - isValidBrand:", isValidBrand, "extractedNumber:", extractedNumber, "mismatchReason:", brandMismatchReason);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedNumber,
        isValidBrand,
        brandMismatchReason,
        rawText: extractedText,
        hasTrainingData: !!trainingData
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
