import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  emailId: string;
  email: string;
  password: string;
  host: string;
}

// Simple IMAP connection test
class IMAPClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private tagCounter = 0;
  private encoder = new TextEncoder();
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

  private async readWithTimeout(timeoutMs = 10000): Promise<Uint8Array | null> {
    const buffer = new Uint8Array(8192);

    const readPromise = this.conn!.read(buffer);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const n = (await Promise.race([readPromise, timeoutPromise])) as number | null;
    if (n === null) return null;
    return buffer.subarray(0, n);
  }

  private async readResponseUntil(predicate: (acc: string) => boolean, timeoutMs = 15000): Promise<string> {
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
    const greeting = await this.readResponseUntil(
      (acc) => acc.includes("\r\n") && acc.trimStart().startsWith("*"),
      10000
    );
    return greeting;
  }

  private async sendCommand(command: string): Promise<{ tag: string; response: string; ok: boolean; statusLine?: string }> {
    const tag = this.nextTag();
    const fullCommand = `${tag} ${command}\r\n`;
    console.log(`Sending: ${tag} ${command.substring(0, 50)}...`);
    await this.conn!.write(this.encoder.encode(fullCommand));

    const response = await this.readResponseUntil(
      (acc) => acc.includes(`\r\n${tag} OK`) || acc.includes(`\r\n${tag} NO`) || acc.includes(`\r\n${tag} BAD`) || acc.startsWith(`${tag} OK`) || acc.startsWith(`${tag} NO`) || acc.startsWith(`${tag} BAD`),
      15000
    );

    const statusMatch = response.match(new RegExp(`(?:^|\\r\\n)${tag}\\s+(OK|NO|BAD)\\b[^\\r\\n]*`, "i"));
    const statusLine = statusMatch?.[0]?.trim();
    const ok = statusLine?.toUpperCase().includes(`${tag} OK`) ?? false;

    return { tag, response, ok, statusLine };
  }

  async login(user: string, pass: string): Promise<{ ok: boolean; statusLine?: string }> {
    const escapedPass = pass.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const res = await this.sendCommand(`LOGIN "${user}" "${escapedPass}"`);
    return { ok: res.ok, statusLine: res.statusLine };
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch (e) {
      console.log("Logout error (expected):", e);
    }
  }

  close(): void {
    try {
      this.conn?.close();
    } catch (e) {
      console.log("Close error:", e);
    }
  }
}

// Get IMAP settings based on host name
function getImapSettings(host: string): { imapHost: string; imapPort: number; imapSecure: boolean } {
  const hostLower = host.toLowerCase();
  
  if (hostLower.includes("hostinger")) {
    return { imapHost: "imap.hostinger.com", imapPort: 993, imapSecure: true };
  } else if (hostLower.includes("google") || hostLower.includes("gmail")) {
    return { imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true };
  } else if (hostLower.includes("outlook") || hostLower.includes("microsoft") || hostLower.includes("office365")) {
    return { imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true };
  } else if (hostLower.includes("yahoo")) {
    return { imapHost: "imap.mail.yahoo.com", imapPort: 993, imapSecure: true };
  } else if (hostLower.includes("zoho")) {
    return { imapHost: "imap.zoho.com", imapPort: 993, imapSecure: true };
  }
  
  // Default to Hostinger settings
  return { imapHost: "imap.hostinger.com", imapPort: 993, imapSecure: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailId, email, password, host }: TestEmailRequest = await req.json();

    console.log(`Testing email connection for: ${email} (host: ${host})`);

    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email and password are required" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get IMAP settings
    const { imapHost, imapPort, imapSecure } = getImapSettings(host);
    console.log(`Using IMAP settings: ${imapHost}:${imapPort} (secure: ${imapSecure})`);

    let client: IMAPClient | null = null;
    let errorMessage = "";
    let isActive = false;

    try {
      client = new IMAPClient(imapHost, imapPort, imapSecure);
      await client.connect();
      
      const loginResult = await client.login(email, password);
      
      if (loginResult.ok) {
        isActive = true;
        console.log(`Login successful for ${email}`);
      } else {
        errorMessage = loginResult.statusLine || "Login failed - invalid credentials or access denied";
        console.log(`Login failed for ${email}: ${errorMessage}`);
      }

      await client.logout();
    } catch (error) {
      console.error(`Connection error for ${email}:`, error);
      errorMessage = error instanceof Error ? error.message : "Connection failed";
      
      // Provide more helpful error messages
      if (errorMessage.includes("Connection refused")) {
        errorMessage = "Connection refused - check IMAP server settings";
      } else if (errorMessage.includes("timed out")) {
        errorMessage = "Connection timed out - server not responding";
      } else if (errorMessage.includes("certificate")) {
        errorMessage = "SSL certificate error - security issue with server";
      }
    } finally {
      client?.close();
    }

    // Update the user_emails table with the result
    if (emailId) {
      const { error: updateError } = await supabaseClient
        .from('user_emails')
        .update({
          is_active: isActive,
          last_error: isActive ? null : errorMessage,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', emailId);

      if (updateError) {
        console.error('Error updating email status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        isActive,
        error: isActive ? null : errorMessage 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
