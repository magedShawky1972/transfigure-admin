import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Column mapping: Excel header → DB column
const COLUMN_MAP: Record<string, string> = {
  "Txn. Date": "txn_date",
  "Card Number": "card_number",
  "Txn. Amount": "txn_amount",
  "Fee": "fee",
  "VAT": "vat",
  "VAT %": "vat_2",
  "Net Amount": "net_amount",
  "Auth Code": "auth_code",
  "Txn. Type": "txn_type",
  "Card Type": "card_type",
  "Txn. Number": "txn_number",
  "Terminal ID": "terminal_id",
  "Payment Date": "payment_date",
  "Posting Date": "posting_date",
  "Payment Number": "payment_number",
  "Merchant Account": "merchant_account",
  "Txn. Certificate": "txn_certificate",
  "Acquirer Private Data": "acquirer_private_data",
  "Payment Reference": "payment_reference",
};

const EXPECTED_COLUMNS = Object.keys(COLUMN_MAP);

// IMAP Client for extracting attachments
class IMAPClient {
  private conn: Deno.TlsConn | null = null;
  private tagCounter = 0;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder("latin1");

  constructor(private host: string, private port: number) {}

  private nextTag(): string {
    return `A${++this.tagCounter}`;
  }

  private async readWithTimeout(timeoutMs = 15000): Promise<Uint8Array | null> {
    const buffer = new Uint8Array(65536);
    const readPromise = this.conn!.read(buffer);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const n = (await Promise.race([readPromise, timeoutPromise])) as number | null;
    if (n === null) return null;
    return buffer.subarray(0, n);
  }

  private async readResponseUntil(predicate: (acc: string) => boolean, timeoutMs = 30000): Promise<string> {
    let result = "";
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const chunk = await this.readWithTimeout(5000);
      if (chunk === null) break;
      result += this.decoder.decode(chunk);
      if (predicate(result)) break;
    }
    return result;
  }

  private async sendCommand(command: string): Promise<{ tag: string; response: string; ok: boolean }> {
    const tag = this.nextTag();
    await this.conn!.write(this.encoder.encode(`${tag} ${command}\r\n`));
    const response = await this.readResponseUntil(
      (acc) =>
        acc.includes(`\r\n${tag} OK`) ||
        acc.includes(`\r\n${tag} NO`) ||
        acc.includes(`\r\n${tag} BAD`) ||
        acc.startsWith(`${tag} OK`) ||
        acc.startsWith(`${tag} NO`) ||
        acc.startsWith(`${tag} BAD`),
      30000
    );
    const ok = response.includes(`${tag} OK`);
    return { tag, response, ok };
  }

  async connect(): Promise<void> {
    this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    await this.readResponseUntil((acc) => acc.includes("\r\n") && acc.trimStart().startsWith("*"), 10000);
  }

  async login(user: string, pass: string): Promise<void> {
    const escapedPass = pass.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const res = await this.sendCommand(`LOGIN "${user}" "${escapedPass}"`);
    if (!res.ok) throw new Error("IMAP login failed");
  }

  async select(mailbox: string): Promise<void> {
    const res = await this.sendCommand(`SELECT "${mailbox}"`);
    if (!res.ok) throw new Error("IMAP SELECT failed");
  }

  async searchToday(): Promise<number[]> {
    // Search for emails from 9910013@riyadbank.com with subject "Merchant Report"
    const today = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
    const res = await this.sendCommand(`SEARCH SINCE ${dateStr} FROM "9910013@riyadbank.com" SUBJECT "Merchant Report"`);
    if (!res.ok) return [];
    const m = res.response.match(/\*\s+SEARCH\s+([0-9 ]+)\r?\n/i);
    const ids = (m?.[1] ?? "").trim().split(/\s+/).filter(Boolean).map(Number);
    return ids;
  }

  async fetchHeaders(uid: number): Promise<string> {
    const res = await this.sendCommand(`FETCH ${uid} (BODY.PEEK[HEADER])`);
    return res.response;
  }

  async fetchFull(uid: number): Promise<string> {
    // Read full message for attachment extraction - use larger timeout and buffer
    const tag = this.nextTag();
    await this.conn!.write(this.encoder.encode(`${tag} FETCH ${uid} (BODY.PEEK[])\r\n`));

    let result = "";
    const started = Date.now();
    const timeoutMs = 120000; // 2 minutes for large attachments

    while (Date.now() - started < timeoutMs) {
      const buffer = new Uint8Array(131072); // 128KB buffer
      const readPromise = this.conn!.read(buffer);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
      const n = (await Promise.race([readPromise, timeoutPromise])) as number | null;
      if (n === null) break;
      result += this.decoder.decode(buffer.subarray(0, n));
      if (result.includes(`${tag} OK`) || result.includes(`${tag} NO`) || result.includes(`${tag} BAD`)) break;
    }

    return result;
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch { /* ignore */ }
    try {
      this.conn?.close();
    } catch { /* ignore */ }
  }
}

