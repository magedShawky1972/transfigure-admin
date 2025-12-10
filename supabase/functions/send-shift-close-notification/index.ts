import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShiftCloseRequest {
  shiftId: string;
  userId: string;
  shiftSessionId: string;
}

// Format time from HH:MM to AM/PM format in Arabic
function formatTimeToAMPM(timeStr: string | null): string {
  if (!timeStr) return '';
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  const period = hour >= 12 ? 'م' : 'ص';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour = hour - 12;
  return `${hour}:${minute} ${period}`;
}

// Convert KSA time (UTC+3) to Egypt time (UTC+2) - subtract 1 hour
function convertKSAtoEgypt(timeStr: string | null): string {
  if (!timeStr) return '';
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  
  // Subtract 1 hour for Egypt time
  hour = hour - 1;
  if (hour < 0) hour = 23;
  
  const period = hour >= 12 ? 'م' : 'ص';
  let displayHour = hour;
  if (displayHour === 0) displayHour = 12;
  else if (displayHour > 12) displayHour = displayHour - 12;
  return `${displayHour}:${minute} ${period}`;
}

// Get time in specific timezone
function getTimeInTimezone(date: Date, offsetHours: number): string {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const tzTime = new Date(utc + (offsetHours * 3600000));
  let hours = tzTime.getHours();
  const minutes = tzTime.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours = hours - 12;
  return `${hours}:${minutes} ${period}`;
}

