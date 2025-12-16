import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchEmailsRequest {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  email: string;
  emailPassword: string;
  folder?: string;
  limit?: number;
  offset?: number; // how many latest messages to skip (pagination)
}

// Decode MIME encoded words (=?charset?encoding?text?=)
function decodeMimeWord(text: string): string {
  if (!text) return text;
  
  // Handle multiple consecutive encoded words
  let result = text;
  
  // Pattern for encoded words: =?charset?encoding?encoded_text?=
  const mimePattern = /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi;
  
  result = result.replace(mimePattern, (match, charset, encoding, encodedText) => {
    try {
      let decoded = '';
      
      if (encoding.toUpperCase() === 'Q') {
        // Quoted-Printable decoding
        decoded = encodedText
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => 
            String.fromCharCode(parseInt(hex, 16))
          );
      } else if (encoding.toUpperCase() === 'B') {
        // Base64 decoding
        decoded = atob(encodedText);
      } else {
        return match;
      }
      
      // Convert bytes to proper charset
      const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
      const charsetLower = charset.toLowerCase().replace('utf-8', 'utf-8').replace('iso-8859-1', 'iso-8859-1');
      return new TextDecoder(charsetLower).decode(bytes);
    } catch (e) {
      console.error('MIME decode error:', e, 'for text:', match);
      return match;
    }
  });
  
  // Remove whitespace between consecutive encoded words
  result = result.replace(/\?=\s+=\?/g, '?==?');
  
  return result;
}

// Decode quoted-printable content to UTF-8
function decodeQuotedPrintable(text: string): string {
  if (!text) return text;
  // First replace soft line breaks, then decode hex sequences
  const raw = text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
  // Convert bytes to UTF-8
  try {
    const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return raw;
  }
}

// Decode base64 content
function decodeBase64(text: string): string {
  if (!text) return text;
  const cleaned = text.replace(/\s/g, "");

  // Quick validation to avoid expensive errors/log spam.
  // Base64 should only contain A-Z a-z 0-9 + / =
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned) || cleaned.length % 4 !== 0) {
    return text;
  }

  try {
    const decoded = atob(cleaned);
    const bytes = new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
}

// Parse MIME multipart message and extract text content (handles nested multipart)
function extractBodyFromMime(rawBody: string): { text: string; html: string } {
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
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Split on boundary lines. This is intentionally permissive about whitespace/newlines.
    const re = new RegExp(`\\r?\\n--${esc}(?:--)?\\s*\\r?\\n`, "g");
    const parts = ("\r\n" + body).split(re);
    return parts.map((p) => p.trim()).filter(Boolean);
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
        }

        if (textContent && htmlContent) break;
      }

      return { text: textContent, html: htmlContent };
    }

    // Not multipart
    const decoded = decodeBodyByEncoding(headers, body);
    if (contentType.includes("text/html")) return { text: "", html: decoded };
    return { text: decoded, html: "" };
  };

  let { text: textContent, html: htmlContent } = parseMimeRecursive(rawBody);

  // Strip HTML tags for text version if we only have HTML
  if (!textContent && htmlContent) {
    textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { text: textContent, html: htmlContent };
}

