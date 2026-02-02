

# Fix Deduction Email Notifications

## Problem Analysis

Based on my investigation, there are **three issues** to fix:

### Issue 1: Wrong Data Source
The current edge function reads from `saved_attendance` table, but you confirmed it should read from **`timesheets`** table instead.

### Issue 2: Deduction Amount vs Percentage Display
The `deduction_amount` column in timesheets stores 0 for many records, but the `deduction_rule_id` is set with the correct rule. The email should display the **deduction percentage from the linked rule** (e.g., "50%" or "100%"), not the calculated SAR amount.

Looking at the Feb-01 data:
- Bassem: `deduction_rule_id` = Late 31-60 min (50%)
- Mohamed Saad: `deduction_rule_id` = Late over 60 min (100%)
- Mohamed Fahd: `deduction_rule_id` = Late over 60 min (100%)
- Fadi Mounir: `deduction_rule_id` = Late over 60 min (100%)

### Issue 3: Email Format Corruption
Arabic text appears as encoded garbage. Need to match the working shift notification email pattern.

---

## Solution

### Step 1: Update Edge Function to Use `timesheets` Table

Change the data source from `saved_attendance` to `timesheets`:
- Join with `employees` table to get email and Arabic names
- Join with `deduction_rules` to get the percentage value
- Filter: `deduction_rule_id IS NOT NULL` AND percentage > 0 AND NOT on vacation

### Step 2: Fix Email Recipient Logic

Send emails only to employees who have:
- A timesheet record for the target date
- A `deduction_rule_id` linked to a rule with `deduction_value > 0`
- Status is NOT "vacation"
- Email has not been sent yet (track via a flag)

### Step 3: Show Deduction as Percentage

Display the deduction as percentage from the rule (e.g., "خصم 50%" or "خصم 100%") along with the Arabic rule name.

### Step 4: Fix Arabic Email Format

Copy the exact email sending pattern from `send-shift-open-notification`:
- Use `sendEmailInBackground` async function
- Same SMTP client configuration
- Same `content: "text/html; charset=utf-8"` pattern

---

## Technical Changes

### Database Migration

Add `deduction_notification_sent` column to `timesheets` table:

```sql
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS deduction_notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deduction_notification_sent_at TIMESTAMPTZ;
```

### Edge Function Changes (`send-deduction-notification/index.ts`)

1. **Query from timesheets instead of saved_attendance**:
```typescript
const { data: records } = await supabase
  .from('timesheets')
  .select(`
    id, work_date, employee_id, status, late_minutes,
    deduction_rule:deduction_rules(id, rule_name_ar, deduction_value),
    employee:employees!inner(
      id, first_name_ar, last_name_ar, email, user_id, zk_employee_code
    )
  `)
  .eq('work_date', targetDate)
  .eq('deduction_notification_sent', false)
  .not('deduction_rule_id', 'is', null)
  .neq('status', 'vacation');
```

2. **Filter in code**: Only process records where `deduction_rule.deduction_value > 0`

3. **Display percentage in email**:
```typescript
const percentage = (record.deduction_rule.deduction_value * 100).toFixed(0);
// Shows "50%" or "100%"
```

4. **Use async email sending pattern** from shift notifications

5. **Update timesheets table** after sending (not saved_attendance)

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `deduction_notification_sent` columns to `timesheets` |
| `supabase/functions/send-deduction-notification/index.ts` | Complete rewrite to use timesheets, fix email format, show percentage |

---

## Expected Result After Fix

For Feb-01, emails will be sent to:
1. **Bassem Frahat** - Rule: تأخير 31-60 دقيقة (50%)
2. **Mohamed Saad** - Rule: تأخير أكثر من 60 دقيقة (100%)
3. **Mohamed Fahd** - Rule: تأخير أكثر من 60 دقيقة (100%)
4. **Fadi Mounir** - Rule: تأخير أكثر من 60 دقيقة (100%)

Employees like Mostafa, Amr, Ahmed Waly will NOT receive emails because their `deduction_rule_id` is either null or points to a 0% rule.

