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

// Decode quoted-printable content
function decodeQuotedPrintable(text: string): string {
  if (!text) return text;
  return text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
}

// Decode base64 content
function decodeBase64(text: string): string {
  if (!text) return text;
  try {
    const cleaned = text.replace(/\s/g, '');
    const decoded = atob(cleaned);
    // Try to decode as UTF-8
    const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Base64 decode error:', e);
    return text;
  }
}

// Parse MIME multipart message and extract text content
function extractBodyFromMime(rawBody: string): { text: string; html: string } {
  let textContent = '';
  let htmlContent = '';
  
  // Check for Content-Transfer-Encoding in the body
  const transferEncodingMatch = rawBody.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const contentTypeMatch = rawBody.match(/Content-Type:\s*([^;\r\n]+)/i);
  
  // Check if this is a multipart message
  const boundaryMatch = rawBody.match(/boundary="?([^"\r\n;]+)"?/i);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawBody.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
    
    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      
      const partContentType = part.match(/Content-Type:\s*([^;\r\n]+)/i);
      const partEncoding = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      
      // Find the actual content (after headers, separated by double newline)
      const contentStart = part.search(/\r?\n\r?\n/);
      if (contentStart === -1) continue;
      
      let content = part.substring(contentStart).trim();
      
      // Decode based on transfer encoding
      if (partEncoding) {
        const encoding = partEncoding[1].toLowerCase();
        if (encoding === 'base64') {
          content = decodeBase64(content);
        } else if (encoding === 'quoted-printable') {
          content = decodeQuotedPrintable(content);
        }
      }
      
      if (partContentType) {
        const type = partContentType[1].toLowerCase();
        if (type.includes('text/plain') && !textContent) {
          textContent = content;
        } else if (type.includes('text/html') && !htmlContent) {
          htmlContent = content;
        }
      }
    }
  } else {
    // Not multipart - check for encoding and decode
    let content = rawBody;
    
    // Find content after headers
    const contentStart = rawBody.search(/\r?\n\r?\n/);
    if (contentStart !== -1) {
      content = rawBody.substring(contentStart).trim();
    }
    
    if (transferEncodingMatch) {
      const encoding = transferEncodingMatch[1].toLowerCase();
      if (encoding === 'base64') {
        content = decodeBase64(content);
      } else if (encoding === 'quoted-printable') {
        content = decodeQuotedPrintable(content);
      }
    }
    
    if (contentTypeMatch && contentTypeMatch[1].toLowerCase().includes('text/html')) {
      htmlContent = content;
    } else {
      textContent = content;
    }
  }
  
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
  private decoder = new TextDecoder();

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

    // Fetch envelope, headers, and full body for emails
    const res = await this.sendCommand(
      `FETCH ${start}:${end} (FLAGS ENVELOPE RFC822.SIZE BODY.PEEK[])`
    );
    const response = res.response;

    console.log(`Fetch response length: ${response.length}`);

    // Split response by email boundaries - improved pattern
    const emailPattern = /\*\s+(\d+)\s+FETCH\s+\(/g;
    const matches: { seq: number; startIdx: number }[] = [];
    let match;
    
    while ((match = emailPattern.exec(response)) !== null) {
      matches.push({ seq: parseInt(match[1]), startIdx: match.index + match[0].length });
    }
    
    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].startIdx;
      const endIdx = i < matches.length - 1 ? matches[i + 1].startIdx - 50 : response.length;
      const data = response.substring(startIdx, endIdx);
      
      const email: any = { seq: matches[i].seq };

      // Parse FLAGS
      const flagsMatch = data.match(/FLAGS\s+\(([^)]*)\)/i);
      if (flagsMatch) {
        email.flags = flagsMatch[1].split(/\s+/).filter((f) => f);
        email.is_read = email.flags.includes('\\Seen');
        email.is_starred = email.flags.includes('\\Flagged');
      }

      // Parse BODY[] - the full message
      const bodyStartMatch = data.match(/BODY\[\]\s+\{(\d+)\}/i);
      if (bodyStartMatch) {
        const bodyLength = parseInt(bodyStartMatch[1]);
        const bodyStartIdx = data.indexOf(bodyStartMatch[0]) + bodyStartMatch[0].length;
        // Skip the \r\n after the length indicator
        const actualStart = data.indexOf('\n', bodyStartIdx) + 1;
        const rawMessage = data.substring(actualStart, actualStart + bodyLength);
        
        // Parse headers from raw message
        const headerEndIdx = rawMessage.search(/\r?\n\r?\n/);
        const headers = headerEndIdx !== -1 ? rawMessage.substring(0, headerEndIdx) : rawMessage;
        const bodyPart = headerEndIdx !== -1 ? rawMessage.substring(headerEndIdx) : '';
        
        // Extract Subject
        const subjectMatch = headers.match(/^Subject:\s*(.+?)(?:\r?\n(?!\s)|$)/im);
        if (subjectMatch) {
          email.subject = subjectMatch[1].replace(/\r?\n\s*/g, ' ').trim();
        }
        
        // Extract From
        const fromMatch = headers.match(/^From:\s*(.+?)(?:\r?\n(?!\s)|$)/im);
        if (fromMatch) {
          const fromRaw = fromMatch[1].replace(/\r?\n\s*/g, ' ').trim();
          const nameEmailMatch = fromRaw.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
          if (nameEmailMatch) {
            email.from_name = nameEmailMatch[1].trim();
            email.from_address = nameEmailMatch[2].trim();
          } else {
            email.from_address = fromRaw.replace(/[<>]/g, '').trim();
            email.from_name = '';
          }
        }
        
        // Extract Date
        const dateMatch = headers.match(/^Date:\s*(.+?)(?:\r?\n(?!\s)|$)/im);
        if (dateMatch) {
          email.date = dateMatch[1].trim();
        }
        
        // Extract and decode body content
        const { text, html } = extractBodyFromMime(rawMessage);
        email.body_text = text;
        email.body_html = html;
      }

      // Fallback: Parse ENVELOPE if header parsing failed
      if (!email.subject || !email.from_address) {
        const envelopeMatch = data.match(/ENVELOPE\s+\((.+)\)/i);
        if (envelopeMatch) {
          const envData = envelopeMatch[1];

          // Extract date (first quoted or NIL value)
          if (!email.date) {
            const dateMatch = envData.match(/^"([^"]+)"/);
            if (dateMatch) {
              email.date = dateMatch[1];
            }
          }

          // Extract subject (second quoted value after date)
          if (!email.subject) {
            const subjectMatch = envData.match(/^"[^"]*"\s+"([^"]*)"/);
            if (subjectMatch) {
              email.subject = subjectMatch[1];
            } else {
              const nilSubjectMatch = envData.match(/^"[^"]*"\s+NIL/);
              if (nilSubjectMatch) {
                email.subject = "(No Subject)";
              }
            }
          }

          // Extract from address - look for ((name NIL user host)) pattern
          if (!email.from_address) {
            const fromMatch = envData.match(/\(\("?([^"]*)"?\s+NIL\s+"([^"]+)"\s+"([^"]+)"\)\)/);
            if (fromMatch) {
              email.from_name = fromMatch[1] || "";
              email.from_address = `${fromMatch[2]}@${fromMatch[3]}`;
            }
          }
        }
      }

      // Parse RFC822.SIZE
      const sizeMatch = data.match(/RFC822\.SIZE\s+(\d+)/i);
      if (sizeMatch) {
        email.size = parseInt(sizeMatch[1]);
      }

      if (email.from_address || email.subject) {
        emails.push(email);
      }
    }

    // If pattern matching failed, try simpler approach
    if (emails.length === 0) {
      console.log("Pattern matching failed, trying line-by-line parsing");
      const lines = response.split("\r\n");
      for (const line of lines) {
        if (line.includes("* ") && line.includes("FETCH")) {
          const seqMatch = line.match(/\*\s+(\d+)/);
          if (seqMatch) {
            emails.push({
              seq: parseInt(seqMatch[1]),
              subject: `Email #${seqMatch[1]}`,
              from_address: "unknown",
              from_name: "",
              is_read: line.includes("\\Seen"),
              is_starred: line.includes("\\Flagged"),
              date: new Date().toISOString(),
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
      limit = 50 
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
      const startSeq = Math.max(1, mailbox.exists - limit + 1);
      const fetchedEmails = await client.fetchEmails(startSeq, mailbox.exists);
      
      for (const fetchedEmail of fetchedEmails) {
        // Decode MIME encoded subject and from_name
        const decodedSubject = decodeMimeWord(fetchedEmail.subject || '');
        const decodedFromName = decodeMimeWord(fetchedEmail.from_name || '');
        
        // Body is already decoded by extractBodyFromMime
        const bodyText = fetchedEmail.body_text || '';
        const bodyHtml = fetchedEmail.body_html || '';
        
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
          console.log('Date parse error:', e);
        }
        
        const emailData = {
          message_id: `${email}-${fetchedEmail.seq}-${Date.now()}`,
          subject: decodedSubject || '(No Subject)',
          from_address: fetchedEmail.from_address || 'unknown@email.com',
          from_name: decodedFromName,
          to_addresses: [{ address: email }],
          email_date: emailDate,
          body_text: bodyText,
          body_html: bodyHtml,
          is_read: fetchedEmail.is_read || false,
          is_starred: fetchedEmail.is_starred || false,
          has_attachments: false,
          folder: targetFolder
        };
        emails.push(emailData);
      }
    }

    await client.logout();
    console.log(`Fetched ${emails.length} emails from ${mailbox.exists} total`);

    // Save emails to database
    let savedCount = 0;
    for (const emailData of emails) {
      const { data: existing } = await supabase
        .from('emails')
        .select('id')
        .eq('message_id', emailData.message_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        const { error: saveError } = await supabase
          .from('emails')
          .insert({
            ...emailData,
            user_id: user.id
          });

        if (saveError) {
          console.error('Error saving email:', saveError);
        } else {
          savedCount++;
        }
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
