import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

export async function sendEmail(email: string, userName: string, emailSubject: string, emailHtml: string) {
  // Send the email in the background
  sendEmailInBackground(email, userName, emailSubject, emailHtml);

  return {
    success: true,
    message: "Email is being sent in the background.",
  };
}

async function sendEmailInBackground(email: string, userName: string, emailSubject: string, emailHtml: string) {
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

    console.log("Attempting to send email to:", email);

    // IMPORTANT: subject must be plain UTF-8 with no manual encoding
    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: emailSubject, // ← FIXED — no encoding
      content: "auto",
      html: emailHtml,
    });

    await smtpClient.close();

    console.log("Email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send email to", email, ":", emailError);
  }
}
