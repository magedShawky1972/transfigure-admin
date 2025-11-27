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

    let trainingImageUrl = "";

    if (trainingData && !trainingError) {
      // Get the training image URL
      if (trainingData.image_path) {
        // Check if it's already a full URL (public bucket) or just a path
        if (trainingData.image_path.startsWith('http')) {
          trainingImageUrl = trainingData.image_path;
        } else {
          const { data: signedUrlData } = await supabase.storage
            .from("closing-training")
            .createSignedUrl(trainingData.image_path, 3600);
          
          if (signedUrlData?.signedUrl) {
            trainingImageUrl = signedUrlData.signedUrl;
          }
        }
      }
    }

    console.log("Extracting closing number for brand:", brandId, brandName);
    console.log("Has training data:", !!trainingData);
    console.log("Training image URL:", trainingImageUrl ? "available" : "not available");

    // Build messages array for extraction and validation
    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert image validator and number extractor for point-of-sale closing balance screenshots.

CRITICAL TASK: You MUST validate if the NEW image matches the SAME application/brand as the TRAINING image.

BRAND VALIDATION RULES (VERY STRICT):
1. Compare the APPLICATION NAME visible in both images - they MUST match exactly
2. Compare the UI LAYOUT - header, buttons, colors, structure must be similar
3. Compare the COLOR SCHEME - background colors, accent colors
4. Look for BRAND LOGOS or IDENTIFIABLE ELEMENTS
5. If the app name is different (e.g., "Hawa" vs "Soul Free" vs "Sila Chat" vs "Binmo"), mark as INVALID
6. If the UI layout is significantly different, mark as INVALID
7. Arabic app names to watch: بينمو، سول فري، سيلا شات، صدى لايف، هوى شات، هيلا شات، يوهو

IMPORTANT: Different voice chat apps (Hawa Chat, Soul Free, Sila Chat, Binmo, Yoho, etc.) have DIFFERENT UIs. Do NOT confuse them!

NUMBER EXTRACTION RULES:
- Only extract the number if brand is VALID
- Look for the closing balance / total / coins number in the highlighted area
- Extract ONLY numeric digits (no currency symbols)

Response format (JSON only, no markdown):
{
  "isValidBrand": true or false,
  "extractedNumber": "number or NOT_FOUND",
  "brandMismatchReason": "explain why invalid (e.g., 'Image shows Hawa Chat app but expected Soul Free')"
}

Return ONLY the JSON object, no other text or markdown formatting.`
      }
    ];

    // Add user message with both training image (if available) and the new image
    const userContent: any[] = [];
    
    if (trainingImageUrl) {
      userContent.push({
        type: "text",
        text: `TRAINING IMAGE for brand "${brandName}" - This is the REFERENCE image showing the correct app interface:`
      });
      userContent.push({
        type: "image_url",
        image_url: { url: trainingImageUrl }
      });
      userContent.push({
        type: "text",
        text: `NEW IMAGE to validate - Check if this is the SAME application as the training image above. Brand should be: "${brandName}"`
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract the closing balance number from this image for brand "${brandName}". No training image available for validation.`
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
      cleanedText = cleanedText.trim();

      const jsonResponse = JSON.parse(cleanedText);
      isValidBrand = jsonResponse.isValidBrand === true; // strict check
      brandMismatchReason = jsonResponse.brandMismatchReason || "";

      if (isValidBrand && jsonResponse.extractedNumber && jsonResponse.extractedNumber !== "NOT_FOUND") {
        const cleanedNumber = String(jsonResponse.extractedNumber).replace(/[^\d.-]/g, "");
        const parsed = parseFloat(cleanedNumber);
        if (!isNaN(parsed)) {
          extractedNumber = parsed;
        }
      }
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.log("Raw response:", extractedText);
      // If we can't parse, treat as invalid to be safe
      isValidBrand = false;
      brandMismatchReason = "Failed to validate image";
    }

    console.log("Parsed result - isValidBrand:", isValidBrand, "extractedNumber:", extractedNumber, "mismatchReason:", brandMismatchReason);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedNumber: isValidBrand ? extractedNumber : null,
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
