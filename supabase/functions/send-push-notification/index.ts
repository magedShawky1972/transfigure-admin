import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

          // Simple POST request with payload
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: payload,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send to ${subscription.endpoint.substring(0, 50)}:`, response.status, errorText);
            
            // If subscription is invalid (gone or not found), delete it
            if (response.status === 410 || response.status === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', subscription.id);
              console.log('Deleted invalid subscription:', subscription.id);
            }
            return { success: false, endpoint: subscription.endpoint, status: response.status };
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

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`Push notification result: ${successful}/${subscriptions.length} notifications sent successfully`);

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications processed',
        successful,
        total: subscriptions.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
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
