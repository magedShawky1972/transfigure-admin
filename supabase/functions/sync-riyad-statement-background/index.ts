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

  async searchSince(sinceDate: string): Promise<number[]> {
    const res = await this.sendCommand(`SEARCH SINCE ${sinceDate} FROM "9910013@riyadbank.com" SUBJECT "Merchant Report"`);
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
    const tag = this.nextTag();
    await this.conn!.write(this.encoder.encode(`${tag} FETCH ${uid} (BODY.PEEK[])\r\n`));

    let result = "";
    const started = Date.now();
    const timeoutMs = 120000;

    while (Date.now() - started < timeoutMs) {
      const buffer = new Uint8Array(131072);
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

// Extract Excel attachment from MIME body
function extractExcelAttachment(rawMessage: string): { data: Uint8Array; filename: string } | null {
  const boundaryMatches = [...rawMessage.matchAll(/boundary\s*=\s*"?([^";\r\n]+)"?/gi)];
  if (boundaryMatches.length === 0) return null;

  for (const bMatch of boundaryMatches) {
    const boundary = bMatch[1];
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = rawMessage.split(new RegExp(`--${esc}`, "g"));

    for (const part of parts) {
      const hasAttachment = /Content-Disposition:\s*attachment/i.test(part);
      const filenameMatch = part.match(/(?:filename|name)\*?=\s*"?([^";\r\n]+\.xlsx?)"?/i);

      if (!filenameMatch) continue;
      if (!hasAttachment && !/\.xlsx?/i.test(filenameMatch[1])) continue;

      const filename = filenameMatch[1].replace(/^.*''/, "");
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);

      if (!isBase64) continue;

      const bodyStart = part.search(/\r?\n\r?\n/);
      if (bodyStart === -1) continue;

      let base64Body = part.slice(bodyStart).replace(/\r?\n/g, "").trim();
      base64Body = base64Body.replace(/--[^\s]*--?\s*$/, "").replace(/\)\s*$/, "").replace(/A\d+\s+OK.*$/, "").trim();

      const padded = base64Body.length % 4 === 0 ? base64Body : base64Body + "=".repeat(4 - (base64Body.length % 4));

      try {
        const decoded = atob(padded);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        return { data: bytes, filename };
      } catch (e) {
        console.error(`Failed to decode base64 attachment:`, e);
      }
    }
  }
  return null;
}

// Extract date from email subject like "Merchant Report - 28/02/2026"
function extractDateFromSubject(subject: string): string | null {
  const m = subject.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

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

async function sendRawEmail(
  host: number, port: number, username: string, password: string,
  from: string, to: string, rawMessage: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host as any, port });
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

