import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from '../_shared/cors.ts';

const TABLE_CONFIG = {
  test: { products: 'testproducts' },
  production: { products: 'products' },
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const logApiCall = async () => {
    try {
      await supabase.from('api_consumption_logs').insert({
        endpoint: 'api-product-match',
        method: req.method,
        request_body: requestBody,
        response_status: responseStatus,
        response_message: responseMessage,
        success,
        execution_time_ms: Date.now() - startTime,
        api_key_id: apiKeyData?.id || null,
        api_key_description: apiKeyData?.description || null,
      });
    } catch (logError) {
      console.error('Error logging API call:', logError);
    }
  };

  if (req.method !== 'POST') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use POST.';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_product) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch API mode
    const { data: modeData } = await supabase
      .from('api_integration_settings')
      .select('setting_value')
      .eq('setting_key', 'api_mode')
      .single();

    const apiMode = (modeData?.setting_value === 'production') ? 'production' : 'test';
    const tables = TABLE_CONFIG[apiMode];

    const body = await req.json();
    requestBody = body;

    const { SKU, Name, Price } = body;

    if (!SKU) {
      responseStatus = 400;
      responseMessage = 'Missing required field: SKU';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lookup product by SKU
    const { data: product, error: lookupError } = await supabase
      .from(tables.products)
      .select('sku, product_name, product_price')
      .eq('sku', SKU)
      .single();

    if (lookupError || !product) {
      // Product not found at all
      const result = {
        match: false,
        status: 'SKU_NOT_FOUND',
        message: `Product with SKU "${SKU}" not found in Purple system`,
        salla: { SKU, Name, Price },
        purple: null,
        mismatched_fields: ['SKU'],
      };

      // Send notification
      await sendMismatchNotification(supabase, result);

      responseMessage = 'SKU not found in Purple system';
      await logApiCall();
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compare fields
    const mismatched_fields: string[] = [];
    const comparison: any = {
      SKU: { salla: SKU, purple: product.sku, match: SKU === product.sku },
    };

    if (Name !== undefined && Name !== null) {
      const nameMatch = Name?.toString().trim().toLowerCase() === product.product_name?.toString().trim().toLowerCase();
      comparison.Name = { salla: Name, purple: product.product_name, match: nameMatch };
      if (!nameMatch) mismatched_fields.push('Name');
    }

    if (Price !== undefined && Price !== null) {
      const sallaPrice = parseFloat(Price?.toString() || '0');
      const purplePrice = parseFloat(product.product_price?.toString() || '0');
      const priceMatch = sallaPrice === purplePrice;
      comparison.Price = { salla: sallaPrice, purple: purplePrice, match: priceMatch };
      if (!priceMatch) mismatched_fields.push('Price');
    }

    const allMatch = mismatched_fields.length === 0;

    const result = {
      match: allMatch,
      status: allMatch ? 'ALL_MATCH' : 'MISMATCH',
      message: allMatch
        ? 'All fields match between Salla and Purple'
        : `Mismatch found in: ${mismatched_fields.join(', ')}`,
      salla: { SKU, Name, Price },
      purple: {
        SKU: product.sku,
        Name: product.product_name,
        Price: product.product_price,
      },
      comparison,
      mismatched_fields,
      mode: apiMode,
    };

    // If mismatch, send notification
    if (!allMatch) {
      await sendMismatchNotification(supabase, result);
    }

    responseMessage = result.message;
    await logApiCall();

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-product-match:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendMismatchNotification(supabase: any, result: any) {
  try {
    const targetNames = ['عمرو زكي', 'ابانوب', 'ماجد'];
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, user_name, email')
      .or(targetNames.map((n: string) => `user_name.ilike.%${n}%`).join(','));

    if (!profiles || profiles.length === 0) {
      console.log('No target users found for notification');
      return;
    }

    const sku = result.salla?.SKU || 'N/A';
    const mismatchDetails = result.mismatched_fields?.join(', ') || result.status;
    
    const title = `⚠️ عدم تطابق منتج - Salla vs Purple`;
    const message = result.status === 'SKU_NOT_FOUND'
      ? `المنتج SKU: ${sku} غير موجود في نظام Purple.\n` +
        `الاسم في سلة: ${result.salla?.Name || 'N/A'}\n` +
        `السعر في سلة: ${result.salla?.Price || 'N/A'}`
      : `عدم تطابق في المنتج SKU: ${sku}\n` +
        `الحقول المختلفة: ${mismatchDetails}\n` +
        (result.comparison?.Name && !result.comparison.Name.match
          ? `الاسم - سلة: "${result.comparison.Name.salla}" | بيربل: "${result.comparison.Name.purple}"\n`
          : '') +
        (result.comparison?.Price && !result.comparison.Price.match
          ? `السعر - سلة: ${result.comparison.Price.salla} | بيربل: ${result.comparison.Price.purple}\n`
          : '');

    // Insert notifications for all target users
    const notifications = profiles.map((p: any) => ({
      user_id: p.user_id,
      title,
      message,
      type: 'general',
      is_read: false,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      console.error('Error sending mismatch notifications:', error);
    } else {
      console.log(`Mismatch notifications sent to ${profiles.length} users`);
    }

    // Send email to all target users
    const emails = profiles
      .map((p: any) => p.email)
      .filter((e: string) => e && e.includes('@'));

    if (emails.length > 0) {
      await sendMismatchEmail(emails, title, message, result);
    }
  } catch (err) {
    console.error('Error in sendMismatchNotification:', err);
  }
}

async function sendMismatchEmail(toEmails: string[], title: string, textMessage: string, result: any) {
  try {
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpPassword) {
      console.error('SMTP_PASSWORD not configured, skipping email');
      return;
    }

    const sku = result.salla?.SKU || 'N/A';

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d32f2f;">⚠️ عدم تطابق منتج - Salla vs Purple</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd;">الحقل</th>
              <th style="padding: 8px; border: 1px solid #ddd;">سلة (Salla)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">بيربل (Purple)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">الحالة</th>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">SKU</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${sku}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.purple?.SKU || 'غير موجود'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.status === 'SKU_NOT_FOUND' ? '❌ غير موجود' : '✅'}</td>
            </tr>
            ${result.comparison?.Name ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">الاسم</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Name.salla || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Name.purple || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Name.match ? '✅' : '❌'}</td>
            </tr>` : ''}
            ${result.comparison?.Price ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">السعر</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Price.salla}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Price.purple}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${result.comparison.Price.match ? '✅' : '❌'}</td>
            </tr>` : ''}
          </table>
          <p style="color: #666; font-size: 12px;">هذا الإشعار تم إرساله تلقائياً من نظام إدارة - Product Match API</p>
        </div>
      </body>
      </html>
    `;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.hostinger.com",
        port: 465,
        tls: true,
        auth: {
          username: "edara@asuscards.com",
          password: smtpPassword,
        },
      },
    });

    const rawSubject = `عدم تطابق منتج SKU: ${sku} - Salla vs Purple`;
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(rawSubject)))}?=`;

    await client.send({
      from: "Edara System <edara@asuscards.com>",
      to: toEmails,
      subject: encodedSubject,
      content: "auto",
      html: emailHtml,
    });

    await client.close();
    console.log(`Mismatch email sent to: ${toEmails.join(', ')}`);
  } catch (emailErr) {
    console.error('Error sending mismatch email:', emailErr);
  }
}