// Extract Excel attachment from MIME body - handles nested multipart
function extractExcelAttachment(rawMessage: string): { data: Uint8Array; filename: string } | null {
  // Find ALL boundaries in the message (for nested multipart)
  const boundaryMatches = [...rawMessage.matchAll(/boundary\s*=\s*"?([^";\r\n]+)"?/gi)];
  if (boundaryMatches.length === 0) {
    console.log("No MIME boundary found in message");
    return null;
  }

  for (const bMatch of boundaryMatches) {
    const boundary = bMatch[1];
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = rawMessage.split(new RegExp(`--${esc}`, "g"));

    for (const part of parts) {
      // Look for Excel attachment - check both attachment and name patterns
      const hasAttachment = /Content-Disposition:\s*attachment/i.test(part);
      const filenameMatch = part.match(/(?:filename|name)\*?=\s*"?([^";\r\n]+\.xlsx?)"?/i);

      if (!filenameMatch) continue;
      // Accept if it has an Excel filename, even without explicit Content-Disposition: attachment
      if (!hasAttachment && !/\.xlsx?/i.test(filenameMatch[1])) continue;

      const filename = filenameMatch[1].replace(/^.*''/, ""); // handle RFC 5987 encoding
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);

      console.log(`Found Excel part: "${filename}", base64=${isBase64}, partLen=${part.length}`);

      if (!isBase64) continue;

      // Extract the base64 body (after double newline in the part)
      const bodyStart = part.search(/\r?\n\r?\n/);
      if (bodyStart === -1) continue;

      let base64Body = part.slice(bodyStart).replace(/\r?\n/g, "").trim();
      // Remove any trailing boundary markers or IMAP tags
      base64Body = base64Body.replace(/--[^\s]*--?\s*$/, "").replace(/\)\s*$/, "").replace(/A\d+\s+OK.*$/, "").trim();

      // Ensure valid base64 length (multiple of 4)
      const padded = base64Body.length % 4 === 0 ? base64Body : base64Body + "=".repeat(4 - (base64Body.length % 4));

      try {
        const decoded = atob(padded);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        console.log(`Decoded attachment: ${bytes.length} bytes`);
        return { data: bytes, filename };
      } catch (e) {
        console.error(`Failed to decode base64 attachment (len=${base64Body.length}):`, e);
      }
    }
  }

  console.log("No Excel attachment found in any MIME part");
  return null;
}

// Encode subject for Arabic emails
function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

// Build raw email
function buildRawEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const encodedSubject = encodeSubject(subject);
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
  ].join("\r\n");

  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(htmlBody);
  const htmlBase64 = btoa(String.fromCharCode(...htmlBytes));
  const lines = htmlBase64.match(/.{1,76}/g) || [];
  return headers + "\r\n" + lines.join("\r\n");
}

