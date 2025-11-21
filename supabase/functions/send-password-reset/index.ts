import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.hostinger.com",
    port: 465,
    tls: true,
    auth: {
      username: "edara@asuscards.com",
      password: Deno.env.get("SMTP_PASSWORD") ?? "",
    },
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate random password
function generateRandomPassword(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, password } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided password or generate random one
    const newPassword = password || generateRandomPassword(10);

    // Get user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUser = users.users.find(u => u.email === email);
    
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile to require password change
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('user_id', targetUser.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Send email with new password
    console.log(`Attempting to send password reset email to: ${email}`);
    console.log(`SMTP Server: smtp.hostinger.com, From: edara@asuscards.com`);
    
    try {
      const emailResult = await smtpClient.send({
        from: "Edara System <edara@asuscards.com>",
        to: email,
        subject: "تم إعادة تعيين كلمة المرور - Password Reset",
        content: "auto",
        html: `
          <div style="direction: rtl; font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #8B5CF6;">مرحباً</h1>
            <p>تم إعادة تعيين كلمة المرور الخاصة بك بنجاح.</p>
            <p>كلمة المرور الجديدة: <strong style="font-size: 18px; color: #8B5CF6;">${newPassword}</strong></p>
            <p>يرجى تسجيل الدخول وتغيير كلمة المرور فوراً.</p>
            <hr style="margin: 20px 0;">
            <h1 style="color: #8B5CF6;">Hello</h1>
            <p>Your password has been reset successfully.</p>
            <p>New Password: <strong style="font-size: 18px; color: #8B5CF6;">${newPassword}</strong></p>
            <p>Please log in and change your password immediately.</p>
            <br>
            <p style="color: #666; font-size: 12px;">If you did not request this password reset, please contact your administrator immediately.</p>
            <p style="color: #666; font-size: 12px;">إذا لم تطلب إعادة تعيين كلمة المرور، يرجى الاتصال بالمسؤول فوراً.</p>
          </div>
        `,
      });

      console.log('SMTP send result:', JSON.stringify(emailResult));
      await smtpClient.close();
      console.log('Email sent successfully and SMTP connection closed');
    } catch (emailError: any) {
      console.error('SMTP Error Details:', {
        message: emailError?.message,
        code: emailError?.code,
        stack: emailError?.stack,
        full: JSON.stringify(emailError)
      });
      // Don't fail the request if email fails, password is already reset
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password reset email sent to ${email}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in send-password-reset:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
