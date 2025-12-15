import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { imageBase64, folder, publicId, resourceType = 'image' } = await req.json();

    if (!imageBase64) {
      console.error("No file data provided");
      return new Response(
        JSON.stringify({ error: "No file data provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Cloudinary credentials not configured");
      return new Response(
        JSON.stringify({ error: "Cloudinary credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading ${resourceType} to Cloudinary folder: ${folder || 'uploads'}`);

    // Generate timestamp for signature
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Build params for signature
    const paramsToSign: Record<string, string> = {
      timestamp: timestamp.toString(),
    };

    if (folder) {
      paramsToSign.folder = folder;
    }

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    // Sort and create signature string
    const sortedKeys = Object.keys(paramsToSign).sort();
    const signatureString = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;

    // Generate SHA1 signature
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`Generated signature for Cloudinary ${resourceType} upload`);

    // Prepare form data for upload
    // Cloudinary requires base64 data to have the data URI prefix
    const fileData = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:${resourceType === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${imageBase64}`;
    
    const formData = new FormData();
    formData.append('file', fileData);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    
    if (folder) {
      formData.append('folder', folder);
    }
    
    if (publicId) {
      formData.append('public_id', publicId);
    }

    // Determine upload URL based on resource type
    // 'image' for images, 'video' for videos, 'raw' for documents/files
    const uploadType = resourceType === 'video' ? 'video' : resourceType === 'raw' ? 'raw' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${uploadType}/upload`;
    console.log(`Uploading to: ${uploadUrl}`);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await uploadResponse.json();

    if (!uploadResponse.ok) {
      console.error("Cloudinary upload failed:", result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Upload failed", details: result }),
        { status: uploadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${resourceType} uploaded successfully: ${result.secure_url}`);

    return new Response(
      JSON.stringify({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        resourceType: result.resource_type,
        bytes: result.bytes,
        duration: result.duration, // For videos
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});