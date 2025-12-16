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

// Simple IMAP client implementation for Deno
class SimpleIMAPClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private buffer = "";
  private tagCounter = 0;

  constructor(
    private host: string,
    private port: number,
    private secure: boolean
  ) {}

  async connect(): Promise<void> {
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
    this.reader = this.conn.readable.getReader();
    // Read greeting
    await this.readResponse();
  }

  private async readResponse(): Promise<string[]> {
    const decoder = new TextDecoder();
    const lines: string[] = [];
    
    while (true) {
      const { value, done } = await this.reader!.read();
      if (done) break;
      
      this.buffer += decoder.decode(value);
      
      while (this.buffer.includes("\r\n")) {
        const index = this.buffer.indexOf("\r\n");
        const line = this.buffer.substring(0, index);
        this.buffer = this.buffer.substring(index + 2);
        lines.push(line);
        
        // Check if this is a tagged response (end of command response)
        if (line.match(/^A\d+ (OK|NO|BAD)/)) {
          return lines;
        }
        // Check for untagged OK (greeting)
        if (line.startsWith("* OK")) {
          return lines;
        }
      }
    }
    
    return lines;
  }

  private async sendCommand(command: string): Promise<string[]> {
    const tag = `A${++this.tagCounter}`;
    const encoder = new TextEncoder();
    const fullCommand = `${tag} ${command}\r\n`;
    
    const writer = this.conn!.writable.getWriter();
    await writer.write(encoder.encode(fullCommand));
    writer.releaseLock();
    
    return await this.readResponse();
  }

  async login(user: string, pass: string): Promise<boolean> {
    const response = await this.sendCommand(`LOGIN "${user}" "${pass}"`);
    return response.some(line => line.includes("OK"));
  }

  async select(mailbox: string): Promise<{ exists: number }> {
    const response = await this.sendCommand(`SELECT "${mailbox}"`);
    let exists = 0;
    for (const line of response) {
      const match = line.match(/\* (\d+) EXISTS/);
      if (match) {
        exists = parseInt(match[1]);
      }
    }
    return { exists };
  }

  async fetchHeaders(start: number, end: number): Promise<any[]> {
    const emails: any[] = [];
    const response = await this.sendCommand(
      `FETCH ${start}:${end} (FLAGS ENVELOPE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)])`
    );
    
    let currentEmail: any = null;
    
    for (const line of response) {
      // Parse FETCH response
      const fetchMatch = line.match(/^\* (\d+) FETCH/);
      if (fetchMatch) {
        if (currentEmail) {
          emails.push(currentEmail);
        }
        currentEmail = { seq: parseInt(fetchMatch[1]) };
      }
      
      // Parse FLAGS
      const flagsMatch = line.match(/FLAGS \(([^)]*)\)/);
      if (flagsMatch && currentEmail) {
        currentEmail.flags = flagsMatch[1].split(" ");
        currentEmail.is_read = currentEmail.flags.includes("\\Seen");
        currentEmail.is_starred = currentEmail.flags.includes("\\Flagged");
      }
      
      // Parse ENVELOPE
      const envelopeMatch = line.match(/ENVELOPE \((.+)\)/);
      if (envelopeMatch && currentEmail) {
        // Simplified envelope parsing
        const envelope = envelopeMatch[1];
        // Extract subject (first quoted string after date)
        const subjectMatch = envelope.match(/"([^"]*)" "([^"]*)"/);
        if (subjectMatch) {
          currentEmail.subject = subjectMatch[2];
        }
      }
      
      // Parse header fields
      if (line.startsWith("From:") && currentEmail) {
        currentEmail.from = line.substring(5).trim();
      }
      if (line.startsWith("To:") && currentEmail) {
        currentEmail.to = line.substring(3).trim();
      }
      if (line.startsWith("Subject:") && currentEmail) {
        currentEmail.subject = line.substring(8).trim();
      }
      if (line.startsWith("Date:") && currentEmail) {
        currentEmail.date = line.substring(5).trim();
      }
      if (line.startsWith("Message-ID:") && currentEmail) {
        currentEmail.message_id = line.substring(11).trim();
      }
    }
    
    if (currentEmail) {
      emails.push(currentEmail);
    }
    
    return emails;
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch (e) {
      // Ignore logout errors
    }
    this.conn?.close();
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get user from token
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

    console.log(`Fetching emails for ${email} from ${imapHost}:${imapPort}, folder: ${folder}`);

    const client = new SimpleIMAPClient(imapHost, imapPort, imapSecure);
    
    await client.connect();
    console.log('Connected to IMAP server');

    const loginSuccess = await client.login(email, emailPassword);
    if (!loginSuccess) {
      throw new Error('IMAP login failed');
    }
    console.log('Login successful');

    const mailbox = await client.select(folder);
    console.log(`Mailbox opened: ${mailbox.exists} messages`);

    const emails: any[] = [];

    if (mailbox.exists > 0) {
      const startSeq = Math.max(1, mailbox.exists - limit + 1);
      const fetchedEmails = await client.fetchHeaders(startSeq, mailbox.exists);
      
      for (const fetchedEmail of fetchedEmails) {
        const emailData = {
          message_id: fetchedEmail.message_id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          subject: fetchedEmail.subject || '(No Subject)',
          from_address: fetchedEmail.from?.match(/<([^>]+)>/)?.[1] || fetchedEmail.from || '',
          from_name: fetchedEmail.from?.replace(/<[^>]+>/, '').trim() || '',
          to_addresses: [{ address: fetchedEmail.to }],
          email_date: fetchedEmail.date ? new Date(fetchedEmail.date).toISOString() : new Date().toISOString(),
          body_text: '',
          body_html: '',
          is_read: fetchedEmail.is_read || false,
          is_starred: fetchedEmail.is_starred || false,
          has_attachments: false,
          folder: folder
        };
        emails.push(emailData);
      }
    }

    await client.logout();
    console.log(`Fetched ${emails.length} emails`);

    // Save emails to database
    let savedCount = 0;
    for (const emailData of emails) {
      // Check if email already exists
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
      } else {
        // Update read/starred status
        await supabase
          .from('emails')
          .update({
            is_read: emailData.is_read,
            is_starred: emailData.is_starred
          })
          .eq('id', existing.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fetched: emails.length,
        saved: savedCount,
        total: mailbox.exists
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
