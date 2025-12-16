import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchEmailBodyRequest {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  email: string;
  emailPassword: string;
  folder?: string;
  messageId: string; // stored message_id from DB
}

function decodeQuotedPrintable(text: string): string {
  if (!text) return text;
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64(text: string): string {
  if (!text) return text;
  const cleaned = text.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned) || cleaned.length % 4 !== 0) return text;
  try {
    const decoded = atob(cleaned);
    const bytes = new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
}

function extractBodyFromMime(rawBody: string): { text: string; html: string; hasAttachments: boolean } {
  const hasAttachments =
    /Content-Disposition:\s*attachment/i.test(rawBody) ||
    /\bfilename\*?=|\bname\*?=/i.test(rawBody) ||
    (/Content-Type:\s*image\//i.test(rawBody) && /Content-ID:\s*<[^>]+>/i.test(rawBody));

  let textContent = "";
  let htmlContent = "";

  const boundaryMatch = rawBody.match(/boundary="?([^"\r\n;]+)"?/i);

  const decodePart = (part: string): string => {
    const partEncoding = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    const contentStart = part.search(/\r?\n\r?\n/);
    if (contentStart === -1) return "";
    let content = part.substring(contentStart).trim();

    if (partEncoding) {
      const enc = partEncoding[1].toLowerCase();
      if (enc === "base64") content = decodeBase64(content);
      else if (enc === "quoted-printable") content = decodeQuotedPrintable(content);
    }
    return content;
  };

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawBody.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "g"));
    for (const part of parts) {
      if (!part.trim() || part.trim() === "--") continue;
      const ct = part.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]?.toLowerCase() ?? "";
      const content = decodePart(part);
      if (!content) continue;
      if (ct.includes("text/plain") && !textContent) textContent = content;
      if (ct.includes("text/html") && !htmlContent) htmlContent = content;
    }
  } else {
    // Not multipart
    const transferEncodingMatch = rawBody.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    const contentTypeMatch = rawBody.match(/Content-Type:\s*([^;\r\n]+)/i);

    let content = rawBody;
    const contentStart = rawBody.search(/\r?\n\r?\n/);
    if (contentStart !== -1) content = rawBody.substring(contentStart).trim();

    if (transferEncodingMatch) {
      const enc = transferEncodingMatch[1].toLowerCase();
      if (enc === "base64") content = decodeBase64(content);
      else if (enc === "quoted-printable") content = decodeQuotedPrintable(content);
    }

    if (contentTypeMatch?.[1]?.toLowerCase().includes("text/html")) htmlContent = content;
    else textContent = content;
  }

  // If only HTML, derive text
  if (!textContent && htmlContent) {
    textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  return { text: textContent, html: htmlContent, hasAttachments };
}

class IMAPClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private tagCounter = 0;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder("latin1");

  constructor(private host: string, private port: number, private secure: boolean) {}

  private nextTag(): string {
    return `A${++this.tagCounter}`;
  }

  private async readWithTimeout(timeoutMs = 15000): Promise<Uint8Array | null> {
    const buffer = new Uint8Array(16384);
    const readPromise = this.conn!.read(buffer);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const n = (await Promise.race([readPromise, timeoutPromise])) as number | null;
    if (n === null) return null;
    return buffer.subarray(0, n);
  }

  private async readResponseUntil(predicate: (acc: string) => boolean, timeoutMs = 20000): Promise<string> {
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

  private async sendCommand(command: string): Promise<{ tag: string; response: string; ok: boolean; statusLine?: string }> {
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

    const statusMatch = response.match(new RegExp(`(?:^|\\r\\n)${tag}\\s+(OK|NO|BAD)\\b.*`, "i"));
    const statusLine = statusMatch?.[0]?.trim();
    const ok = statusLine?.toUpperCase().includes(`${tag} OK`) ?? false;

    return { tag, response, ok, statusLine };
  }

  async connect(): Promise<void> {
    if (this.secure) {
      this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    } else {
      this.conn = await Deno.connect({ hostname: this.host, port: this.port });
    }

    // Greeting
    await this.readResponseUntil((acc) => acc.includes("\r\n") && acc.trimStart().startsWith("*"), 10000);
  }

  async login(user: string, pass: string): Promise<void> {
    const escapedPass = pass.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const res = await this.sendCommand(`LOGIN "${user}" "${escapedPass}"`);
    if (!res.ok) throw new Error(`IMAP login failed${res.statusLine ? ` (${res.statusLine})` : ""}`);
  }

  async select(mailbox: string): Promise<void> {
    const res = await this.sendCommand(`SELECT "${mailbox}"`);
    if (!res.ok) throw new Error(`IMAP SELECT failed${res.statusLine ? ` (${res.statusLine})` : ""}`);
  }

  async searchMessageId(messageIdHeader: string): Promise<number | null> {
    // messageIdHeader should include the angle brackets in the SEARCH string.
    const safe = messageIdHeader.replace(/"/g, "\\\"");
    const res = await this.sendCommand(`SEARCH HEADER Message-ID "${safe}"`);
    if (!res.ok) return null;
    const m = res.response.match(/\*\s+SEARCH\s+([0-9 ]+)\r?\n/i);
    const ids = (m?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
    if (ids.length === 0) return null;
    return parseInt(ids[0], 10);
  }

  async fetchFullRaw(seq: number): Promise<string> {
    // IMPORTANT: IMAP literals may be larger than a single read() chunk.
    // We must read until we see the literal size, then read EXACTLY that many bytes.
    const tag = this.nextTag();
    await this.conn!.write(this.encoder.encode(`${tag} FETCH ${seq} (BODY.PEEK[])\r\n`));

    const literalHeaderRe = /BODY(?:\.PEEK)?\[\]\s+\{(\d+)\}\r?\n/i;

    let acc = "";
    const started = Date.now();

    // 1) Read until we see the literal header
    while (Date.now() - started < 30000) {
      const chunk = await this.readWithTimeout(5000);
      if (chunk === null) break;
      acc += this.decoder.decode(chunk);
      if (literalHeaderRe.test(acc)) break;
    }

    const litMatch = acc.match(literalHeaderRe);
    if (!litMatch) throw new Error("Could not find BODY literal");

    const len = parseInt(litMatch[1], 10);
    const headerIdx = acc.search(literalHeaderRe);
    const headerMatchText = acc.match(literalHeaderRe)![0];
    const bodyStartIdx = headerIdx + headerMatchText.length;

    // Everything after bodyStartIdx may already contain part of the literal
    let bodyBuf = acc.substring(bodyStartIdx);

    // 2) Read until we have the full literal
    const bodyStartedAt = Date.now();
    while (bodyBuf.length < len && Date.now() - bodyStartedAt < 60000) {
      const chunk = await this.readWithTimeout(8000);
      if (chunk === null) break;
      bodyBuf += this.decoder.decode(chunk);
    }

    const raw = bodyBuf.substring(0, len);

    // 3) Drain remaining response until tagged OK/NO/BAD (keeps connection in sync)
    let tail = bodyBuf.substring(len);
    let full = acc.substring(0, bodyStartIdx) + raw + tail;

    const doneRe = new RegExp(`(?:^|\\r\\n)${tag}\\s+(OK|NO|BAD)\\b`, "i");
    const drainStartedAt = Date.now();
    while (!doneRe.test(full) && Date.now() - drainStartedAt < 30000) {
      const chunk = await this.readWithTimeout(5000);
      if (chunk === null) break;
      full += this.decoder.decode(chunk);
    }

    return raw;
  }


  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch {
      // ignore
    }
    try {
      this.conn?.close();
    } catch {
      // ignore
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid user token");

    const {
      imapHost,
      imapPort,
      imapSecure,
      email,
      emailPassword,
      folder = "INBOX",
      messageId,
    }: FetchEmailBodyRequest = await req.json();

    const client = new IMAPClient(imapHost, imapPort, imapSecure);
    await client.connect();
    await client.login(email, emailPassword);
    await client.select(folder);

    // Determine seq
    let seq: number | null = null;

    // 1) Most of our stored message_id values are NOT real RFC Message-ID headers.
    // They often follow patterns like:
    // - "email@domain.com|INBOX|438"   (explicit seq)
    // - "email@domain.com-438-<timestamp>" (implicit seq)
    // So we first try to extract a seq number directly.

    // Pattern: "...-<seq>-<timestamp>" (very common in our sync)
    const dashSeqMatch = messageId.match(/-(\d+)-(\d+)$/);
    if (dashSeqMatch) {
      const maybeSeq = parseInt(dashSeqMatch[1], 10);
      if (!Number.isNaN(maybeSeq) && maybeSeq > 0) seq = maybeSeq;
    }

    // 2) Fallback: "${email}|${folder}|${seq}"
    if (!seq) {
      const parts = messageId.split("|");
      const last = parts[parts.length - 1];
      if (parts.length >= 3 && /^\d+$/.test(last)) {
        seq = parseInt(last, 10);
      } else {
        // 3) Last resort: try searching by real Message-ID header.
        // Some providers store header values like: "<abc@host>".
        const headerValue = parts.length >= 2 ? parts[1] : messageId;
        const normalized = headerValue.replace(/[<>]/g, "").trim();

        seq = await client.searchMessageId(`<${normalized}>`);
        if (!seq) seq = await client.searchMessageId(normalized);
      }
    }

    if (!seq) {
      await client.logout();
      return new Response(JSON.stringify({ success: false, error: "Email not found on server" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await client.fetchFullRaw(seq);
    const { text, html, hasAttachments } = extractBodyFromMime(raw);

    await client.logout();

    // Update DB
    const { error: updateError } = await supabase
      .from("emails")
      .update({
        body_text: text || null,
        body_html: html || null,
        has_attachments: hasAttachments,
      })
      .eq("user_id", user.id)
      .eq("message_id", messageId);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    return new Response(JSON.stringify({ success: true, seq, hasAttachments, hasBody: !!(text || html) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching email body:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