// Improved IMAP client implementation for Deno
class IMAPClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private tagCounter = 0;
  private encoder = new TextEncoder();
  // IMPORTANT: decode raw IMAP stream as latin1 so string indexes match byte counts for literals
  private decoder = new TextDecoder("latin1");

  constructor(
    private host: string,
    private port: number,
    private secure: boolean
  ) {}

  async connect(): Promise<void> {
    console.log(`Connecting to ${this.host}:${this.port} (secure: ${this.secure})`);

    if (this.secure) {
      this.conn = await Deno.connectTls({
        hostname: this.host,
        port: this.port,
      });
    } else {
      this.conn = await Deno.connect({
        hostname: this.host,
        port: this.port,
      });
    }

    const greeting = await this.readGreeting();
    console.log("Server greeting:", greeting.substring(0, 200));
  }

  private async readWithTimeout(timeoutMs = 15000): Promise<Uint8Array | null> {
    const buffer = new Uint8Array(16384);

    const readPromise = this.conn!.read(buffer);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

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

  private nextTag(): string {
    return `A${++this.tagCounter}`;
  }

  private async readGreeting(): Promise<string> {
    // IMAP greeting is typically a single untagged line: "* OK ..."
    const greeting = await this.readResponseUntil(
      (acc) => acc.includes("\r\n") && acc.trimStart().startsWith("*"),
      10000
    );
    return greeting;
  }

  private async sendCommandRaw(tag: string, command: string): Promise<string> {
    const fullCommand = `${tag} ${command}\r\n`;
    console.log(`Sending: ${tag} ${command.substring(0, 80)}...`);
    await this.conn!.write(this.encoder.encode(fullCommand));

    const response = await this.readResponseUntil(
      (acc) => acc.includes(`\r\n${tag} OK`) || acc.includes(`\r\n${tag} NO`) || acc.includes(`\r\n${tag} BAD`) || acc.startsWith(`${tag} OK`) || acc.startsWith(`${tag} NO`) || acc.startsWith(`${tag} BAD`),
      30000
    );

    console.log(`Response (${response.length} bytes): ${response.substring(0, 300)}...`);
    return response;
  }

  private async sendCommand(command: string): Promise<{ tag: string; response: string; ok: boolean; statusLine?: string }> {
    const tag = this.nextTag();
    const response = await this.sendCommandRaw(tag, command);

    const statusMatch = response.match(new RegExp(`(?:^|\\r\\n)${tag}\\s+(OK|NO|BAD)\\b.*`, "i"));
    const statusLine = statusMatch?.[0]?.trim();
    const ok = statusLine?.toUpperCase().includes(`${tag} OK`) ?? false;

    return { tag, response, ok, statusLine };
  }

  async login(user: string, pass: string): Promise<{ ok: boolean; statusLine?: string }> {
    const escapedPass = pass.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const res = await this.sendCommand(`LOGIN "${user}" "${escapedPass}"`);
    return { ok: res.ok, statusLine: res.statusLine };
  }

  async select(mailbox: string): Promise<{ exists: number; recent: number }> {
    const res = await this.sendCommand(`SELECT "${mailbox}"`);
    const response = res.response;

    let exists = 0;
    let recent = 0;

    // Parse EXISTS count
    const existsMatch = response.match(/\*\s+(\d+)\s+EXISTS/i);
    if (existsMatch) {
      exists = parseInt(existsMatch[1]);
    }

    // Parse RECENT count
    const recentMatch = response.match(/\*\s+(\d+)\s+RECENT/i);
    if (recentMatch) {
      recent = parseInt(recentMatch[1]);
    }

    console.log(`Mailbox ${mailbox}: EXISTS=${exists}, RECENT=${recent}`);
    return { exists, recent };
  }

  async fetchEmails(start: number, end: number): Promise<any[]> {
    const emails: any[] = [];

    // Fetch envelope, headers, and *partial* body for emails (faster + avoids runtime limits)
    const res = await this.sendCommand(
      `FETCH ${start}:${end} (FLAGS ENVELOPE RFC822.SIZE BODY.PEEK[]<0.65536>)`
    );
    const response = res.response;

    console.log(`Fetch response length: ${response.length}`);

    const hasAttachmentsFromRaw = (raw: string): boolean => {
      // Covers regular attachments + inline images (common for Outlook/marketing emails)
      if (/Content-Disposition:\s*attachment/i.test(raw)) return true;
      if (/\bfilename\*?=|\bname\*?=/i.test(raw)) return true;
      if (/Content-Type:\s*image\//i.test(raw) && /Content-ID:\s*<[^>]+>/i.test(raw)) return true;
      return false;
    };

    // Find each "* <seq> FETCH (" block start
    const emailPattern = /\*\s+(\d+)\s+FETCH\s+\(/g;
    const matches: { seq: number; startIdx: number }[] = [];
    let m: RegExpExecArray | null;

    while ((m = emailPattern.exec(response)) !== null) {
      matches.push({ seq: parseInt(m[1]), startIdx: m.index });
    }

    for (let i = 0; i < matches.length; i++) {
      const segStart = matches[i].startIdx;
      const segEnd = i < matches.length - 1 ? matches[i + 1].startIdx : response.length;
      const segment = response.substring(segStart, segEnd);

      const email: any = { seq: matches[i].seq };

      // Parse FLAGS
      const flagsMatch = segment.match(/FLAGS\s+\(([^)]*)\)/i);
      if (flagsMatch) {
        email.flags = flagsMatch[1].split(/\s+/).filter((f) => f);
        email.is_read = email.flags.includes('\\Seen');
        email.is_starred = email.flags.includes('\\Flagged');
      }

      // Parse RFC822.SIZE
      const sizeMatch = segment.match(/RFC822\.SIZE\s+(\d+)/i);
      if (sizeMatch) {
        email.size = parseInt(sizeMatch[1]);
      }

      // Parse BODY[] literal size (supports partial fetch like BODY[]<0.65536>)
      const bodyLiteralMatch = segment.match(/BODY(?:\.PEEK)?\[\](?:<[^>]+>)?\s+\{(\d+)\}\r?\n/i);
      if (bodyLiteralMatch) {
        const bodyLength = parseInt(bodyLiteralMatch[1]);
        const bodyHeaderIdxInSeg = segment.search(/BODY(?:\.PEEK)?\[\](?:<[^>]+>)?\s+\{\d+\}\r?\n/i);
        const bodyContentAbsStart = segStart + bodyHeaderIdxInSeg + bodyLiteralMatch[0].length;
        const rawMessage = response.substring(bodyContentAbsStart, bodyContentAbsStart + bodyLength);

        // Parse headers from raw message
        const headerEndIdx = rawMessage.search(/\r?\n\r?\n/);
        const headers = headerEndIdx !== -1 ? rawMessage.substring(0, headerEndIdx) : rawMessage;

        const getHeader = (name: string): string | null => {
          const r = new RegExp(`^${name}:\\s*(.+?)(?:\\r?\\n(?!\\s)|$)`, 'im');
          const hm = headers.match(r);
          return hm ? hm[1].replace(/\r?\n\s*/g, ' ').trim() : null;
        };

        const subjectRaw = getHeader('Subject');
        if (subjectRaw) email.subject = subjectRaw;

        const fromRaw = getHeader('From');
        if (fromRaw) {
          const nameEmailMatch = fromRaw.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
          if (nameEmailMatch) {
            email.from_name = nameEmailMatch[1].trim();
            email.from_address = nameEmailMatch[2].trim();
          } else {
            email.from_address = fromRaw.replace(/[<>]/g, '').trim();
            email.from_name = '';
          }
        }

        const dateRaw = getHeader('Date');
        if (dateRaw) email.date = dateRaw;

        const msgIdRaw = getHeader('Message-ID') || getHeader('Message-Id');
        if (msgIdRaw) {
          email.message_id_header = msgIdRaw.replace(/[<>\s]/g, '');
        }

        const { text, html } = extractBodyFromMime(rawMessage);
        email.body_text = text;
        email.body_html = html;
        email.has_attachments = hasAttachmentsFromRaw(rawMessage);
      }

      // Fallback: Parse ENVELOPE if header parsing failed
      if (!email.subject || !email.from_address) {
        const envelopeMatch = segment.match(/ENVELOPE\s+\((.+)\)/i);
        if (envelopeMatch) {
          const envData = envelopeMatch[1];

          if (!email.date) {
            const dateMatch = envData.match(/^"([^"]+)"/);
            if (dateMatch) email.date = dateMatch[1];
          }

          if (!email.subject) {
            const subjectMatch = envData.match(/^"[^"]*"\s+"([^"]*)"/);
            if (subjectMatch) email.subject = subjectMatch[1];
            else if (envData.match(/^"[^"]*"\s+NIL/)) email.subject = '(No Subject)';
          }

          if (!email.from_address) {
            const fromMatch = envData.match(/\(\(\"?([^\"]*)\"?\s+NIL\s+\"([^\"]+)\"\s+\"([^\"]+)\"\)\)/);
            if (fromMatch) {
              email.from_name = fromMatch[1] || '';
              email.from_address = `${fromMatch[2]}@${fromMatch[3]}`;
            }
          }
        }
      }

      if (email.from_address || email.subject) {
        emails.push(email);
      }
    }

    // If pattern matching failed, try simpler approach
    if (emails.length === 0) {
      console.log('Pattern matching failed, trying line-by-line parsing');
      const lines = response.split('\r\n');
      for (const line of lines) {
        if (line.includes('* ') && line.includes('FETCH')) {
          const seqMatch = line.match(/\*\s+(\d+)/);
          if (seqMatch) {
            emails.push({
              seq: parseInt(seqMatch[1]),
              subject: `Email #${seqMatch[1]}`,
              from_address: 'unknown',
              from_name: '',
              is_read: line.includes('\\Seen'),
              is_starred: line.includes('\\Flagged'),
              date: new Date().toISOString(),
              body_text: '',
              body_html: '',
              has_attachments: false,
            });
          }
        }
      }
    }

    return emails;
  }

  async listMailboxes(): Promise<string[]> {
    const res = await this.sendCommand('LIST "" "*"');
    const response = res.response;
    const mailboxes: string[] = [];

    const lines = response.split("\r\n");
    for (const line of lines) {
      const match = line.match(/\*\s+LIST\s+\([^)]*\)\s+"[^"]*"\s+"?([^"\r\n]+)"?/i);
      if (match) {
        mailboxes.push(match[1]);
      }
    }

    console.log("Available mailboxes:", mailboxes);
    return mailboxes;
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch (e) {
      console.log("Logout error (ignored):", e);
    }
    try {
      this.conn?.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const {
      imapHost,
      imapPort,
      imapSecure,
      email,
      emailPassword,
      folder = 'INBOX',
      limit = 50,
      offset = 0,
    }: FetchEmailsRequest = await req.json();

    console.log(`Fetching emails for ${email} from ${imapHost}:${imapPort}`);

    const client = new IMAPClient(imapHost, imapPort, imapSecure);
    
    await client.connect();
    console.log('Connected to IMAP server');

    const loginResult = await client.login(email, emailPassword);
    if (!loginResult.ok) {
      const details = loginResult.statusLine ? ` (${loginResult.statusLine})` : "";
      throw new Error(`IMAP login failed${details}`);
    }
    console.log('Login successful');

    // List available mailboxes for debugging
    const mailboxes = await client.listMailboxes();
    
    // Try to find the right inbox folder
    let targetFolder = folder;
    const inboxVariants = ['INBOX', 'Inbox', 'inbox', 'INBOX.Inbox'];
    
    if (folder.toUpperCase() === 'INBOX') {
      for (const variant of inboxVariants) {
        if (mailboxes.some(m => m.toLowerCase() === variant.toLowerCase())) {
          targetFolder = mailboxes.find(m => m.toLowerCase() === variant.toLowerCase()) || variant;
          break;
        }
      }
    }
    
    console.log(`Using mailbox: ${targetFolder}`);
    
    const mailbox = await client.select(targetFolder);
    console.log(`Mailbox opened: ${mailbox.exists} messages`);

    const emails: any[] = [];

    if (mailbox.exists > 0) {
      const endSeq = mailbox.exists - Math.max(0, offset);
      if (endSeq >= 1) {
        const startSeq = Math.max(1, endSeq - limit + 1);
        const fetchedEmails = await client.fetchEmails(startSeq, endSeq);

        for (const fetchedEmail of fetchedEmails) {
          // Decode MIME encoded subject and from_name
          const decodedSubject = decodeMimeWord(fetchedEmail.subject || "");
          const decodedFromName = decodeMimeWord(fetchedEmail.from_name || "");

          // Body is already decoded by extractBodyFromMime
          const bodyText = fetchedEmail.body_text || "";
          const bodyHtml = fetchedEmail.body_html || "";

          // Parse date safely
          let emailDate = new Date().toISOString();
          try {
            if (fetchedEmail.date) {
              const parsed = new Date(fetchedEmail.date);
              if (!isNaN(parsed.getTime())) {
                emailDate = parsed.toISOString();
              }
            }
          } catch (e) {
            console.log("Date parse error:", e);
          }

          const storedFolder =
            folder.toUpperCase() === "INBOX"
              ? "INBOX"
              : folder.toLowerCase().includes("sent")
                ? "Sent"
                : targetFolder;

          const stableMessageId = fetchedEmail.message_id_header
            ? `${email}|${fetchedEmail.message_id_header}`
            : `${email}|${storedFolder}|${fetchedEmail.seq}`;

          const emailData = {
            message_id: stableMessageId,
            subject: decodedSubject || "(No Subject)",
            from_address: fetchedEmail.from_address || "unknown@email.com",
            from_name: decodedFromName,
            to_addresses: [{ address: email }],
            email_date: emailDate,
            body_text: bodyText,
            body_html: bodyHtml,
            is_read: fetchedEmail.is_read || false,
            is_starred: fetchedEmail.is_starred || false,
            has_attachments: fetchedEmail.has_attachments || false,
            folder: storedFolder,
          };

          emails.push(emailData);
        }
      }
    }
    console.log(`Fetched ${emails.length} emails from ${mailbox.exists} total`);

    // Save emails to database (update if exists)
    let savedCount = 0;
    for (const emailData of emails) {
      // 1) Try by message_id
      const { data: existingById } = await supabase
        .from("emails")
        .select("id")
        .eq("message_id", emailData.message_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingById?.id) {
        const { error: updateError } = await supabase
          .from("emails")
          .update({
            subject: emailData.subject,
            from_address: emailData.from_address,
            from_name: emailData.from_name,
            to_addresses: emailData.to_addresses,
            email_date: emailData.email_date,
            body_text: emailData.body_text,
            body_html: emailData.body_html,
            is_read: emailData.is_read,
            is_starred: emailData.is_starred,
            has_attachments: emailData.has_attachments,
            folder: emailData.folder,
          })
          .eq("id", existingById.id);

        if (updateError) console.error("Error updating email:", updateError);
        continue;
      }

      // 2) Fallback match: same sender+date+subject in same folder (helps older rows that had random message_id)
      const { data: existingFallback } = await supabase
        .from("emails")
        .select("id, body_text, body_html")
        .eq("user_id", user.id)
        .eq("folder", emailData.folder)
        .eq("from_address", emailData.from_address)
        .eq("email_date", emailData.email_date)
        .eq("subject", emailData.subject)
        .maybeSingle();

      if (existingFallback?.id) {
        // Only patch if content is missing
        if (!existingFallback.body_text && !existingFallback.body_html) {
          const { error: patchError } = await supabase
            .from("emails")
            .update({
              body_text: emailData.body_text,
              body_html: emailData.body_html,
              has_attachments: emailData.has_attachments,
            })
            .eq("id", existingFallback.id);
          if (patchError) console.error("Error patching email body:", patchError);
        }
        continue;
      }

      // 3) Insert new
      const { error: saveError } = await supabase.from("emails").insert({
        ...emailData,
        user_id: user.id,
      });

      if (saveError) {
        console.error("Error saving email:", saveError);
      } else {
        savedCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fetched: emails.length,
        saved: savedCount,
        total: mailbox.exists,
        mailboxes: mailboxes
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error fetching emails:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
