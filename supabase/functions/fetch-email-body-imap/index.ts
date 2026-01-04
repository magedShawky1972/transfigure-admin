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
  // First replace soft line breaks, then decode hex sequences
  const raw = text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Convert bytes to UTF-8
  try {
    const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return raw;
  }
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

  const splitHeadersAndBody = (part: string): { headers: string; body: string } => {
    const idx = part.search(/\r?\n\r?\n/);
    if (idx === -1) return { headers: part, body: "" };
    const headers = part.slice(0, idx);
    const body = part.slice(idx).replace(/^\r?\n\r?\n/, "");
    return { headers, body };
  };

  const headerValue = (headers: string, name: string): string | null => {
    // Match only real header lines (start-of-line), with simple folded header support.
    const re = new RegExp(`(?:^|\\r?\\n)${name}:\\s*([^\\r\\n]+(?:\\r?\\n[\\t ].+)*)`, "i");
    const m = headers.match(re);
    if (!m) return null;
    return m[1].replace(/\r?\n[\t ]+/g, " ").trim();
  };

  const decodeBodyByEncoding = (headers: string, body: string): string => {
    const enc = (headerValue(headers, "Content-Transfer-Encoding") || "").toLowerCase();
    if (enc === "base64") return decodeBase64(body.trim()).trim();
    if (enc === "quoted-printable") return decodeQuotedPrintable(body).trim();
    return body.trim();
  };

  const splitMultipartBody = (body: string, boundary: string): string[] => {
    // MIME delimiter line is: "--" + boundary
    // Boundary closing line may end without a trailing newline, so we must support (\n|$)
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Match boundary delimiter lines at start-of-string or after a newline.
    // Examples:
    //   --BOUNDARY\r\n
    //   --BOUNDARY--\r\n
    //   --BOUNDARY-- (end of body)
    const re = new RegExp(`(?:^|\\r?\\n)--${esc}(?:--)?[\\t ]*(?:\\r?\\n|$)`, "g");

    // Ensure the first boundary at the start is matchable by prefixing a newline.
    const normalized = body.startsWith("--") ? body : "\n" + body;
    const parts = normalized.split(re);

    return parts.map((p) => p.trim()).filter(Boolean);
  };

  // Check if content looks like raw MIME that wasn't properly parsed
  const looksLikeRawMime = (content: string): boolean => {
    if (!content) return false;
    // Check for common MIME artifacts
    const mimePatterns = [
      /^--_\d{3}_/m, // Boundary patterns
      /^Content-Type:\s/im,
      /^Content-Transfer-Encoding:\s/im,
      /^[A-Za-z0-9+/=]{50,}$/m, // Long base64 lines
    ];
    return mimePatterns.some(p => p.test(content.substring(0, 500)));
  };

  // Clean raw MIME content as fallback
  const cleanRawMimeContent = (content: string): string => {
    // Remove MIME boundaries and headers
    let cleaned = content
      // Remove boundary lines
      .replace(/^--[\w\-._]+(?:--)?[\t ]*$/gm, "")
      // Remove Content-Type headers
      .replace(/^Content-Type:[^\r\n]*(?:\r?\n[\t ][^\r\n]*)*/gim, "")
      // Remove Content-Transfer-Encoding headers
      .replace(/^Content-Transfer-Encoding:[^\r\n]*/gim, "")
      // Remove Content-Disposition headers
      .replace(/^Content-Disposition:[^\r\n]*/gim, "")
      // Remove MIME-Version headers
      .replace(/^MIME-Version:[^\r\n]*/gim, "")
      // Remove Content-ID headers
      .replace(/^Content-ID:[^\r\n]*/gim, "")
      // Remove empty lines at start
      .replace(/^[\r\n]+/, "")
      // Collapse multiple newlines
      .replace(/(\r?\n){3,}/g, "\n\n")
      .trim();

    // If still looks like base64 garbage, try to decode it
    if (/^[A-Za-z0-9+/=\s]{100,}$/.test(cleaned)) {
      const decoded = decodeBase64(cleaned);
      if (decoded && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)) {
        cleaned = decoded;
      }
    }

    return cleaned;
  };

  const parseMimeRecursive = (part: string): { text: string; html: string } => {
    const { headers, body } = splitHeadersAndBody(part);

    const contentTypeFull = (headerValue(headers, "Content-Type") || "").toLowerCase();
    const contentType = contentTypeFull.split(";")[0].trim();
    const boundary = (() => {
      const m = contentTypeFull.match(/boundary\s*=\s*"?([^";\r\n]+)"?/i);
      return m?.[1] ?? null;
    })();

    // Multipart: split and recurse
    if (contentType.startsWith("multipart/") && boundary) {
      let textContent = "";
      let htmlContent = "";

      const parts = splitMultipartBody(body, boundary);
      for (const p of parts) {
        const pTrim = p.trim();
        if (!pTrim || pTrim === "--") continue;

        const { headers: ph, body: pb } = splitHeadersAndBody(pTrim);
        const pTypeFull = (headerValue(ph, "Content-Type") || "").toLowerCase();
        const pType = pTypeFull.split(";")[0].trim();

        if (pType.startsWith("multipart/")) {
          const nested = parseMimeRecursive(pTrim);
          if (!textContent && nested.text) textContent = nested.text;
          if (!htmlContent && nested.html) htmlContent = nested.html;
        } else if (pType.includes("text/plain")) {
          if (!textContent) textContent = decodeBodyByEncoding(ph, pb);
        } else if (pType.includes("text/html")) {
          if (!htmlContent) htmlContent = decodeBodyByEncoding(ph, pb);
        } else if (pType.includes("text/calendar")) {
          // Handle calendar invitations - extract summary if possible
          const decoded = decodeBodyByEncoding(ph, pb);
          if (!textContent) {
            // Extract SUMMARY from iCalendar format
            const summaryMatch = decoded.match(/SUMMARY[;:]([^\r\n]+)/i);
            const descMatch = decoded.match(/DESCRIPTION[;:]([^\r\n]+)/i);
            const locationMatch = decoded.match(/LOCATION[;:]([^\r\n]+)/i);
            const startMatch = decoded.match(/DTSTART[;:]([^\r\n]+)/i);
            
            let calendarText = "[Calendar Invitation]\n";
            if (summaryMatch) calendarText += `Event: ${summaryMatch[1]}\n`;
            if (startMatch) calendarText += `When: ${startMatch[1]}\n`;
            if (locationMatch) calendarText += `Location: ${locationMatch[1]}\n`;
            if (descMatch) calendarText += `Description: ${descMatch[1]}\n`;
            
            textContent = calendarText.trim();
          }
        }

        if (textContent && htmlContent) break;
      }

      return { text: textContent, html: htmlContent };
    }

    // Not multipart
    const decoded = decodeBodyByEncoding(headers, body);
    if (contentType.includes("text/html")) return { text: "", html: decoded };
    if (contentType.includes("text/calendar")) {
      // Handle standalone calendar
      const summaryMatch = decoded.match(/SUMMARY[;:]([^\r\n]+)/i);
      return { text: summaryMatch ? `[Calendar: ${summaryMatch[1]}]` : decoded, html: "" };
    }
    return { text: decoded, html: "" };
  };

  let { text: textContent, html: htmlContent } = parseMimeRecursive(rawBody);

  // Post-process: if text still looks like raw MIME, clean it up
  if (textContent && looksLikeRawMime(textContent)) {
    textContent = cleanRawMimeContent(textContent);
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

  // Final cleanup: if still looks corrupted, try to salvage
  if (textContent && looksLikeRawMime(textContent)) {
    textContent = cleanRawMimeContent(textContent);
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

    // Determine seq
    let seq: number | null = null;
    const parts = messageId.split("|");

    console.log("Looking for email with messageId:", messageId, "in folder:", folder);
    console.log("Parts:", parts);

    const findByMessageIdAcrossFolders = async (
      headerValue: string,
      preferredFolder: string
    ): Promise<{ seq: number | null; usedFolder: string }> => {
        const normalized = headerValue.replace(/[<>]/g, "").trim();
        const foldersToTry = Array.from(
          new Set([
            preferredFolder,
            "INBOX",
            "INBOX.Junk",
            "INBOX.Trash",
            "INBOX.Sent",
            "INBOX.Drafts",
          ].filter(Boolean))
        );

        for (const f of foldersToTry) {
          try {
            await client.select(f);
            console.log("Searching in folder:", f);

            console.log("Trying search with angle brackets:", `<${normalized}>`);
            let found = await client.searchMessageId(`<${normalized}>`);

            if (!found) {
              console.log("Trying search without angle brackets:", normalized);
              found = await client.searchMessageId(normalized);
            }

            if (!found && !headerValue.startsWith("<")) {
              console.log("Trying search with original value:", headerValue);
              found = await client.searchMessageId(headerValue);
            }

            console.log("Search result seq:", found);
            if (found) return { seq: found, usedFolder: f };
          } catch (err) {
            console.log("Search in folder failed:", f, String(err));
            // keep trying
          }
        }

        return { seq: null, usedFolder: preferredFolder };
      };

    // Our stored message_id format is:
    // - "${email}|${message_id_header}" (if message_id header exists)
    // - "${email}|${folder}|${seq}" (fallback)

    // 1) Try "${email}|${folder}|${seq}" pattern first
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        seq = parseInt(last, 10);
        console.log("Found seq from folder|seq pattern:", seq);
      }
    }

    // 2) If not found, try searching by Message-ID header (and fall back across folders)
    // Format: "${email}|${message_id_header}"
    let usedFolder = folder;
    if (!seq && parts.length >= 2) {
      const headerValue = parts.slice(1).join("|");
      console.log("Searching by Message-ID header:", headerValue);

      const res = await findByMessageIdAcrossFolders(headerValue, folder);
      seq = res.seq;
      usedFolder = res.usedFolder;
    }

    // 3) Legacy fallback: "...-<seq>-<timestamp>" pattern
    if (!seq) {
      const dashSeqMatch = messageId.match(/-(\d+)-(\d+)$/);
      if (dashSeqMatch) {
        const maybeSeq = parseInt(dashSeqMatch[1], 10);
        if (!Number.isNaN(maybeSeq) && maybeSeq > 0) {
          seq = maybeSeq;
          console.log("Found seq from legacy pattern:", seq);
        }
      }
    }

    if (!seq) {
      console.log("Email not found, message_id:", messageId);
      await client.logout();
      return new Response(JSON.stringify({ success: false, error: "Email not found on server" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Found email at seq:", seq, "folder:", usedFolder);

     const raw = await client.fetchFullRaw(seq);
     const { text, html, hasAttachments } = extractBodyFromMime(raw);

     // Basic diagnostics (trimmed) to help debug "hasBody=false"
      const headerEndIdx = raw.search(/\r?\n\r?\n/);
      const headerPreview = raw.substring(0, Math.min(raw.length, headerEndIdx === -1 ? 800 : Math.min(800, headerEndIdx)));
      const headersOnly = headerEndIdx === -1 ? raw : raw.slice(0, headerEndIdx);
      const contentTypeTop = headersOnly.match(/(?:^|\r?\n)Content-Type:\s*([^;\r\n]+)/i)?.[1] ?? null;
      const transferEncTop = headersOnly.match(/(?:^|\r?\n)Content-Transfer-Encoding:\s*(\S+)/i)?.[1] ?? null;
      const boundaryTop = headersOnly.match(/boundary="?([^"\r\n;]+)"?/i)?.[1] ?? null;

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

     return new Response(
       JSON.stringify({
         success: true,
         seq,
         hasAttachments,
         hasBody: !!(text || html),
         diagnostics: {
           raw_len: raw.length,
           header_end_idx: headerEndIdx,
           content_type: contentTypeTop,
           transfer_encoding: transferEncTop,
           boundary: boundaryTop,
           header_preview: headerPreview,
           text_len: text?.length ?? 0,
           html_len: html?.length ?? 0,
         },
       }),
       {
         status: 200,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
  } catch (error: any) {
    console.error("Error fetching email body:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
