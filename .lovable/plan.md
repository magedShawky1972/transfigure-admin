

# Automated Deduction Email Scheduling Plan

## Overview
Set up automated scheduling for deduction notification emails at 10 AM (KSA time) with hourly retry for any failed notifications.

## Current State
- **Existing cron job**: `zk-deduction-notification` runs at 5:00 AM (job ID 9) calling `send-deduction-notification`
- **Edge function**: Already handles sending emails with CC to HR managers
- **Database flags**: `deduction_notification_sent` and `deduction_notification_sent_at` columns exist in `saved_attendance`

## Implementation Steps

### 1. Update Cron Jobs (Database Change)
Replace the existing deduction notification cron with two new schedules:

**Main Schedule - 10:00 AM KSA (7:00 UTC)**:
```
Schedule: '0 7 * * *'  (10 AM KSA = 7 AM UTC)
```

**Hourly Retry - Every Hour from 11 AM to 6 PM KSA**:
```
Schedule: '0 8-15 * * *'  (8 AM - 3 PM UTC = 11 AM - 6 PM KSA)
```

Both will call the existing `send-deduction-notification` edge function which already:
- Defaults to yesterday's data
- Only sends to records where `deduction_notification_sent = false`
- Updates the flag after successful send

### 2. SQL Migration
```sql
-- Unschedule existing job
SELECT cron.unschedule('zk-deduction-notification');

-- Schedule main notification at 10 AM KSA (7 AM UTC)
SELECT cron.schedule(
  'zk-deduction-notification-10am',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/send-deduction-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule hourly retry from 11 AM to 6 PM KSA (8 AM - 3 PM UTC)
SELECT cron.schedule(
  'zk-deduction-notification-hourly-retry',
  '0 8-15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/send-deduction-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## How It Works

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Deduction Email Flow                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   8:30 PM    ZK Attendance Evening Process                      │
│      │       └── Processes out-times, calculates deductions     │
│      │       └── Creates saved_attendance records               │
│      │       └── Sets deduction_notification_sent = false       │
│      ▼                                                          │
│   10:00 AM   Main Deduction Notification (Next Day)             │
│      │       └── Queries yesterday's records with:              │
│      │           • has_issues = true                            │
│      │           • deduction_notification_sent = false          │
│      │           • deduction_amount > 0                         │
│      │       └── Sends emails to employees + CC HR managers     │
│      │       └── Updates flag to true                           │
│      ▼                                                          │
│   11 AM -    Hourly Retry Check                                 │
│   6 PM       └── Same query catches any failed sends            │
│              └── Only sends to records still false              │
│              └── Runs every hour for retries                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## UI Status
The existing "Mail Sent" column in Timesheet Management will automatically reflect:
- **Green mail icon**: Email sent successfully (`deduction_notification_sent = true`)
- **Grey mail icon**: Email pending/failed (`deduction_notification_sent = false`)

## No Code Changes Required
The existing `send-deduction-notification` edge function already:
1. Defaults to yesterday's date
2. Only processes unsent notifications
3. Updates the sent flag after successful delivery
4. Works with the retry logic (won't re-send already sent emails)

## Technical Details

| Schedule | Cron Expression | KSA Time | Purpose |
|----------|----------------|----------|---------|
| Main | `0 7 * * *` | 10:00 AM | Primary deduction emails |
| Retry | `0 8-15 * * *` | 11 AM - 6 PM | Hourly retry for failures |

