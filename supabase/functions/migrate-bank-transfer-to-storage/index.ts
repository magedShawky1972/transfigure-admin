import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all orders with bank_transfer_image
    const { data: orders, error: fetchErr } = await supabase
      .from('coins_purchase_orders')
      .select('id, order_number, bank_transfer_image')
      .not('bank_transfer_image', 'is', null)
      .neq('bank_transfer_image', '')
      .neq('bank_transfer_image', '[]');

    if (fetchErr) throw fetchErr;

    const results: { order: string; migrated: number; skipped: number; errors: string[] }[] = [];

    for (const order of (orders || [])) {
      const raw = order.bank_transfer_image;
      let urls: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        urls = Array.isArray(parsed) ? parsed.filter(Boolean) : (raw ? [raw] : []);
      } catch {
        urls = raw ? [raw] : [];
      }

      // Filter URLs that need migration: Cloudinary URLs or previously migrated .bin files
      const needsMigration = urls.filter((u: string) => u.includes('res.cloudinary.com') || u.endsWith('.bin'));
      if (needsMigration.length === 0) {
        results.push({ order: order.order_number, migrated: 0, skipped: urls.length, errors: [] });
        continue;
      }

      const newUrls: string[] = [];
      const errors: string[] = [];
      let migrated = 0;

      for (const url of urls) {
        if (!url.includes('res.cloudinary.com') && !url.endsWith('.bin')) {
          // Already properly migrated, keep as-is
          newUrls.push(url);
          continue;
        }

        try {
          // Download from Cloudinary
          const response = await fetch(url);
          if (!response.ok) {
            errors.push(`Failed to download ${url}: ${response.status}`);
            newUrls.push(url); // Keep original on failure
            continue;
          }

          const blob = await response.blob();
          const contentType = blob.type || response.headers.get('content-type') || 'application/octet-stream';
          const baseMime = contentType.split(';')[0].trim().toLowerCase();
          
          // Determine extension from content-type first, then URL
          let ext = 'bin';
          const mimeToExt: Record<string, string> = {
            'application/pdf': 'pdf',
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
          };
          if (mimeToExt[baseMime]) {
            ext = mimeToExt[baseMime];
          } else {
            const urlPath = new URL(url).pathname;
            const urlExt = urlPath.split('.').pop()?.toLowerCase();
            if (urlExt && ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(urlExt)) {
              ext = urlExt;
            } else if (baseMime === 'application/octet-stream') {
              // Read magic bytes to detect type
              const arr = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
              if (arr[0] === 0x25 && arr[1] === 0x50 && arr[2] === 0x44 && arr[3] === 0x46) ext = 'pdf';
              else if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) ext = 'png';
              else if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) ext = 'jpg';
            }
          }

          const filePath = `coins-creation/${order.order_number}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

          // Upload to Supabase Storage
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          const { error: uploadErr } = await supabase.storage
            .from('bank-transfer-files')
            .upload(filePath, uint8Array, {
              contentType,
              upsert: false,
            });

          if (uploadErr) {
            errors.push(`Upload failed for ${url}: ${uploadErr.message}`);
            newUrls.push(url); // Keep original on failure
            continue;
          }

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('bank-transfer-files')
            .getPublicUrl(filePath);

          newUrls.push(publicUrlData.publicUrl);
          migrated++;
        } catch (e) {
          errors.push(`Error processing ${url}: ${e instanceof Error ? e.message : String(e)}`);
          newUrls.push(url); // Keep original on failure
        }
      }

      // Update the order with new URLs
      if (migrated > 0) {
        const { error: updateErr } = await supabase
          .from('coins_purchase_orders')
          .update({ bank_transfer_image: JSON.stringify(newUrls) })
          .eq('id', order.id);

        if (updateErr) {
          errors.push(`DB update failed: ${updateErr.message}`);
        }
      }

      results.push({
        order: order.order_number,
        migrated,
        skipped: urls.length - needsMigration.length,
        errors,
      });
    }

    const totalMigrated = results.reduce((s, r) => s + r.migrated, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

    console.log(`Migration complete: ${totalMigrated} files migrated, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        totalOrders: results.length,
        totalMigrated,
        totalErrors,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
