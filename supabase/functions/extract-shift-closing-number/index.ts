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
    const { imageUrl, brandId } = await req.json();
    
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
TRAINING DATA FOR THIS BRAND:
- The expected closing number location was marked with a yellow square in the training image
- The expected number from training is: ${trainingData.expected_number || "unknown"}
- Notes: ${trainingData.notes || "none"}

IMPORTANT: Use the training image to understand WHERE the closing balance number is typically located in this brand's interface. 
The training image has a yellow square highlighting the exact location. Find the same location in the new image and extract the number from there.
`;
    }

    console.log("Extracting closing number for brand:", brandId);
    console.log("Has training data:", !!trainingData);

    // Build messages array
    const messages: any[] = [
      {
        role: "system",
        content: `You are a number extraction assistant specialized in reading closing balance numbers from point-of-sale or financial system screenshots.

Your task is to find and extract the closing balance number from the image.

${trainingContext}

Rules:
- Look for the closing balance / total / remaining balance number in the image
- If training data is provided, use the training image to learn WHERE the number is located, then find the same location in the new image
- Extract ONLY the numeric value (digits only, no currency symbols or text)
- If you find a decimal number, include the decimal point
- If you cannot find the number, return "NOT_FOUND"
- Do not include any explanation, just the number or NOT_FOUND`
      }
    ];

    // Add user message with both training image (if available) and the new image
    const userContent: any[] = [];
    
    if (trainingImageUrl) {
      userContent.push({
        type: "text",
        text: "Here is the training image showing WHERE the closing number is located (marked with yellow square):"
      });
      userContent.push({
        type: "image_url",
        image_url: { url: trainingImageUrl }
      });
      userContent.push({
        type: "text",
        text: "Now, find the number in the SAME LOCATION in this new image and extract it:"
      });
    } else {
      userContent.push({
        type: "text",
        text: "Find and extract the closing balance number from this image:"
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
