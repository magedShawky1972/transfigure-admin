

## Plan: Auto-Import Riyad Bank Statement from Email (Background Service)

### Overview
Create a background edge function that runs daily at 00:00, connects to `cto@asuscards.com` via IMAP, finds the Riyad Bank statement email, extracts the Excel attachment, parses it using the existing column mappings (sheet `riyadbankstatement`), skips duplicates, inserts new records into `riyadbankstatement` table, and sends a summary notification email to `maged.shawky@asuscards.com`.

### Prerequisites
- `cto@asuscards.com` must be configured in `profiles` or we hardcode the IMAP credentials as secrets (since this email is not in profiles currently)
- IMAP/SMTP settings from `mail_types` table (Hostinger: imap.hostinger.com:993, smtp.hostinger.com:465)

### Step 1: Add secrets for cto@asuscards.com IMAP credentials
- Need `CTO_EMAIL_PASSWORD` secret for the cto@asuscards.com mailbox password
- The IMAP host/port are already known (Hostinger)

### Step 2: Create edge function `sync-riyad-statement-background`
This function will:
1. **Connect to IMAP** (imap.hostinger.com:993) as `cto@asuscards.com`
2. **Search for emails** from Riyad Bank received today (SEARCH FROM "riyadbank" or similar subject pattern — we'll need to confirm the sender/subject pattern)
3. **Extract Excel attachment** from the email (parse MIME, find the .xlsx part, decode from base64)
4. **Parse the Excel file** using the existing column mappings from `excel_column_mappings` for sheet `riyadbankstatement` (19 columns mapped: Txn. Number is PK)
5. **Check for duplicates** by `txn_number` (unique constraint exists) — always **skip** duplicates
6. **Handle missing/extra fields**: Map only known columns, log warnings for missing or extra columns in the Excel
7. **Insert new records** into `riyadbankstatement` table
8. **Post-insert**: Run the same bank_ledger matching logic as `load-excel-data` (linking via `acquirer_private_data` → `order_payment.paymentrefrence` → `bank_ledger.reference_number`)
9. **Send notification email** to `maged.shawky@asuscards.com` using raw SMTP (same pattern as task notifications) with:
   - Subject: "تم تحميل كشف بنك الرياض - Riyad Bank Statement Uploaded"
   - Body: number of records uploaded, number of duplicates skipped, date range

### Step 3: Configure cron job (pg_cron)
Schedule the function to run daily at 00:00 KSA (21:00 UTC):
```sql
SELECT cron.schedule(
  'sync-riyad-statement-daily',
  '0 21 * * *',  -- 00:00 KSA = 21:00 UTC
  $$ SELECT net.http_post(...) $$
);
```

### Step 4: Add to `supabase/config.toml`
```toml
[functions.sync-riyad-statement-background]
verify_jwt = false
```

### Step 5: Create a log table for tracking auto-imports
- `riyad_statement_auto_imports` table with columns: id, import_date, records_inserted, records_skipped, status, error_message, email_subject, created_at
- This provides visibility into the background process

### Technical Details

**Excel parsing in Deno**: Will use the `xlsx` library via esm.sh to parse the attachment in-memory (same approach as `load-excel-data` but reading from base64-decoded attachment bytes instead of frontend-uploaded data).

**IMAP attachment extraction**: Extend the existing IMAP client pattern from `fetch-email-body-imap` to extract binary attachments (base64-decoded MIME parts with `Content-Disposition: attachment` and `.xlsx` filename).

**Column mapping**: Hardcode the known 19 column mappings from the database (Txn. Date → txn_date, Card Number → card_number, etc.) to avoid querying `excel_column_mappings` at runtime, making it self-contained.

**Duplicate handling**: Use `txn_number` as the unique key. Query existing `txn_number` values for the date range, skip any that already exist.

**Email notification**: Uses the raw SMTP + Base64 approach (same as `send-task-notification`) to `maged.shawky@asuscards.com` with Arabic RTL template.

### Questions Needed
Before implementing, I need to confirm:
- The **email password** for `cto@asuscards.com` (will request via secrets tool)
- The **sender address or subject pattern** of the Riyad Bank daily statement email (to identify the correct email to process)

