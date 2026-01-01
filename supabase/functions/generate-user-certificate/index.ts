import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Simple XOR encryption for certificate
function encryptCertificate(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  // Convert to base64
  return btoa(String.fromCharCode(...encrypted));
}

function generateHash(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, created_by_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('CERTIFICATE_ENCRYPTION_KEY') || 'default-cert-key-change-me';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !userData.user) {
      throw new Error('User not found');
    }

    // Generate certificate data
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 3); // 3 months validity

    const certificateHash = generateHash();

    const certificateData = {
      version: '1.0',
      user_id: user_id,
      user_email: userData.user.email,
      certificate_hash: certificateHash,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      issuer: 'Edara System'
    };

    // Encrypt the certificate
    const encryptedCertificate = encryptCertificate(JSON.stringify(certificateData), encryptionKey);

    // Deactivate any existing active certificates for this user
    await supabase
      .from('user_certificates')
      .update({ is_active: false })
      .eq('user_id', user_id)
      .eq('is_active', true);

    // Store certificate record in database
    const { data: certRecord, error: insertError } = await supabase
      .from('user_certificates')
      .insert({
        user_id: user_id,
        certificate_hash: certificateHash,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        created_by: created_by_id || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting certificate record:', insertError);
      throw new Error('Failed to create certificate record');
    }

    console.log(`Certificate generated for user ${user_id}, expires at ${expiresAt.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        certificate: encryptedCertificate,
        certificate_id: certRecord.id,
        expires_at: expiresAt.toISOString(),
        user_email: userData.user.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating certificate:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