async function sendEmailInBackground(email: string, emailHtml: string, subject: string) {
  try {
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

    console.log("Attempting to send close notification email to:", email);

    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: subject,
      content: "text/html; charset=utf-8",
      html: emailHtml,
    });

    await smtpClient.close();
    console.log("Close notification email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send close notification email to", email, ":", emailError);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shiftId, userId, shiftSessionId }: ShiftCloseRequest = await req.json();

    console.log("Processing shift close notification for:", { shiftId, userId, shiftSessionId });

    // Get shift details
    const { data: shift } = await supabase
      .from("shifts")
      .select("shift_name, shift_start_time, shift_end_time")
      .eq("id", shiftId)
      .single();

    // Get user profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("user_name, email")
      .eq("user_id", userId)
      .single();

    // Get brand balances for this session
    const { data: brandBalances } = await supabase
      .from("shift_brand_balances")
      .select("*, brands(brand_name, short_name)")
      .eq("shift_session_id", shiftSessionId);

    // Get shift admins
    const { data: shiftAdmins } = await supabase
      .from("shift_admins")
      .select("user_id")
      .eq("shift_id", shiftId)
      .order("admin_order");

    if (!shiftAdmins || shiftAdmins.length === 0) {
      console.log("No shift admins found for shift:", shiftId);
      return new Response(JSON.stringify({ message: "No admins to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminUserIds = shiftAdmins.map((admin) => admin.user_id);

    // Get admin profiles
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, user_name, email")
      .in("user_id", adminUserIds);

    if (!adminProfiles) {
      throw new Error("Could not fetch admin profiles");
    }

    const now = new Date();
    
    // Convert to KSA time (UTC+3) for all date calculations
    const ksaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const ksaDate = new Date(now.getTime() + ksaOffset);
    
    // Use KSA date for Hijri and Gregorian date formatting
    const hijriDate = ksaDate.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Riyadh' });
    // Format Gregorian date properly (YYYY/MM/DD format in Arabic) using KSA date
    const day = ksaDate.getUTCDate();
    const month = ksaDate.getUTCMonth() + 1;
    const year = ksaDate.getUTCFullYear();
    const gregorianDate = `${year}/${month}/${day} م`;
    const weekday = ksaDate.toLocaleDateString('ar-SA', { weekday: 'long', timeZone: 'Asia/Riyadh' });
    
    // Get close time in KSA (UTC+3) and Egypt (UTC+2)
    const ksaTime = getTimeInTimezone(now, 3);
    const egyptTime = getTimeInTimezone(now, 2);
    
    // Format shift start and end times in AM/PM for KSA (original) and Egypt
    const shiftStartKSA = formatTimeToAMPM(shift?.shift_start_time);
    const shiftEndKSA = formatTimeToAMPM(shift?.shift_end_time);
    const shiftStartEgypt = convertKSAtoEgypt(shift?.shift_start_time);
    const shiftEndEgypt = convertKSAtoEgypt(shift?.shift_end_time);
    
    // Determine shift period (صباحى or مسائى) based on shift start time
    const getShiftPeriod = (startTime: string | null) => {
      if (!startTime) return '';
      const hour = parseInt(startTime.split(':')[0], 10);
      return hour < 12 ? 'صباحى' : 'مسائى';
    };
    const shiftPeriod = getShiftPeriod(shift?.shift_start_time);

    // Create brand balances table HTML
    let balancesTableRows = '';
    if (brandBalances && brandBalances.length > 0) {
      brandBalances.forEach((balance: any) => {
        const brandName = balance.brands?.short_name || balance.brands?.brand_name || 'غير معروف';
        balancesTableRows += `
          <div class="info-row">
            <span class="info-label">${brandName}:</span>
            <span class="info-value">${balance.closing_balance?.toFixed(2) || '0.00'} ${balance.receipt_image_path ? '✓' : ''}</span>
          </div>
        `;
      });
    }

    // Create notifications for each admin
    const notifications = adminProfiles.map((admin) => ({
      user_id: admin.user_id,
      title: "تم غلق وردية",
      message: `قام ${userProfile?.user_name} بغلق وردية ${shift?.shift_name}`,
      type: "shift_close",
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    }

    // Send emails to admins
    let emailsSent = 0;
    for (const admin of adminProfiles) {
      if (!admin.email) continue;

      const emailHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.8;
              color: #333;
              direction: rtl;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .info-box {
              background: #f8f9fa;
              border-right: 4px solid #dc2626;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e9ecef;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #495057;
            }
            .info-value {
              color: #212529;
            }
            h3 {
              color: #212529;
              font-size: 20px;
              margin: 0 0 10px 0;
            }
            .balances-section {
              background: #f0fdf4;
              border-right: 4px solid #059669;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
            }
            .balances-title {
              color: #059669;
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 15px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 إشعار غلق وردية</h1>
            </div>
            <div class="content">
              <h3>مرحباً ${admin.user_name}،</h3>
              <p>تم غلق وردية. إليك التفاصيل:</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">اسم الموظف:</span>
                  <span class="info-value">${userProfile?.user_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">اسم الوردية:</span>
                  <span class="info-value">${shift?.shift_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">اليوم:</span>
                  <span class="info-value">${weekday}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">التاريخ الهجري:</span>
                  <span class="info-value">${hijriDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">التاريخ الميلادي:</span>
                  <span class="info-value">${gregorianDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">بداية الوردية (توقيت السعودية):</span>
                  <span class="info-value">${shiftStartKSA}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">بداية الوردية (توقيت مصر):</span>
                  <span class="info-value">${shiftStartEgypt}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">نهاية الوردية (توقيت السعودية):</span>
                  <span class="info-value">${shiftEndKSA}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">نهاية الوردية (توقيت مصر):</span>
                  <span class="info-value">${shiftEndEgypt}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">موعد الوردية:</span>
                  <span class="info-value">${shiftPeriod}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">وقت الغلق (توقيت السعودية):</span>
                  <span class="info-value">${ksaTime}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">وقت الغلق (توقيت مصر):</span>
                  <span class="info-value">${egyptTime}</span>
                </div>
              </div>
              
              ${brandBalances && brandBalances.length > 0 ? `
              <div class="balances-section">
                <div class="balances-title">أرصدة العلامات التجارية عند الغلق</div>
                ${balancesTableRows}
              </div>
              ` : ''}
              
              <p>تم إغلاق الوردية بنجاح.</p>
            </div>
            <div class="footer">
              <p>نظام إدارة الورديات - Edara</p>
            </div>
          </div>
        </body>
        </html>
      `;

      sendEmailInBackground(admin.email, emailHtml, "إشعار ورديات");
      emailsSent++;
    }

    console.log(`Sent ${notifications.length} notifications and ${emailsSent} emails for shift close`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: adminProfiles.length,
        emailsSent: emailsSent
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-shift-close-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);