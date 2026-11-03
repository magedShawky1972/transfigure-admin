import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { emailDisabledResponse, isOutgoingEmailEnabled } from "../../supabase/functions/_shared/email-policy";

describe("Edara outgoing email shutdown", () => {
  test("email remains disabled", () => {
    assert.equal(isOutgoingEmailEnabled(), false);
  });

  for (const name of ["send-email-smtp", "send-password-reset", "send-attendance-summary-email"]) {
    test(`${name} rejects sends before accessing data or opening SMTP`, async () => {
      const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), "utf8")
        .replace(/^import .*;\s*$/gm, "");
      let handler: ((request: Request) => Promise<Response>) | undefined;
      let databaseCalls = 0;
      let smtpConnections = 0;
      const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
      runInNewContext(js, {
        serve: (callback: typeof handler) => { handler = callback; },
        createClient: () => { databaseCalls++; throw new Error("Database must not be accessed"); },
        SMTPClient: class { constructor() { smtpConnections++; throw new Error("SMTP must not connect"); } },
        isOutgoingEmailEnabled, emailDisabledResponse, Response, console,
      });
      if (!handler) throw new Error("Missing request handler");
      const response = await handler(new Request("https://example.test", { method: "POST", body: "{}" }));
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { success: false, skipped: true, code: "emails_disabled", error: "Outgoing email is disabled for Edara." });
      assert.equal(databaseCalls, 0);
      assert.equal(smtpConnections, 0);
      assert.equal((await handler(new Request("https://example.test", { method: "OPTIONS" }))).status, 200);
    });
  }

  test("every mixed-workflow delivery helper exits before any transport or business access", async () => {
    const helpers: Record<string, string[]> = {
      "api-product-match": ["sendMismatchEmail"],
      "sync-riyad-statement-background": ["sendRawEmail"],
      "sync-orders-daily-background": ["sendCompletionEmail"],
      "sync-orders-background": ["sendCompletionEmail"],
      "sync-aggregated-orders-background": ["sendCompletionEmail"],
      "check-ticket-escalation": ["sendMail"],
      "check-request-escalation": ["sendRawEmail"],
      "invite-project-guest": ["sendRawEmail"],
      "send-advance-payment-notification": ["sendRawEmail"],
      "send-acknowledgment-email": ["sendRawEmail"],
      "send-task-notification": ["sendRawEmail"],
      "send-deduction-notification": ["sendRawEmail"],
      "share-projects-view": ["sendSmtp"],
      "send-task-reminders": ["sendSmtp"],
      "send-shift-open-notification": ["sendEmailInBackground"],
      "send-shift-close-notification": ["sendEmailInBackground"],
      "send-shift-notifications": ["sendEmailInBackground"],
      "send-reorder-notification": ["sendEmailWithSMTP"],
      "send-ticket-notification": ["sendEmailInBackground"],
      "send-coins-workflow-notification": ["sendRawEmail"],
      "detect-password-anomalies": ["sendBulkAccessAlert", "sendNewUserAccessAlert"],
    };
    for (const [name, functions] of Object.entries(helpers)) {
      const source = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
      const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
      for (const functionName of functions) {
        const node = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName);
        if (!node) throw new Error(`Missing helper ${name}/${functionName}`);
        const js = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        const result = await runInNewContext(`${js}\n${functionName}()`, { isOutgoingEmailEnabled });
        assert.equal(result, name === "send-ticket-notification" ? null : undefined);
      }
    }
  });
});