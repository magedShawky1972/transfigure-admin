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

  console.log('Starting background email sync...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all active user email configs with mail type info
    const { data: configs, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('is_active', true)
      .not('email_password', 'is', null);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('No active email configs found');
      return new Response(
        JSON.stringify({ message: 'No active email configs found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${configs.length} active email configs to sync`);

    const results = [];

    for (const config of configs) {
      try {
        console.log(`Syncing emails for user ${config.user_id} (${config.email_address})`);

        // Get the last synced email date for this user
        const { data: lastEmail } = await supabase
          .from('emails')
          .select('email_date')
          .eq('user_id', config.user_id)
          .eq('folder', 'inbox')
          .order('email_date', { ascending: false })
          .limit(1)
          .single();

        const sinceDate = lastEmail?.email_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Call the fetch-emails-imap function
        const { data: fetchResult, error: fetchError } = await supabase.functions.invoke('fetch-emails-imap', {
          body: {
            imapHost: config.imap_host,
            imapPort: config.imap_port,
            imapSecure: config.imap_secure,
            email: config.email_address,
            emailPassword: config.email_password,
            folder: 'INBOX',
            limit: 50,
            sinceDate,
            incrementalOnly: true,
          },
        });

        if (fetchError) {
          console.error(`Error syncing for ${config.email_address}:`, fetchError);
          
          // Update sync error
          await supabase
            .from('user_email_configs')
            .update({ 
              sync_error: fetchError.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', config.id);

          results.push({ 
            userId: config.user_id, 
            email: config.email_address, 
            success: false, 
            error: fetchError.message 
          });
          continue;
        }

        const newCount = fetchResult?.newCount || 0;
        console.log(`Synced ${newCount} new emails for ${config.email_address}`);

        // Update last sync time
        await supabase
          .from('user_email_configs')
          .update({ 
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);

        // If there are new emails, send push notification
        if (newCount > 0) {
          console.log(`Sending push notification to user ${config.user_id} for ${newCount} new emails`);

          // Get first new email subject for notification
          const { data: newEmails } = await supabase
            .from('emails')
            .select('subject, from_name, from_address')
            .eq('user_id', config.user_id)
            .eq('folder', 'inbox')
            .eq('is_read', false)
            .order('email_date', { ascending: false })
            .limit(1);

          const firstEmail = newEmails?.[0];
          const title = newCount === 1 
            ? (firstEmail?.from_name || firstEmail?.from_address || 'New Email')
            : `${newCount} New Emails`;
          const body = newCount === 1 
            ? (firstEmail?.subject || 'You have a new email')
            : `You have ${newCount} new unread emails`;

          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: config.user_id,
                title,
                body,
                data: {
                  type: 'new_email',
                  count: newCount,
                  url: '/email-manager',
                  tag: 'email-sync',
                },
              },
            });
          } catch (pushError) {
            console.error(`Error sending push notification to ${config.user_id}:`, pushError);
          }
        }

        results.push({ 
          userId: config.user_id, 
          email: config.email_address, 
          success: true, 
          newCount 
        });

      } catch (userError) {
        console.error(`Error processing ${config.email_address}:`, userError);
        results.push({ 
          userId: config.user_id, 
          email: config.email_address, 
          success: false, 
          error: userError instanceof Error ? userError.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalNewEmails = results.reduce((sum, r) => sum + (r.newCount || 0), 0);

    console.log(`Background sync complete: ${successCount}/${configs.length} successful, ${totalNewEmails} new emails`);

    return new Response(
      JSON.stringify({ 
        message: 'Background sync complete',
        successCount,
        totalConfigs: configs.length,
        totalNewEmails,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Background sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
