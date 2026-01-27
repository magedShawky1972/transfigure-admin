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

    // Fetch ALL training images for this brand (multiple images for different devices/modes)
    const { data: trainingImages, error: trainingError } = await supabase
      .from("brand_closing_training")
      .select("image_path, expected_number, notes, device_type, display_mode")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(5); // Limit to 5 most recent training images

    const trainingImageUrls: Array<{url: string; device_type: string; display_mode: string}> = [];

    if (trainingImages && !trainingError && trainingImages.length > 0) {
      for (const training of trainingImages) {
        if (training.image_path) {
          let imageUrl = "";
          // Check if it's already a full URL (public bucket) or just a path
          if (training.image_path.startsWith('http')) {
            imageUrl = training.image_path;
          } else {
            const { data: signedUrlData } = await supabase.storage
              .from("closing-training")
              .createSignedUrl(training.image_path, 3600);
            
            if (signedUrlData?.signedUrl) {
              imageUrl = signedUrlData.signedUrl;
            }
          }
          
          if (imageUrl) {
            trainingImageUrls.push({
              url: imageUrl,
              device_type: training.device_type || 'unknown',
              display_mode: training.display_mode || 'unknown'
            });
          }
        }
      }
    }

    console.log("Extracting closing number for brand:", brandId, brandName);
    console.log("Training images count:", trainingImageUrls.length);

    // Build messages array for extraction and validation
    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert image validator and number extractor for point-of-sale closing balance screenshots.

CRITICAL TASK: You MUST validate if the NEW image matches the SAME application/brand as the TRAINING images.

IMPORTANT: Training images may come from different devices (mobile, tablet, iPad, desktop) and display modes (light/dark). 
The UI may look slightly different due to:
- Different screen sizes and aspect ratios
- Light mode vs Dark mode (colors inverted)
- Different device types showing different layouts
- But the CORE application name and functionality should match

BRAND VALIDATION RULES (FLEXIBLE BUT ACCURATE):
1. Compare the APPLICATION NAME visible in images - they MUST match exactly
2. The UI LAYOUT may vary by device/mode but core elements should be similar
3. COLOR SCHEME may be inverted (light vs dark mode) - this is OK
4. Look for BRAND LOGOS or IDENTIFIABLE ELEMENTS that should appear in all versions
5. If the app name is different (e.g., "Hawa" vs "Soul Free" vs "Sila Chat" vs "Binmo"), mark as INVALID
6. Arabic app names to watch: بينمو، سول فري، سيلا شات، صدى لايف، هوى شات، هيلا شات، يوهو

IMPORTANT: Different voice chat apps (Hawa Chat, Soul Free, Sila Chat, Binmo, Yoho, etc.) have DIFFERENT UIs. Do NOT confuse them!
But the SAME app on different devices/modes should be recognized as valid.

NUMBER EXTRACTION RULES - READ VERY CAREFULLY:
- Only extract the number if brand is VALID
- Look for the closing balance / total / coins number
- Extract ONLY numeric digits (no currency symbols)
- The number location should be similar across training images

CRITICAL - ARABIC NUMERAL ACCURACY:
When reading Arabic/Eastern Arabic numerals, be EXTREMELY careful with each digit:
- ٠ = 0, ١ = 1, ٢ = 2, ٣ = 3, ٤ = 4, ٥ = 5, ٦ = 6, ٧ = 7, ٨ = 8, ٩ = 9
- Pay special attention to ٥ (5) vs ٠ (0) - they look similar but are DIFFERENT
- ٥ has a small dot/circle at the top, ٠ is a plain dot/circle
- Read EACH digit individually from left to right
- Double-check numbers with commas/separators - read each group carefully
- Example: ٦٧،٥١٦،٩٤٧ = 67,516,947 (note the ٥ in the middle group is 5, not 0)

Response format (JSON only, no markdown):
{
  "isValidBrand": true or false,
  "extractedNumber": "number or NOT_FOUND",
  "brandMismatchReason": "explain why invalid (e.g., 'Image shows Hawa Chat app but expected Soul Free')"
}

Return ONLY the JSON object, no other text or markdown formatting.`
      }
    ];

    // Add user message with training images (if available) and the new image
    const userContent: any[] = [];
    
    if (trainingImageUrls.length > 0) {
      userContent.push({
        type: "text",
        text: `TRAINING IMAGES for brand "${brandName}" - These are REFERENCE images showing the correct app interface from different devices and display modes:`
      });
      
      // Add training images with context
      for (let i = 0; i < trainingImageUrls.length; i++) {
        const training = trainingImageUrls[i];
        userContent.push({
          type: "text",
          text: `Training image ${i + 1} (Device: ${training.device_type}, Mode: ${training.display_mode}):`
        });
        userContent.push({
          type: "image_url",
          image_url: { url: training.url }
        });
      }
      
      userContent.push({
        type: "text",
        text: `NEW IMAGE to validate - Check if this is the SAME application as the training images above (may be from different device/mode). Brand should be: "${brandName}"`
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract the closing balance number from this image for brand "${brandName}". No training images available for validation.`
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

    // Use gemini-2.5-pro for better accuracy with Arabic numerals
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        max_tokens: 500,
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
        hasTrainingData: trainingImageUrls.length > 0,
        trainingImagesCount: trainingImageUrls.length
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
