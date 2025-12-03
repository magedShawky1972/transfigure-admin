import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper to concatenate Uint8Arrays
function concatBuffers(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HKDF extract
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    salt.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const result = await crypto.subtle.sign('HMAC', key, ikm.buffer as ArrayBuffer);
  return new Uint8Array(result);
}

// HKDF expand
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    prk.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const result = new Uint8Array(length);
  let counter = 1;
  let prev = new Uint8Array(0);
  let offset = 0;
  
  while (offset < length) {
    const input = concatBuffers(prev, info, new Uint8Array([counter]));
    const output = new Uint8Array(await crypto.subtle.sign('HMAC', key, input.buffer as ArrayBuffer));
    const copyLength = Math.min(output.length, length - offset);
    result.set(output.slice(0, copyLength), offset);
    prev = output;
    offset += copyLength;
    counter++;
  }
  
  return result;
}

// Create info for HKDF
function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0`);
  const P256 = encoder.encode('P-256\0');
  
  const clientKeyLength = new Uint8Array(2);
  new DataView(clientKeyLength.buffer).setUint16(0, clientPublicKey.length, false);
  
  const serverKeyLength = new Uint8Array(2);
  new DataView(serverKeyLength.buffer).setUint16(0, serverPublicKey.length, false);
  
  return concatBuffers(
    typeBytes,
    P256,
    clientKeyLength,
    clientPublicKey,
    serverKeyLength,
    serverPublicKey
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, title, body, data } = await req.json();
    console.log('Sending push notification:', { userId, title, body });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      throw new Error('VAPID keys not configured');
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for user ${userId}`);

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const payload = JSON.stringify({
            title,
            body,
            data: data || {},
          });

          console.log(`Sending notification to endpoint: ${subscription.endpoint.substring(0, 50)}...`);

          // Get the origin for VAPID audience
          const endpointUrl = new URL(subscription.endpoint);
          const audience = endpointUrl.origin;

          // Decode subscription keys
          const p256dhKey = base64UrlToUint8Array(subscription.p256dh);
          const authKey = base64UrlToUint8Array(subscription.auth);

          // Generate local ECDH key pair
          const localKeyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits']
          );

          // Export local public key as raw
          const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
          const localPublicKey = new Uint8Array(localPublicKeyBuffer);

          // Import subscriber's public key
          const subscriberPublicKey = await crypto.subtle.importKey(
            'raw',
            p256dhKey.buffer as ArrayBuffer,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
          );

          // Derive shared secret via ECDH
          const sharedSecretBuffer = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: subscriberPublicKey },
            localKeyPair.privateKey,
            256
          );
          const sharedSecret = new Uint8Array(sharedSecretBuffer);

          // Generate salt (16 bytes)
          const salt = crypto.getRandomValues(new Uint8Array(16));

          // Derive encryption keys using HKDF
          // Step 1: Extract PRK from auth and shared secret
          const prk = await hkdfExtract(authKey, sharedSecret);

          // Step 2: Derive IKM (Input Key Material)
          const ikmInfo = new TextEncoder().encode('Content-Encoding: auth\0');
          const ikm = await hkdfExpand(prk, ikmInfo, 32);

          // Step 3: Extract PRK from salt and IKM
          const prkFinal = await hkdfExtract(salt, ikm);

          // Step 4: Derive CEK (Content Encryption Key) - 16 bytes
          const cekInfo = createInfo('aesgcm', p256dhKey, localPublicKey);
          const cek = await hkdfExpand(prkFinal, cekInfo, 16);

          // Step 5: Derive nonce - 12 bytes
          const nonceInfo = createInfo('nonce', p256dhKey, localPublicKey);
          const nonce = await hkdfExpand(prkFinal, nonceInfo, 12);

          // Import CEK for AES-GCM encryption
          const encryptionKey = await crypto.subtle.importKey(
            'raw',
            cek.buffer as ArrayBuffer,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
          );

          // Encode and pad the payload
          const payloadBytes = new TextEncoder().encode(payload);
          const paddingLength = 0;
          const paddedPayload = concatBuffers(
            new Uint8Array(2), // Padding length (big-endian)
            new Uint8Array(paddingLength), // Padding bytes
            payloadBytes
          );

          // Encrypt
          const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
            encryptionKey,
            paddedPayload.buffer as ArrayBuffer
          );
          const encryptedPayload = new Uint8Array(encryptedBuffer);

          // Create VAPID JWT
          const now = Math.floor(Date.now() / 1000);
          const jwtHeader = { typ: 'JWT', alg: 'ES256' };
          const jwtPayload = {
            aud: audience,
            exp: now + 12 * 60 * 60,
            sub: 'mailto:admin@edara.com',
          };

          const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(jwtHeader)));
          const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(jwtPayload)));
          const unsignedToken = `${headerB64}.${payloadB64}`;

          // Import VAPID private key and sign
          const vapidPrivateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
          
          // Create JWK for P-256 private key
          const vapidPublicKeyBytes = base64UrlToUint8Array(vapidPublicKey);
          
          // P-256 public key is 65 bytes: 0x04 + x (32 bytes) + y (32 bytes)
          const x = uint8ArrayToBase64Url(vapidPublicKeyBytes.slice(1, 33));
          const y = uint8ArrayToBase64Url(vapidPublicKeyBytes.slice(33, 65));
          const d = uint8ArrayToBase64Url(vapidPrivateKeyBytes);

          const vapidJwk = {
            kty: 'EC',
            crv: 'P-256',
            x,
            y,
            d,
          };

          const vapidKey = await crypto.subtle.importKey(
            'jwk',
            vapidJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign']
          );

          const signatureBuffer = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            vapidKey,
            new TextEncoder().encode(unsignedToken)
          );
          
          // Convert signature from DER to raw format if needed
          let signatureBytes: Uint8Array = new Uint8Array(signatureBuffer);
          if (signatureBytes.length !== 64) {
            // It's likely in DER format, convert to raw
            const rawSig = derToRaw(signatureBytes);
            signatureBytes = new Uint8Array(rawSig.buffer.slice(rawSig.byteOffset, rawSig.byteOffset + rawSig.byteLength));
          }
          
          const signatureB64 = uint8ArrayToBase64Url(signatureBytes);
          const vapidToken = `${unsignedToken}.${signatureB64}`;

          // Build request
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aesgcm',
              'Encryption': `salt=${uint8ArrayToBase64Url(salt)}`,
              'Crypto-Key': `dh=${uint8ArrayToBase64Url(localPublicKey)};p256ecdsa=${vapidPublicKey}`,
              'TTL': '86400',
              'Authorization': `WebPush ${vapidToken}`,
            },
            body: encryptedPayload,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send to ${subscription.endpoint.substring(0, 50)}:`, response.status, errorText);
            
            if (response.status === 410 || response.status === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', subscription.id);
              console.log('Deleted invalid subscription:', subscription.id);
            }
            return { success: false, endpoint: subscription.endpoint, status: response.status, error: errorText };
          }

          console.log('Successfully sent notification to subscription');
          return { success: true, endpoint: subscription.endpoint };
        } catch (error) {
          console.error('Error sending to subscription:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, endpoint: subscription.endpoint, error: errorMessage };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as {success: boolean}).success).length;
    console.log(`Push notification result: ${successful}/${subscriptions.length} notifications sent successfully`);

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications processed',
        successful,
        total: subscriptions.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason })
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Convert DER signature to raw format (r || s)
function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  
  let offset = 0;
  if (der[offset++] !== 0x30) return der;
  
  let length = der[offset++];
  if (length & 0x80) {
    offset += length & 0x7f;
  }
  
  if (der[offset++] !== 0x02) return der;
  let rLength = der[offset++];
  let rStart = offset;
  offset += rLength;
  
  if (der[offset++] !== 0x02) return der;
  let sLength = der[offset++];
  let sStart = offset;
  
  const r = der.slice(rStart, rStart + rLength);
  const s = der.slice(sStart, sStart + sLength);
  
  const raw = new Uint8Array(64);
  
  if (r.length <= 32) {
    raw.set(r, 32 - r.length);
  } else {
    raw.set(r.slice(r.length - 32), 0);
  }
  
  if (s.length <= 32) {
    raw.set(s, 64 - s.length);
  } else {
    raw.set(s.slice(s.length - 32), 32);
  }
  
  return raw;
}
