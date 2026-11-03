// Deliberately disabled; re-enabling requires explicit owner approval.
export function isOutgoingEmailEnabled(): boolean {
  return false;
}

export function emailDisabledResponse(headers: Record<string, string>): Response {
  return new Response(JSON.stringify({
    success: false,
    skipped: true,
    code: "emails_disabled",
    error: "Outgoing email is disabled for Edara.",
  }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });
}