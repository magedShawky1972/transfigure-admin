

## Plan: Update CRM Integration for PWA WebView with Production URL

### What Changed
The CRM app is a **PWA** (not a native mobile app), so the WebView approach using JavaScript injection won't work. Instead, we need a URL-based session passing mechanism where the session ID is embedded in the URL but hidden from users.

### Changes

#### 1. Update Production URL (CRMIntegrationDoc.tsx)
- Change `APP_URL` from preview URL to `https://edaraasus.com`
- Remove Android (Kotlin) and iOS (Swift) native WebView examples since the CRM is a PWA

#### 2. Create Session-Based Auto-Login Route
- Add a new route `/crm-session` that accepts an encrypted/encoded session token as a URL hash fragment (hash fragments are NOT sent to servers, adding security)
- URL format: `https://edaraasus.com/crm-session#token={base64_encoded_session_data}`
- The page will:
  1. Read the token from the URL hash (not visible in server logs)
  2. Decode the base64 session data
  3. Set it in localStorage as the auth session
  4. Clear the hash from the URL bar immediately (so user can't see it)
  5. Redirect to `/shift-session`

#### 3. New Page: `src/pages/CRMSession.tsx`
- Handles the auto-login flow from the URL hash
- Shows a brief "Connecting..." loading state
- Clears the URL hash after reading to hide the session ID
- Redirects to `/shift-session` once authenticated

#### 4. Register Route in App.tsx
- Add `/crm-session` route pointing to the new CRMSession component

#### 5. Update CRM Integration Doc
- Replace native mobile examples with PWA integration examples
- Show how to construct the URL with base64-encoded session:
  ```
  const sessionData = base64encode(JSON.stringify({
    access_token: session_id,
    refresh_token: refresh_token,
    expires_at: expires_at,
    ...
  }));
  
  // Open in PWA WebView / iframe
  window.location.href = `https://edaraasus.com/crm-session#token=${sessionData}`;
  ```
- Update WebView section to explain the PWA approach
- Remove Kotlin/Swift examples, replace with JavaScript/PWA examples
- Add security note: hash fragments are not sent to servers

### Technical Details
- **Security**: Using URL hash (`#`) instead of query params (`?`) ensures the session token is never sent to the server in HTTP requests or logged in server access logs
- **UX**: The hash is cleared immediately via `window.history.replaceState` so the user never sees the token
- **Files modified**: `src/pages/CRMIntegrationDoc.tsx`, `src/pages/CRMSession.tsx` (new), `src/App.tsx`

