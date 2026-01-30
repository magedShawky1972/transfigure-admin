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
    const { imageUrl, productSku } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // productSku is now optional - AI will detect the product from the image

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get Supabase client to fetch training data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let trainingImageUrl = "";

    // Only fetch training data if productSku is provided
    if (productSku) {
      const { data: trainingData, error: trainingError } = await supabase
        .from("ludo_training")
        .select("image_path, notes")
        .eq("product_sku", productSku)
        .single();

      if (trainingData && !trainingError) {
        if (trainingData.image_path) {
          if (trainingData.image_path.startsWith('http')) {
            trainingImageUrl = trainingData.image_path;
          } else {
            const { data: signedUrlData } = await supabase.storage
              .from("ludo-receipts")
              .createSignedUrl(trainingData.image_path, 3600);
            
            if (signedUrlData?.signedUrl) {
              trainingImageUrl = signedUrlData.signedUrl;
            }
          }
        }
      }
      console.log("Has training data:", !!trainingData);
    }

    console.log("Extracting Ludo transaction, productSku:", productSku || "auto-detect");
    console.log("Training image URL:", trainingImageUrl ? "available" : "not available");

    // Build messages array for extraction and validation
    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert image analyzer for Yalla Ludo game recharge receipts.

CRITICAL TASK: Extract transaction details from Yalla Ludo recharge screenshots.

VALIDATION RULES:
1. Verify this is a Yalla Ludo app screenshot (يلا لودو)
2. Look for the app logo, colors (typically orange/gold theme), and Yalla Ludo branding
3. If NOT from Yalla Ludo app, mark as INVALID

DATA TO EXTRACT:
1. amount - The recharge/top-up amount (numeric value only, no currency symbols)
2. playerId - CRITICAL: Look carefully for the player's ID anywhere in the image:
   - Often starts with "yap_" followed by numbers (e.g., "yap_123456789")
   - May appear as a long numeric string (e.g., "251107201303479624659")
   - Could be labeled as "معرف اللاعب" or "Player ID" or "ID"
   - Check ALL text in the image including small text, headers, and footers
   - The ID may be partially visible or in a corner of the screenshot
3. transactionDate - Date and time of the transaction (format: YYYY-MM-DD HH:MM:SS if visible, or current date if not visible)
4. detectedSku - CRITICAL: Determine which product SKU based on the Arabic product name shown:
   - "YA019" = When product name shows "فارس" (Faris/Fans) - this is the Fans package
   - "YA018" = When product name shows "اللواء" (Al-Liwa'/Brigade) - this is the Lite package
   Look for the Arabic text "العنصر:" (Element/Item) label followed by the product name.
   - If you see "فارس" → return "YA019"
   - If you see "اللواء" → return "YA018"

IMPORTANT:
- Player ID is the MOST important field to extract - search the entire image carefully
- Amount may be shown in diamonds, coins, or currency
- Date/time might be in the transaction details or receipt timestamp
- If any field is not clearly visible, set it to null
- For SKU detection, focus on reading the Arabic product name text carefully

Response format (JSON only, no markdown):
{
  "isValidApp": true or false,
  "amount": number or null,
  "playerId": "string" or null,
  "transactionDate": "YYYY-MM-DD HH:MM:SS" or null,
  "detectedSku": "YA019" or "YA018" or null,
  "invalidReason": "explain why invalid if isValidApp is false"
}

Return ONLY the JSON object, no other text or markdown formatting.`
      }
    ];

    // Add user message with both training image (if available) and the new image
    const userContent: any[] = [];
    
    if (trainingImageUrl && productSku) {
      userContent.push({
        type: "text",
        text: `TRAINING IMAGE for Yalla Ludo recharge (${productSku}) - This is the REFERENCE image showing the expected format:`
      });
      userContent.push({
        type: "image_url",
        image_url: { url: trainingImageUrl }
      });
      userContent.push({
        type: "text",
        text: `NEW IMAGE to analyze - Extract the amount, player ID, transaction date, and detect which product (فارس=YA019 or اللواء=YA018):`
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extract Yalla Ludo recharge transaction details (amount, player ID, date) and detect the product type (فارس=YA019 or اللواء=YA018) from this image:`
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
        model: "google/gemini-2.5-flash-lite",
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

    // Parse the JSON response
    let isValidApp = true;
    let amount: number | null = null;
    let playerId: string | null = null;
    let transactionDate: string | null = null;
    let detectedSku: string | null = null;
    let invalidReason = "";

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
      isValidApp = jsonResponse.isValidApp === true;
      invalidReason = jsonResponse.invalidReason || "";

      if (isValidApp) {
        if (jsonResponse.amount !== null && jsonResponse.amount !== undefined) {
          const cleanedAmount = String(jsonResponse.amount).replace(/[^\d.-]/g, "");
          const parsed = parseFloat(cleanedAmount);
          if (!isNaN(parsed)) {
            amount = parsed;
          }
        }
        
        if (jsonResponse.playerId) {
          playerId = String(jsonResponse.playerId).trim();
        }
        
        if (jsonResponse.transactionDate) {
          transactionDate = String(jsonResponse.transactionDate).trim();
        } else {
          // Default to current date/time if not visible
          transactionDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }
        
        if (jsonResponse.detectedSku) {
          detectedSku = String(jsonResponse.detectedSku).trim();
        }
      }
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.log("Raw response:", extractedText);
      isValidApp = false;
      invalidReason = "Failed to parse AI response";
    }

    console.log("Parsed result - isValidApp:", isValidApp, "amount:", amount, "playerId:", playerId, "transactionDate:", transactionDate, "detectedSku:", detectedSku);

    return new Response(
      JSON.stringify({ 
        success: true, 
        isValidApp,
        amount: isValidApp ? amount : null,
        playerId: isValidApp ? playerId : null,
        transactionDate: isValidApp ? transactionDate : null,
        detectedSku: isValidApp ? detectedSku : null,
        invalidReason,
        rawText: extractedText,
        hasTrainingData: !!trainingImageUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error extracting Ludo transaction:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
