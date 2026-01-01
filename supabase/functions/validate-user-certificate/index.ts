import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Simple XOR decryption for certificate
function decryptCertificate(encryptedData: string, key: string): string {
  try {
    const keyBytes = new TextEncoder().encode(key);
    const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const decrypted = new Uint8Array(encrypted.length);
    
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error('Invalid certificate format');
  }
}

interface CertificateData {
  version: string;
  user_id: string;
  user_email: string;
  certificate_hash: string;
  issued_at: string;
  expires_at: string;
  issuer: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { certificate, user_id } = await req.json();

    if (!certificate || !user_id) {
      throw new Error('certificate and user_id are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('CERTIFICATE_ENCRYPTION_KEY') || 'default-cert-key-change-me';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Decrypt the certificate
    let certData: CertificateData;
    try {
      const decrypted = decryptCertificate(certificate, encryptionKey);
      certData = JSON.parse(decrypted);
    } catch (e) {
      console.error('Certificate decryption failed:', e);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid certificate format',
          code: 'INVALID_FORMAT'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user_id matches
    if (certData.user_id !== user_id) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Certificate does not belong to this user',
          code: 'USER_MISMATCH'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if certificate hash exists in database
    const { data: certRecord, error: dbError } = await supabase
      .from('user_certificates')
      .select('*')
      .eq('certificate_hash', certData.certificate_hash)
      .eq('user_id', user_id)
      .single();

    if (dbError || !certRecord) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Certificate not found in system',
          code: 'NOT_FOUND'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if certificate is active
    if (!certRecord.is_active) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Certificate has been revoked',
          code: 'REVOKED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if certificate is expired
    const now = new Date();
    const expiresAt = new Date(certRecord.expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Certificate has expired',
          code: 'EXPIRED',
          expires_at: certRecord.expires_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Certificate validated for user ${user_id}`);

    return new Response(
      JSON.stringify({
        valid: true,
        certificate_id: certRecord.id,
        issued_at: certRecord.issued_at,
        expires_at: certRecord.expires_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating certificate:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN_ERROR'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
