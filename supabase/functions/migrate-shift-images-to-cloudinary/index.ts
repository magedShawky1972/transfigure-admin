import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Cloudinary credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { batchSize = 10, dryRun = false } = await req.json().catch(() => ({}));
    
    console.log(`Starting migration with batchSize=${batchSize}, dryRun=${dryRun}`);

    // Find all shift_brand_balances with Supabase storage paths (not Cloudinary URLs)
    const { data: balances, error: balancesError } = await supabase
      .from("shift_brand_balances")
      .select("id, receipt_image_path, opening_image_path, shift_session_id, brand_id")
      .or("receipt_image_path.not.like.https://%,opening_image_path.not.like.https://%")
      .limit(batchSize);

    if (balancesError) {
      throw new Error(`Error fetching balances: ${balancesError.message}`);
    }

    console.log(`Found ${balances?.length || 0} records to migrate`);

    const results = {
      total: balances?.length || 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    if (!balances || balances.length === 0) {
      return new Response(
        JSON.stringify({ message: "No records to migrate", results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const balance of balances) {
      const updates: Record<string, string> = {};
      let hasError = false;

      // Migrate receipt_image_path
      if (balance.receipt_image_path && !balance.receipt_image_path.startsWith('https://')) {
        try {
          console.log(`Migrating receipt_image_path: ${balance.receipt_image_path}`);
          
          if (!dryRun) {
            // Download from Supabase storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from("shift-receipts")
              .download(balance.receipt_image_path);

            if (downloadError) {
              console.error(`Failed to download ${balance.receipt_image_path}:`, downloadError);
              hasError = true;
            } else if (fileData) {
              // Convert to base64
              const arrayBuffer = await fileData.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              const mimeType = fileData.type || 'image/jpeg';
              const base64WithPrefix = `data:${mimeType};base64,${base64}`;

              // Upload to Cloudinary
              const publicId = `migration/${balance.shift_session_id}/${balance.brand_id}-closing`;
              const cloudinaryUrl = await uploadToCloudinary(base64WithPrefix, publicId, cloudName, apiKey, apiSecret);

              if (cloudinaryUrl) {
                updates.receipt_image_path = cloudinaryUrl;
                console.log(`Migrated to: ${cloudinaryUrl}`);
              } else {
                hasError = true;
              }
            }
          } else {
            console.log(`[DRY RUN] Would migrate receipt: ${balance.receipt_image_path}`);
          }
        } catch (err) {
          console.error(`Error migrating receipt_image_path:`, err);
          hasError = true;
        }
      }

      // Migrate opening_image_path
      if (balance.opening_image_path && !balance.opening_image_path.startsWith('https://')) {
        try {
          console.log(`Migrating opening_image_path: ${balance.opening_image_path}`);
          
          if (!dryRun) {
            // Download from Supabase storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from("shift-receipts")
              .download(balance.opening_image_path);

            if (downloadError) {
              console.error(`Failed to download ${balance.opening_image_path}:`, downloadError);
              hasError = true;
            } else if (fileData) {
              // Convert to base64
              const arrayBuffer = await fileData.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              const mimeType = fileData.type || 'image/jpeg';
              const base64WithPrefix = `data:${mimeType};base64,${base64}`;

              // Upload to Cloudinary
              const publicId = `migration/${balance.shift_session_id}/${balance.brand_id}-opening`;
              const cloudinaryUrl = await uploadToCloudinary(base64WithPrefix, publicId, cloudName, apiKey, apiSecret);

              if (cloudinaryUrl) {
                updates.opening_image_path = cloudinaryUrl;
                console.log(`Migrated to: ${cloudinaryUrl}`);
              } else {
                hasError = true;
              }
            }
          } else {
            console.log(`[DRY RUN] Would migrate opening: ${balance.opening_image_path}`);
          }
        } catch (err) {
          console.error(`Error migrating opening_image_path:`, err);
          hasError = true;
        }
      }

      // Update the database record
      if (Object.keys(updates).length > 0 && !dryRun) {
        const { error: updateError } = await supabase
          .from("shift_brand_balances")
          .update(updates)
          .eq("id", balance.id);

        if (updateError) {
          console.error(`Failed to update record ${balance.id}:`, updateError);
          results.failed++;
          results.details.push({ id: balance.id, status: 'failed', error: updateError.message });
        } else {
          results.migrated++;
          results.details.push({ id: balance.id, status: 'migrated', updates });
        }
      } else if (hasError) {
        results.failed++;
        results.details.push({ id: balance.id, status: 'failed', error: 'Migration error' });
      } else if (dryRun) {
        results.skipped++;
        results.details.push({ id: balance.id, status: 'dry_run' });
      } else {
        results.skipped++;
        results.details.push({ id: balance.id, status: 'skipped', reason: 'No paths to migrate' });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: dryRun ? "Dry run completed" : "Migration completed", 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: 'Migration failed', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function uploadToCloudinary(
  imageBase64: string, 
  publicId: string, 
  cloudName: string, 
  apiKey: string, 
  apiSecret: string
): Promise<string | null> {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "Edara_Shifts_Images";

    const paramsToSign: Record<string, string> = {
      folder,
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    // Sort and create signature string
    const sortedKeys = Object.keys(paramsToSign).sort();
    const signatureString = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;

    // Generate SHA1 signature
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Prepare form data for upload
    const formData = new FormData();
    formData.append('file', imageBase64);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicId);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await uploadResponse.json();

    if (!uploadResponse.ok) {
      console.error("Cloudinary upload failed:", result);
      return null;
    }

    return result.secure_url;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
}
