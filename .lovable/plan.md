## Goal
Wire absence into payroll the same way late minutes already are: pick the right deduction rule (with-notice vs without-notice), compute its value, send it to a dedicated **Absence payroll element**, and let managers flag each absent day as "with notice" or "without notice" in Timesheet Management.

## Mapping (answer to your question)

| Timesheet signal | Rule source | Goes to payroll element |
|---|---|---|
| `late_minutes + early_leave_minutes` | already calculated per shift | element with `is_delay_minutes_element = true` |
| `is_absent` AND `has_notice = true` | `deduction_rules` row "Absence - with note" (100%) | element with `is_absence_element = true` *(new flag)* |
| `is_absent` AND `has_notice = false` | `deduction_rules` row "Absence - without note" (200%) | same absence element |

Formula per absent day:
```
daily_rate    = basic_salary / 30
absent_amount = daily_rate × rule.deduction_value     (1.0 with notice, 2.0 without)
```

## 1. Database migration

`saved_attendance`:
- add `absence_has_notice boolean` (null = not yet set, true = with notice, false = without notice)

`payroll_elements`:
- add `is_absence_element boolean default false`

`deduction_rules` — no schema change; rely on existing rows "Absence - with note" / "Absence - without note". Add two convenience flags so the engine can find them unambiguously even if names change later:
- add `is_absence_with_notice boolean default false`
- add `is_absence_without_notice boolean default false`

## 2. Payroll Element Setup (`PayrollElementSetup.tsx`)
- New checkbox **"Absence Element"** (mirrors the existing Basic Salary / Delay flags). When checked it forces `element_type = deduction`, `calculation_type = absence_days`, and unsets the same flag on every other element.

## 3. Deduction & Overtime Rules Setup (`DeductionRulesSetup.tsx`)
- In the edit dialog, when `rule_type = absence`, expose two mutually-exclusive checkboxes: **"Is Absence WITH notice"** and **"Is Absence WITHOUT notice"**. Saved into the new flags above.
- Show a small badge next to each absence row in the table indicating which one it is.

## 4. Timesheet Management — per-day Notice flag
On the timesheet grid (and the day-detail dialog), for any row where `is_absent = true`:
- New small toggle / segmented control with three states: **Unset · With Notice · Without Notice** that writes `saved_attendance.absence_has_notice`.
- Visible only to users who can edit timesheets (existing permission check).
- Defaults to "Unset" so admins explicitly classify each absence.

## 5. Deduction Summary (`DeductionSummary.tsx`)
- Split the **Absent** column into **Absent (with notice)** and **Absent (without notice)**, plus a new **Absence Amount** column.
- Per employee aggregate over the period:
  - `daysWithNotice` = count of `is_absent` rows where `absence_has_notice = true`
  - `daysWithoutNotice` = count where `absence_has_notice = false`
  - `daysUnclassified` = count where `absence_has_notice IS NULL` (shown in a yellow warning chip, not converted to money)
  - `absenceAmount = (basic/30) × (daysWithNotice × ruleWith.value + daysWithoutNotice × ruleWithout.value)`
- `Total Deduction` becomes `delayAmount + absenceAmount`. Ranna's row will now show a value instead of 0.00.
- Filters, multi-sort, Excel export, print: add the new columns.
- A warning toast appears on Confirm if any employee in scope still has unclassified absent days, so payroll never silently drops them.

## 6. Confirm & Send to Payroll
Extend the existing confirm flow to upsert TWO `payroll_variable_entries` per employee for the period:
1. element flagged `is_delay_minutes_element` → `delayAmount` (current behavior, unchanged)
2. element flagged `is_absence_element` → `absenceAmount` (new)

Rollback removes both. Skip employees whose amount is 0.

## 7. Payroll Run (`PayrollRun.tsx`)
Add an `absence_days` branch in `computePeriod` alongside the existing `delay_minutes` branch:
- Prefer a `payroll_variable_entries` value when present (so the Deduction Summary confirm wins).
- Otherwise, fallback compute from `saved_attendance` over the run period using the same formula.

## Files touched
- migration: `saved_attendance.absence_has_notice`, `payroll_elements.is_absence_element`, `deduction_rules.is_absence_with_notice` / `is_absence_without_notice`
- `src/pages/PayrollElementSetup.tsx`
- `src/pages/DeductionRulesSetup.tsx`
- `src/pages/DeductionSummary.tsx`
- `src/pages/PayrollRun.tsx`
- Timesheet Management page + day-detail dialog (existing files, exact paths to be confirmed during build)

## Backwards compatibility
- Old delay flow keeps working unchanged.
- Existing absence rows with `absence_has_notice = null` are surfaced as "unclassified" and excluded from money calculation until the manager flags them — no silent miscalculation.