// Process a single Excel file and insert into DB
async function processExcelFile(
  supabase: any,
  attachment: { data: Uint8Array; filename: string },
  emailSubject: string
): Promise<{ insertedCount: number; skippedCount: number; missingColumns: string[]; extraColumns: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const workbook = XLSX.read(attachment.data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    const row = allRows[i];
    const rowStr = row.map((v: any) => String(v ?? "").trim()).join("|");
    if (rowStr.includes("Txn. Number") || rowStr.includes("Txn Number")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: "" });

  if (rawData.length === 0) return { insertedCount: 0, skippedCount: 0, missingColumns: [], extraColumns: [] };

  const excelHeaders = Object.keys(rawData[0]);
  const normalizeKey = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedExpected = EXPECTED_COLUMNS.map(normalizeKey);
  const normalizedActual = excelHeaders.map(normalizeKey);

  const missingColumns = EXPECTED_COLUMNS.filter((col) => !normalizedActual.includes(normalizeKey(col)));
  const extraColumns = excelHeaders.filter((col) => !normalizedExpected.includes(normalizeKey(col)));

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

  const validData = transformedData.filter((row) => row.txn_number);

  // Check duplicates
  const txnNumbers = validData.map((row) => row.txn_number);
  const existingTxnNumbers = new Set<string>();

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

  const newRows = validData.filter((row) => !existingTxnNumbers.has(row.txn_number));
  const skippedCount = validData.length - newRows.length;

  let insertedCount = 0;
  const insertBatchSize = 200;

  for (let i = 0; i < newRows.length; i += insertBatchSize) {
    const batch = newRows.slice(i, i + insertBatchSize);
    const { error: insertError } = await supabase.from("riyadbankstatement").insert(batch);

    if (insertError) {
      const colMatch = insertError.message?.match(/column "([^"]+)"/i);
      if (colMatch) {
        const badCol = colMatch[1];
        const cleanBatch = batch.map((row: any) => {
          const { [badCol]: _, ...rest } = row;
          return rest;
        });
        const { error: retryError } = await supabase.from("riyadbankstatement").insert(cleanBatch);
        if (!retryError) insertedCount += cleanBatch.length;
      }
    } else {
      insertedCount += batch.length;
    }
  }

  return { insertedCount, skippedCount, missingColumns, extraColumns };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }

  const mode = body?.mode || "full"; // "scan", "process", or "full" (legacy)

  // ==================== SCAN MODE ====================
  // Just connect to IMAP, list all files since last date, save to log, return
  if (mode === "scan") {
    const { data: logEntry } = await supabase
      .from("riyad_statement_auto_imports")
      .insert({ status: "scanning" })
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

      await updateLog({ current_step: "checking_last_date" });
      const { data: lastDateSetting } = await supabase
        .from("api_integration_settings")
        .select("setting_value")
        .eq("setting_key", "riyad_bank_last_import_date")
        .single();

      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() - 30); // default 30 days if no last date
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      let sinceDate: string;
      let lastDateStr: string | null = lastDateSetting?.setting_value || null;
      if (lastDateStr) {
        const d = new Date(lastDateStr);
        sinceDate = `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
      } else {
        sinceDate = `${defaultDate.getDate()}-${months[defaultDate.getMonth()]}-${defaultDate.getFullYear()}`;
      }

      await updateLog({ current_step: "connecting_to_email" });
      const imap = new IMAPClient(imapHost, imapPort);
      await imap.connect();
      await imap.login(email, emailPassword);
      await imap.select("INBOX");

      await updateLog({ current_step: "searching_emails" });
      const messageIds = await imap.searchSince(sinceDate);
      console.log(`Scan: Found ${messageIds.length} emails since ${sinceDate}`);

      if (messageIds.length === 0) {
        await imap.logout();
        await updateLog({ status: "no_email", error_message: "No Riyad Bank emails found", current_step: "completed" });
        return new Response(JSON.stringify({ log_id: logId, found_files: [], message: "No emails found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await updateLog({ current_step: "scanning_emails" });
      interface EmailInfo { uid: number; subject: string; date: string | null; }
      const emailInfos: EmailInfo[] = [];

      for (const uid of messageIds) {
        const headers = await imap.fetchHeaders(uid);
        const isRiyadBank = /9910013@riyadbank\.com/i.test(headers) && /Merchant\s*Report/i.test(headers);
        if (!isRiyadBank) continue;
        const subjectMatch = headers.match(/Subject:\s*(.+?)(?:\r?\n(?!\s))/i);
        const subject = subjectMatch?.[1]?.trim() || "Riyad Bank Statement";
        const dateFromSubject = extractDateFromSubject(subject);
        emailInfos.push({ uid, subject, date: dateFromSubject });
      }

      await imap.logout();

      // Sort by date oldest first
      emailInfos.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      const foundFiles = emailInfos.map((e, i) => ({
        index: i,
        uid: e.uid,
        subject: e.subject,
        date: e.date,
        status: "pending",
        inserted: 0,
        skipped: 0,
      }));

      await updateLog({
        status: "scanned",
        found_files: foundFiles,
        total_files: foundFiles.length,
        current_step: "scan_complete",
      });

      return new Response(JSON.stringify({ log_id: logId, found_files: foundFiles, last_date: lastDateStr }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error: any) {
      console.error("Scan error:", error);
      await updateLog({ status: "error", error_message: error.message, current_step: "error" });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ==================== PROCESS MODE ====================
  // Process files from an existing scan log entry, one batch at a time
  if (mode === "process") {
    const logId = body?.log_id;
    if (!logId) {
      return new Response(JSON.stringify({ error: "log_id is required for process mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: logEntry } = await supabase
      .from("riyad_statement_auto_imports")
      .select("*")
      .eq("id", logId)
      .single();

    if (!logEntry) {
      return new Response(JSON.stringify({ error: "Log entry not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const foundFiles = (logEntry.found_files || []) as any[];
    const pendingFiles = foundFiles.filter((f: any) => f.status === "pending");

    if (pendingFiles.length === 0) {
      return new Response(JSON.stringify({ message: "No pending files to process", done: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateLog = async (updates: Record<string, any>) => {
      await supabase.from("riyad_statement_auto_imports").update(updates).eq("id", logId);
    };

    await updateLog({ status: "processing", current_step: "connecting_to_email" });

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

      const imap = new IMAPClient(imapHost, imapPort);
      await imap.connect();
      await imap.login(email, emailPassword);
      await imap.select("INBOX");

      // Process max 3 files per call to stay within CPU limits
      const MAX_FILES_PER_CALL = 3;
      const filesToProcess = pendingFiles.slice(0, MAX_FILES_PER_CALL);

      let totalInserted = logEntry.records_inserted || 0;
      let totalSkipped = logEntry.records_skipped || 0;

      for (const fileInfo of filesToProcess) {
        const idx = fileInfo.index;
        console.log(`Processing file ${idx + 1}/${foundFiles.length}: ${fileInfo.subject}`);

        await updateLog({
          current_step: `downloading_file_${idx}`,
          current_file_index: idx,
          email_subject: fileInfo.subject,
        });

        // Download attachment using saved UID
        const fullMessage = await imap.fetchFull(fileInfo.uid);
        const attachment = extractExcelAttachment(fullMessage);

        if (!attachment) {
          console.warn(`No Excel attachment in email: ${fileInfo.subject}`);
          foundFiles[idx].status = "no_attachment";
          await updateLog({ found_files: foundFiles });
          continue;
        }

        foundFiles[idx].filename = attachment.filename;
        foundFiles[idx].status = "processing";
        await updateLog({
          found_files: foundFiles,
          current_step: `processing_file_${idx}`,
        });

        const result = await processExcelFile(supabase, attachment, fileInfo.subject);

        foundFiles[idx].status = "completed";
        foundFiles[idx].inserted = result.insertedCount;
        foundFiles[idx].skipped = result.skippedCount;

        totalInserted += result.insertedCount;
        totalSkipped += result.skippedCount;

        // Checkpoint: save last date after each file
        if (fileInfo.date) {
          const nextDate = new Date(fileInfo.date);
          nextDate.setDate(nextDate.getDate() + 1);
          const nextDateStr = nextDate.toISOString().split("T")[0];
          await supabase
            .from("api_integration_settings")
            .upsert({
              setting_key: "riyad_bank_last_import_date",
              setting_value: nextDateStr,
              updated_at: new Date().toISOString(),
            }, { onConflict: "setting_key" });
        }

        await updateLog({
          found_files: foundFiles,
          records_inserted: totalInserted,
          records_skipped: totalSkipped,
        });

        console.log(`File ${idx + 1} done: ${result.insertedCount} inserted, ${result.skippedCount} skipped`);
      }

      await imap.logout();

      // Check if there are still pending files
      const remainingPending = foundFiles.filter((f: any) => f.status === "pending");
      const allDone = remainingPending.length === 0;

      if (allDone) {
        // All files processed - mark completed and send notification
        await updateLog({
          status: "completed",
          records_inserted: totalInserted,
          records_skipped: totalSkipped,
          current_step: "sending_notification",
          found_files: foundFiles,
        });

        // Upload log for history
        try {
          await supabase.from("upload_logs").insert({
            file_name: `Riyad Bank (${foundFiles.length} files)`,
            user_name: "EdaraBoot",
            user_id: null,
            status: "completed",
            records_processed: totalInserted,
            duplicate_records_count: totalSkipped,
            error_message: null,
          });
        } catch (ulErr) {
          console.error("Failed to create upload_log entry:", ulErr);
        }

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
          timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit",
          day: "2-digit", hour: "2-digit", minute: "2-digit",
        });

        const filesTableRows = foundFiles.map((f: any) =>
          `<tr><td style="padding:8px;border:1px solid #ddd;">${f.subject}</td>
           <td style="padding:8px;border:1px solid #ddd;">${f.date || '-'}</td>
           <td style="padding:8px;border:1px solid #ddd;">${f.inserted}</td>
           <td style="padding:8px;border:1px solid #ddd;">${f.skipped}</td>
           <td style="padding:8px;border:1px solid #ddd;">${f.status}</td></tr>`
        ).join("");

        const emailSubjectLine = "تم تحميل كشف بنك الرياض - Riyad Bank Statement Uploaded";
        const emailHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;direction:rtl;margin:0;padding:0;background-color:#f4f4f4;">
  <div style="max-width:700px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:600;">تم تحميل كشف بنك الرياض تلقائياً</h1>
    </div>
    <div style="padding:30px;">
      <p style="font-size:16px;line-height:1.8;margin:10px 0;"><strong>عدد الملفات:</strong> ${foundFiles.length}</p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;"><strong>إجمالي السجلات المضافة:</strong> ${totalInserted}</p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;"><strong>إجمالي السجلات المتكررة:</strong> ${totalSkipped}</p>
      <p style="font-size:16px;line-height:1.8;margin:10px 0;"><strong>وقت التحميل:</strong> ${formattedTime}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:15px;">
        <thead><tr style="background:#f0f4ff;">
          <th style="padding:8px;border:1px solid #ddd;">الموضوع</th>
          <th style="padding:8px;border:1px solid #ddd;">التاريخ</th>
          <th style="padding:8px;border:1px solid #ddd;">مضاف</th>
          <th style="padding:8px;border:1px solid #ddd;">مكرر</th>
          <th style="padding:8px;border:1px solid #ddd;">الحالة</th>
        </tr></thead>
        <tbody>${filesTableRows}</tbody>
      </table>
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
            await sendRawEmail(smtpHost as any, smtpPort, smtpUsername, smtpPassword, fromAddress, toEmail, rawMsg);
          } catch (emailErr) {
            console.error("Failed to send notification email:", emailErr);
          }
        }

        await updateLog({ current_step: "completed" });

        return new Response(JSON.stringify({
          done: true,
          records_inserted: totalInserted,
          records_skipped: totalSkipped,
          files: foundFiles,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        // More files remaining
        await updateLog({
          status: "scanned",
          current_step: "batch_complete",
          found_files: foundFiles,
          records_inserted: totalInserted,
          records_skipped: totalSkipped,
        });

        return new Response(JSON.stringify({
          done: false,
          remaining: remainingPending.length,
          records_inserted: totalInserted,
          records_skipped: totalSkipped,
          files: foundFiles,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (error: any) {
      console.error("Process error:", error);
      await updateLog({ status: "error", error_message: error.message, current_step: "error" });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ==================== FULL MODE (legacy/cron) ====================
  // For backward compatibility with pg_cron scheduled runs
  const { data: logEntry } = await supabase
    .from("riyad_statement_auto_imports")
    .insert({ status: "processing" })
    .select()
    .single();

  const logId = logEntry?.id;

  const updateLog = async (updates: Record<string, any>) => {
    if (!logId) return;
    await supabase.from("riyad_statement_auto_imports").update(updates).eq("id", logId);
  };

  const updateStep = async (step: string) => {
    console.log(`Step: ${step}`);
    await updateLog({ current_step: step });
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

    await updateStep("checking_last_date");
    const { data: lastDateSetting } = await supabase
      .from("api_integration_settings")
      .select("setting_value")
      .eq("setting_key", "riyad_bank_last_import_date")
      .single();

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let sinceDate: string;
    if (lastDateSetting?.setting_value) {
      const d = new Date(lastDateSetting.setting_value);
      sinceDate = `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } else {
      sinceDate = `${defaultDate.getDate()}-${months[defaultDate.getMonth()]}-${defaultDate.getFullYear()}`;
    }

    await updateStep("connecting_to_email");
    const imap = new IMAPClient(imapHost, imapPort);
    await imap.connect();
    await imap.login(email, emailPassword);
    await imap.select("INBOX");

    await updateStep("searching_emails");
    const messageIds = await imap.searchSince(sinceDate);

    if (messageIds.length === 0) {
      await imap.logout();
      await updateLog({ status: "no_email", error_message: "No Riyad Bank emails found", current_step: "completed" });
      return new Response(JSON.stringify({ message: "No emails found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await updateStep("scanning_emails");
    interface EmailInfo { uid: number; subject: string; date: string | null; }
    const emailInfos: EmailInfo[] = [];

    for (const uid of messageIds) {
      const headers = await imap.fetchHeaders(uid);
      const isRiyadBank = /9910013@riyadbank\.com/i.test(headers) && /Merchant\s*Report/i.test(headers);
      if (!isRiyadBank) continue;
      const subjectMatch = headers.match(/Subject:\s*(.+?)(?:\r?\n(?!\s))/i);
      const subject = subjectMatch?.[1]?.trim() || "Riyad Bank Statement";
      const dateFromSubject = extractDateFromSubject(subject);
      emailInfos.push({ uid, subject, date: dateFromSubject });
    }

    if (emailInfos.length === 0) {
      await imap.logout();
      await updateLog({ status: "no_email", error_message: "No matching emails", current_step: "completed" });
      return new Response(JSON.stringify({ message: "No matching emails" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    emailInfos.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const MAX_FILES_PER_RUN = 3;
    const filesToProcess = emailInfos.slice(0, MAX_FILES_PER_RUN);

    const foundFiles = filesToProcess.map((e, i) => ({
      index: i, subject: e.subject, date: e.date, status: "pending", inserted: 0, skipped: 0,
    }));

    await updateLog({ found_files: foundFiles, total_files: filesToProcess.length, current_file_index: 0 });

    let totalInserted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const emailInfo = filesToProcess[i];
      await updateLog({ current_step: `downloading_file_${i}`, current_file_index: i, email_subject: emailInfo.subject });

      const fullMessage = await imap.fetchFull(emailInfo.uid);
      const attachment = extractExcelAttachment(fullMessage);

      if (!attachment) {
        foundFiles[i].status = "no_attachment";
        await updateLog({ found_files: foundFiles });
        continue;
      }

      foundFiles[i].status = "processing";
      await updateLog({ found_files: foundFiles, current_step: `processing_file_${i}` });

      const result = await processExcelFile(supabase, attachment, emailInfo.subject);

      foundFiles[i].status = "completed";
      foundFiles[i].inserted = result.insertedCount;
      foundFiles[i].skipped = result.skippedCount;
      totalInserted += result.insertedCount;
      totalSkipped += result.skippedCount;

      if (emailInfo.date) {
        const nextDate = new Date(emailInfo.date);
        nextDate.setDate(nextDate.getDate() + 1);
        await supabase.from("api_integration_settings").upsert({
          setting_key: "riyad_bank_last_import_date",
          setting_value: nextDate.toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        }, { onConflict: "setting_key" });
      }

      await updateLog({ found_files: foundFiles, records_inserted: totalInserted, records_skipped: totalSkipped });
    }

    await imap.logout();

    await updateLog({
      status: "completed", records_inserted: totalInserted, records_skipped: totalSkipped,
      current_step: "completed", found_files: foundFiles,
      error_message: emailInfos.length > MAX_FILES_PER_RUN ? `Processed ${MAX_FILES_PER_RUN} of ${emailInfos.length}. Run again.` : null,
    });

    try {
      await supabase.from("upload_logs").insert({
        file_name: `Riyad Bank (${filesToProcess.length} files)`, user_name: "EdaraBoot",
        user_id: null, status: "completed", records_processed: totalInserted,
        duplicate_records_count: totalSkipped, error_message: null,
      });
    } catch { /* non-fatal */ }

    await updateLog({ current_step: "completed" });

    return new Response(JSON.stringify({
      success: true, total_files: emailInfos.length,
      records_inserted: totalInserted, records_skipped: totalSkipped, files: foundFiles,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error:", error);
    await updateLog({ status: "error", error_message: error.message, current_step: "error" });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