// Send email via raw SMTP
async function sendRawEmail(
  host: string, port: number, username: string, password: string,
  from: string, to: string, rawMessage: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(): Promise<string> {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    return n ? decoder.decode(buffer.subarray(0, n)) : "";
  }
  async function write(cmd: string): Promise<void> {
    await conn.write(encoder.encode(cmd + "\r\n"));
  }

  try {
    await read();
    await write("EHLO localhost"); await read();
    await write("AUTH LOGIN"); await read();
    await write(btoa(username)); await read();
    await write(btoa(password));
    const authRes = await read();
    if (!authRes.startsWith("235")) throw new Error("SMTP Auth failed");
    await write(`MAIL FROM:<${username}>`); await read();
    await write(`RCPT TO:<${to}>`); await read();
    await write("DATA"); await read();
    await conn.write(encoder.encode(rawMessage + "\r\n.\r\n")); await read();
    await write("QUIT");
  } finally {
    conn.close();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create import log entry
  const { data: logEntry, error: logError } = await supabase
    .from("riyad_statement_auto_imports")
    .insert({ status: "processing" })
    .select()
    .single();

  const logId = logEntry?.id;

  const updateLog = async (updates: Record<string, any>) => {
    if (!logId) return;
    await supabase.from("riyad_statement_auto_imports").update(updates).eq("id", logId);
  };

  try {
    const imapHost = "imap.hostinger.com";
    const imapPort = 993;
    const email = "cto@asuscards.com";
    const emailPassword = Deno.env.get("CTO_EMAIL_PASSWORD") ?? "";

    if (!emailPassword) {
      await updateLog({ status: "error", error_message: "CTO_EMAIL_PASSWORD not configured" });
      return new Response(JSON.stringify({ error: "CTO_EMAIL_PASSWORD not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Connecting to IMAP...");
    const imap = new IMAPClient(imapHost, imapPort);
    await imap.connect();
    await imap.login(email, emailPassword);
    await imap.select("INBOX");

    console.log("Searching for today's emails...");
    const messageIds = await imap.searchToday();
    console.log(`Found ${messageIds.length} emails from today`);

    let attachment: { data: Uint8Array; filename: string } | null = null;
    let emailSubject = "";

    // Look through today's emails for Riyad Bank statement (check most recent first)
    for (let i = messageIds.length - 1; i >= 0; i--) {
      const uid = messageIds[i];
      const headers = await imap.fetchHeaders(uid);

      // Verify sender is 9910013@riyadbank.com and subject contains "Merchant Report"
      const isRiyadBank = /9910013@riyadbank\.com/i.test(headers) && /Merchant\s*Report/i.test(headers);
      if (!isRiyadBank) continue;

      // Extract subject
      const subjectMatch = headers.match(/Subject:\s*(.+?)(?:\r?\n(?!\s))/i);
      emailSubject = subjectMatch?.[1]?.trim() || "Riyad Bank Statement";

      console.log(`Found Riyad Bank email: "${emailSubject}" (msg ${uid})`);

      // Fetch full message for attachment
      const fullMessage = await imap.fetchFull(uid);
      attachment = extractExcelAttachment(fullMessage);

      if (attachment) {
        console.log(`Extracted attachment: ${attachment.filename} (${attachment.data.length} bytes)`);
        break;
      }
    }

    await imap.logout();

    if (!attachment) {
      const msg = "No Riyad Bank statement email with Excel attachment found today";
      console.log(msg);
      await updateLog({ status: "no_email", error_message: msg, email_subject: emailSubject || null });
      return new Response(JSON.stringify({ message: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await updateLog({ email_subject: emailSubject });

    // Parse Excel - handle report header rows by finding the actual data header row
    console.log("Parsing Excel file...");
    const workbook = XLSX.read(attachment.data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // First, read all rows as raw arrays to find the header row containing "Txn. Number"
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    console.log(`Total raw rows: ${allRows.length}, sheet: "${sheetName}"`);

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const row = allRows[i];
      const rowStr = row.map((v: any) => String(v ?? "").trim()).join("|");
      if (rowStr.includes("Txn. Number") || rowStr.includes("Txn Number")) {
        headerRowIndex = i;
        console.log(`Found header row at index ${i}: ${rowStr.substring(0, 200)}`);
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Fallback: try default parsing
      console.warn("Could not find header row with 'Txn. Number', using default row 0");
      headerRowIndex = 0;
    }

    // Re-parse with the correct header row
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { 
      range: headerRowIndex,
      defval: "" 
    });

    console.log(`Parsed ${rawData.length} data rows (header at row ${headerRowIndex})`);

    if (rawData.length === 0) {
      await updateLog({ status: "empty", error_message: "Excel file has no data rows" });
      return new Response(JSON.stringify({ message: "No data in Excel" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for missing/extra columns
    const excelHeaders = Object.keys(rawData[0]);
    const normalizeKey = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const normalizedExpected = EXPECTED_COLUMNS.map(normalizeKey);
    const normalizedActual = excelHeaders.map(normalizeKey);

    const missingColumns = EXPECTED_COLUMNS.filter((col) => !normalizedActual.includes(normalizeKey(col)));
    const extraColumns = excelHeaders.filter((col) => !normalizedExpected.includes(normalizeKey(col)));

    if (missingColumns.length > 0) {
      console.warn(`Missing columns in Excel: ${missingColumns.join(", ")}`);
    }
    if (extraColumns.length > 0) {
      console.warn(`Extra columns in Excel (ignored): ${extraColumns.join(", ")}`);
    }

    await updateLog({ missing_columns: missingColumns.length > 0 ? missingColumns : null, extra_columns: extraColumns.length > 0 ? extraColumns : null });

    // Map data using fuzzy header matching
    const headerKeyMap: Record<string, string> = {};
    for (const excelHeader of excelHeaders) {
      const normalized = normalizeKey(excelHeader);
      for (const [expectedHeader, dbColumn] of Object.entries(COLUMN_MAP)) {
        if (normalizeKey(expectedHeader) === normalized) {
          headerKeyMap[excelHeader] = dbColumn;
          break;
        }
      }
    }

    const transformedData = rawData.map((row) => {
      const newRow: Record<string, any> = {};
      for (const [excelHeader, dbColumn] of Object.entries(headerKeyMap)) {
        const value = row[excelHeader];
        if (value !== undefined && value !== null && value !== "") {
          newRow[dbColumn] = String(value);
        }
      }
      return newRow;
    });

    // Filter out rows without txn_number
    const validData = transformedData.filter((row) => row.txn_number);
    console.log(`${validData.length} rows have txn_number`);

    // Check for duplicates by txn_number
    const txnNumbers = validData.map((row) => row.txn_number);
    const existingTxnNumbers = new Set<string>();

    // Check in batches
    const batchSize = 500;
    for (let i = 0; i < txnNumbers.length; i += batchSize) {
      const batch = txnNumbers.slice(i, i + batchSize);
      const response = await fetch(
        `${supabaseUrl}/rest/v1/riyadbankstatement?select=txn_number&txn_number=in.(${encodeURIComponent(batch.map((v) => `"${v}"`).join(","))})`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );
      if (response.ok) {
        const existing = await response.json();
        existing.forEach((row: any) => existingTxnNumbers.add(String(row.txn_number)));
      }
    }

    // Filter out duplicates (always skip)
    const newRows = validData.filter((row) => !existingTxnNumbers.has(row.txn_number));
    const skippedCount = validData.length - newRows.length;

    console.log(`New: ${newRows.length}, Skipped (duplicates): ${skippedCount}`);

    // Insert new records in batches
    let insertedCount = 0;
    const insertBatchSize = 200;

    for (let i = 0; i < newRows.length; i += insertBatchSize) {
      const batch = newRows.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase.from("riyadbankstatement").insert(batch);

      if (insertError) {
        console.error(`Insert batch error at offset ${i}:`, insertError);

        // Try removing unknown columns and retry
        const colMatch = insertError.message?.match(/column "([^"]+)"/i);
        if (colMatch) {
          const badCol = colMatch[1];
          console.warn(`Removing unknown column: ${badCol}`);
          const cleanBatch = batch.map((row) => {
            const { [badCol]: _, ...rest } = row;
            return rest;
          });
          const { error: retryError } = await supabase.from("riyadbankstatement").insert(cleanBatch);
          if (!retryError) {
            insertedCount += cleanBatch.length;
          } else {
            console.error("Retry also failed:", retryError);
          }
        }
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Inserted ${insertedCount} records`);

    // Post-insert: Link acquirer_private_data to bank_ledger
    if (insertedCount > 0) {
      console.log("Running bank_ledger matching...");
      try {
        // Get the new records' acquirer_private_data values
        const apds = newRows
          .map((r) => r.acquirer_private_data)
          .filter((v) => v && v.trim());

        if (apds.length > 0) {
          // Find matching order_payment records by paymentrefrence
          for (let i = 0; i < apds.length; i += 100) {
            const batch = apds.slice(i, i + 100);
            const { data: matchingPayments } = await supabase
              .from("order_payment")
              .select("paymentrefrence, id")
              .in("paymentrefrence", batch);

            if (matchingPayments && matchingPayments.length > 0) {
              console.log(`Found ${matchingPayments.length} matching order_payment records`);
              // Update bank_ledger reference_number where it matches
              for (const payment of matchingPayments) {
                if (payment.paymentrefrence) {
                  await supabase
                    .from("bank_ledger")
                    .update({ reference_number: payment.paymentrefrence })
                    .eq("paymentrefrence", payment.paymentrefrence)
                    .is("reference_number", null);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Bank ledger matching error (non-fatal):", e);
      }
    }

    // Update log
    await updateLog({
      status: "completed",
      records_inserted: insertedCount,
      records_skipped: skippedCount,
    });

    // Send notification email
    const smtpHost = "smtp.hostinger.com";
    const smtpPort = 465;
    const smtpUsername = "edara@asuscards.com";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
    const fromAddress = "Edara Support <edara@asuscards.com>";
    const toEmail = "maged.shawky@asuscards.com";

    const now = new Date();
    const ksaTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const formattedTime = ksaTime.toLocaleString("ar-SA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const missingColsHtml = missingColumns.length > 0
      ? `<p style="font-size:16px;line-height:1.8;margin:10px 0;color:#dc2626;"><strong>أعمدة مفقودة:</strong> ${missingColumns.join("، ")}</p>`
      : "";
    const extraColsHtml = extraColumns.length > 0
      ? `<p style="font-size:16px;line-height:1.8;margin:10px 0;color:#d97706;"><strong>أعمدة إضافية (تم تجاهلها):</strong> ${extraColumns.join("، ")}</p>`
      : "";

    const emailSubjectLine = "تم تحميل كشف بنك الرياض - Riyad Bank Statement Uploaded";
    const emailHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;direction:rtl;margin:0;padding:0;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:600;">تم تحميل كشف بنك الرياض تلقائياً</h1>
    </div>
    <div style="padding:30px;">
      <p style="font-size:16px;line-height:1.8;margin:10px 0;">
        <strong>عدد السجلات المضافة:</strong> ${insertedCount}
      </p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;">
        <strong>عدد السجلات المتكررة (تم تخطيها):</strong> ${skippedCount}
      </p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;">
        <strong>عنوان الإيميل:</strong> ${emailSubject}
      </p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;">
        <strong>وقت التحميل:</strong> ${formattedTime}
      </p>
      ${missingColsHtml}
      ${extraColsHtml}
    </div>
    <div style="background:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:14px;">
      <p style="margin:0;">هذا إشعار تلقائي من نظام إدارة - Edara</p>
    </div>
  </div>
</body>
</html>`;

    if (smtpPassword) {
      try {
        const rawMsg = buildRawEmail(fromAddress, toEmail, emailSubjectLine, emailHtml);
        await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, toEmail, rawMsg);
        console.log("Notification email sent successfully");
      } catch (emailErr) {
        console.error("Failed to send notification email:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        records_inserted: insertedCount,
        records_skipped: skippedCount,
        missing_columns: missingColumns,
        extra_columns: extraColumns,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sync-riyad-statement-background:", error);
    await updateLog({ status: "error", error_message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
