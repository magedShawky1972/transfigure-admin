# HR Management & Payroll — Page Documentation

Generated from the application source code. Structure and logic only — no real data. Items marked **TODO:** need confirmation.

## Table of Contents

**HR Management**

- [1. Company Setup (`/company-setup`)](#1-company-setup-company-setup)
- [2. Employee Setup (`/employee-setup`)](#2-employee-setup-employee-setup)
- [3. Employee Requests (`/employee-self-requests`)](#3-employee-requests-employee-self-requests)
- [4. Request Approvals (`/employee-request-approvals`)](#4-request-approvals-employee-request-approvals)
- [5. HR Manager Setup (`/hr-manager-setup`)](#5-hr-manager-setup-hr-manager-setup)
- [6. Vacation Setup (`/vacation-setup`)](#6-vacation-setup-vacation-setup)
- [7. Timesheet Management (`/timesheet-management`)](#7-timesheet-management-timesheet-management)
- [8. ZK Attendance Logs (`/zk-attendance-logs`)](#8-zk-attendance-logs-zk-attendance-logs)
- [9. Deduction Rules (`/deduction-rules-setup`)](#9-deduction-rules-deduction-rules-setup)
- [10. Medical Insurance (`/medical-insurance-setup`)](#10-medical-insurance-medical-insurance-setup)
- [11. Document Types (`/document-type-setup`)](#11-document-types-document-type-setup)
- [12. Attendance Types (`/attendance-type-setup`)](#12-attendance-types-attendance-type-setup)
- [13. Job Setup (`/job-setup`)](#13-job-setup-job-setup)
- [14. Vacation Calendar (`/hr-vacation-calendar`)](#14-vacation-calendar-hr-vacation-calendar)
- [15. Company Hierarchy (`/company-hierarchy`)](#15-company-hierarchy-company-hierarchy)
- [16. Company News (`/company-news`)](#16-company-news-company-news)
- [17. Department Management (`/department-management`)](#17-department-management-department-management)
- [18. Administrative Decisions (`/acknowledgment-documents`)](#18-administrative-decisions-acknowledgment-documents)
- [19. WFH Check-In (`/wfh-checkin`)](#19-wfh-check-in-wfh-checkin)
- [20. WFH Calendar (`/company-wfh-calendar`)](#20-wfh-calendar-company-wfh-calendar)

**Payroll**

- [21. Payroll Element Setup (`/payroll/element-setup`)](#21-payroll-element-setup-payrollelement-setup)
- [22. Element Eligibility (`/payroll/eligibility`)](#22-element-eligibility-payrolleligibility)
- [23. Employee Element Assign (`/payroll/employee-elements`)](#23-employee-element-assign-payrollemployee-elements)
- [24. Multi Element Entry (`/payroll/matrix-entry`)](#24-multi-element-entry-payrollmatrix-entry)
- [25. Variable Element Entry (`/payroll/variable-entry`)](#25-variable-element-entry-payrollvariable-entry)
- [26. Month Element Preview (`/payroll/month-preview`)](#26-month-element-preview-payrollmonth-preview)
- [27. Payroll Run & Confirm (`/payroll/run`)](#27-payroll-run--confirm-payrollrun)

---

# HR pages — Part 1

Code-based reference. Routes were checked in `src/App.tsx`; primary implementations are the corresponding files in `src/pages/`. Schema references are `src/integrations/supabase/types.ts` and `supabase/migrations/`. No database was queried. Examples are fictitious. “Required” below describes client-side enforcement unless explicitly identified as a database constraint. “Blank” means empty initial form state; editing loads stored values. Read-only grid values do not have user-entry requirements.

All six routes render inside `Layout`. Page visibility, authenticated access, and database row-level security (RLS) are separate concerns; a visible control does not guarantee that a write is permitted. **TODO:** Verify the effective deployed policies and navigation permissions against the complete migration history before treating this document as an access-control audit. None of these six page implementations directly invokes a Supabase Edge Function or RPC: the described actions use the Supabase table/storage/auth clients. Background server processes must not be mistaken for button-triggered calls.

# Part I — HR Management

## 1. Company Setup (`/company-setup`)

### Purpose
Maintain the company lookup used by Employee Setup. The page itself does not check an administrator role. The company-creation migration grants authenticated users SELECT, INSERT, UPDATE, and DELETE; effective permissions still depend on subsequently applied policies.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| New Company Name | Text input | Yes, on Add | Trimmed; empty value rejected | Blank |
| Name (grid, editable) | Text input | Database NOT NULL | Trimmed on save; no client-side empty-name check on edits; database UNIQUE | Stored name |
| Active (grid, editable) | Boolean switch | Yes in payload | Boolean | True for new company |
| Actions (grid) | Delete control | N/A | Write permission required | N/A |

### Actions
- **Add:** inserts `{name, is_active: true}` into `companies`, requests returned rows, clears the new-name input and reloads the list. An empty returned result is reported as “No permission.”
- **Save All:** sequentially updates every displayed company's trimmed name and active state, then reloads. Individual update failures do not stop the loop; the final “All saved” toast is not proof every update succeeded.
- **Delete row:** immediately deletes by `id`, requests returned rows, then reloads; no confirmation dialog is implemented here. An empty returned result is reported as lack of permission.
- **Name edits / Active switch:** update local state only until Save All.

### Business Rules
- Active companies sort first, then names ascending.
- New company names are unique at database level.
- Inactive companies remain visible here but are excluded from Employee Setup's company selector.
- Writes and reloads are not a transaction; dependency/foreign-key failures are shown via toast.

### Dependencies
`CompanySetup.tsx`, Supabase client, `LanguageContext`, UI inputs/switches, toast and `LoadingOverlay`; Employee Setup consumes this lookup.

### Database
`companies`: UUID primary key `id`; unique non-null text `name`; non-null boolean `is_active` default true; `created_at`, `updated_at` timestamps default now. The migration attaches the `update_updated_at_column` trigger function. `employees.company_id` links employee assignments to this lookup.

### Step-by-step Example
1. Enter **Example Company A** in New Company Name.
2. Click Add; the row appears active.
3. Change its name to **Example Company B** and click Save All.
4. To stop offering it for new assignments, turn Active off and save again.

## 2. Employee Setup (`/employee-setup`)

### Purpose
Maintain employee master records, linked application accounts, organization/payroll attributes, attendance configuration, annual vacation allocations, contacts, photographs, and documents. The add/edit dialog has **Basic Info**, **Contacts**, **Job Info**, and **Shifts & Leave** tabs. Documents, account loading, and payroll elements use separate dialogs.

The page does not implement a general HR-role guard. Database policies determine actual read/write authority. Basic-salary visibility and inclusion in the save payload are restricted in the client to **specific hard-coded admin users**; this is not a replacement for database protection. **TODO:** Confirm equivalent server-side salary confidentiality, particularly for full employee reads, payroll-element access, and exports.

### Fields
#### Directory and display controls
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Search | Text | No | Client-side search, scoped by Search By | Blank |
| Search By | Select: all / ZK | No | ZK mode searches attendance code | All |
| Department / Job / Business Unit / Payroll Country | Select filters | No | Loaded lookup values | All for each |
| Alphabet | Letter buttons | No | Language-dependent letters; selecting same letter clears it | None |
| View mode | Card / table toggle | No | Local presentation only | Card |
| Photo / Employee # / Name / Department / Position / Start Date / Status | Read-only directory columns | N/A | Joined labels and localized display | Stored values; fallbacks where missing |
| Actions | Row/card controls | N/A | See Actions | N/A |

#### Basic Info tab
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Photo | Image file | No | MIME type must start with `image/`; no explicit size check in handler | None |
| Employee Number | Generated/displayed text | Auto-generated if empty | Timestamp-based `EMP` number if omitted | Generated on add |
| ZK Attendance Code | Text | No | Blank stored as null | Blank |
| Dopay Employee Number | Text | No | Blank stored as null | Blank |
| First Name | Text | Yes | Nonempty check, no trim in save validation | Blank |
| First Name (Arabic) | Text | No | Blank becomes null | Blank |
| Last Name | Text | Yes | Nonempty check, no trim in save validation | Blank |
| Last Name (Arabic) | Text | No | Blank becomes null | Blank |
| Link to User | Profile select | No | Active profiles; cleared selection becomes null | None |
| Email | Email input | No | No additional email validator in save handler | Blank |
| Phone | Text | No | No explicit format validation | Blank |
| Work Mobile | Text | No | No explicit format validation | Blank |
| Private Mobile Number | Text | No | No explicit format validation | Blank |
| Date of Birth | Date | No | No save-handler age check | Blank |
| Gender | Select | No | Offered options | Blank |
| Nationality | Select | No | Offered nationality list | Blank |
| National ID | Text | No | No length/checksum validation in handler | Blank |
| Passport Number | Text | No | No explicit format validation | Blank |
| Marital Status | Select | No | Offered options | Blank |
| Religion | Select | No | Offered options | Blank |
| Address | Text input | No | Blank becomes null | Blank |

#### Contacts tab and contact editor
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Contact Type | Select | Yes | Nonempty in contact save handler | Blank |
| Contact Name | Text | Yes | Nonempty in contact save handler | Blank |
| Phone Number | Text | No | No explicit phone validation | Blank |
| Address | Text | No | Blank becomes null | Blank |
| Emergency Contact | Checkbox | No | Boolean | False |
| Notes | Contact state / optional persisted text | No | Included in insert/update payload | Blank |
| Type / Name / Phone / Address / Actions | Contact table columns | N/A | Emergency state is indicated in display | Saved values |

Contacts require an already saved employee. **TODO:** The contact model carries `notes`; confirm whether a notes input is exposed in the rendered editor before training users to enter it.

#### Job Info tab
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Department | Select | No | Active departments | None |
| Job Position | Select | No | Active positions | None |
| Working Business Unit | Select plus add shortcut | No | Active units | None |
| Company | Select | No | Active companies | None |
| Cost Center | Select | No | Business-unit mapping influences options/assignment | None |
| Payroll Dr. Account | Read-only derived text | N/A | From business-unit/cost-center mapping | Mapping value or empty |
| Payroll Country | Select | No | Offered country choices, including Egypt and KSA | Blank |
| Job Start Date | Date | Yes | Nonempty save-handler check | Today on new-record dialog |
| Termination Date | Date | No | No save-handler comparison with start date | Blank |
| Employment Status | Select | Yes in payload | active, on_leave, terminated, suspended | Active |
| Manager | Employee select | No | Employee reference | None |
| Basic Salary | Number | No | Parsed as float; only authorized clients submit this property | Blank |
| Salary Currency | Select | No | Active currencies | None |
| New Business Unit: Name (English) | Text in auxiliary dialog | Yes to add | Nonempty trimmed name | Blank |
| New Business Unit: Name (Arabic) | Text | No | Optional | Blank |

#### Shifts & Leave tab
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Attendance Type | Select | No | Active attendance types; controls fixed/shift presentation | None |
| Requires Attendance Sign-in | Checkbox | No | Boolean | True |
| Work Start / Work End | Time inputs, conditional | No | Fixed-attendance configuration; no save-handler time-order validation | Blank / selected-type configuration |
| Attendance schedule summary | Read-only | N/A | Selected type supplies shift/fixed and grace-period information | Selected-type values |
| Enable (per vacation type) | Checkbox | No | Adds/removes that vacation allocation in local state | Off unless assigned |
| Vacation Type | Read-only label | N/A | Active vacation codes | Lookup name |
| Balance | Number per enabled type | No | Numeric allocation; UI minimum applies | 0 when first enabled |
| Used | Number per enabled type | No | Numeric used-days value; UI minimum applies | 0 when first enabled |
| Remaining | Calculated grid value | N/A | Balance minus Used | Calculated |
| Medical Insurance | Select | No | Active medical-insurance plans | None |

The form state/payload also retains `shift_type` (new default fixed), `fixed_shift_start`, `fixed_shift_end`, `shift_plan_id`, legacy `vacation_balance`, and `medical_insurance_plan_id`. Do not assume every state property has its own visible input; attendance-type-driven controls are the current UI. **TODO:** Clarify intended use of legacy vacation balance and shift-plan fields versus annual allocations and attendance types.

#### Auxiliary dialogs
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Document Type | Select | Yes for upload | Must have saved employee and selected type | None |
| Document Expiry Date | Date | No | Blank becomes null | Blank |
| Document Notes | Textarea | No | Blank becomes null | Blank |
| Document File | File picker | Yes for upload | Handler does not impose size/type limit | None |
| Document listing | Name/type, metadata, download/delete controls | N/A | Loaded for selected employee | Stored documents |
| Unlinked users | Selectable profile list | At least one for bulk Add | Excludes already linked profile IDs | None selected |
| Payroll Code / Element / Type / Amount / From / To / Status | Read-only payroll-element table | N/A | Joined payroll-element definition and employee assignment | Stored values |

### Actions
- **Add Employee:** resets form/vacation state and opens the tabbed editor. **Edit:** loads the employee, contacts, and current-year vacation allocations. The `edit` query parameter can open an employee editor and is then cleared.
- **Save:** validates first name, last name and job start date; inserts or updates `employees`. On update it checks for returned rows to detect denied writes. It then deletes all current-year `employee_vacation_types` rows for that employee and reinserts the current allocation state. These operations are not transactional; allocation errors can be logged after the employee write succeeds. **Cancel/close:** dismisses editor without saving employee form state; independently saved contacts/uploads are not rolled back.
- **Photo/camera picker:** uploads immediately to storage bucket `employee-photos`, under `photos/`; obtains a public-location value and stores it in form state. The employee reference is persisted on Save. Removing/changing the form photo does not establish automatic storage cleanup.
- **Contacts:** for a saved employee, add/update writes `employee_contacts` immediately; Edit fills the contact editor, Cancel editing resets it, and Delete deletes the contact row and reloads. The separate contact dialog uses the same employee contact data where exposed.
- **Documents:** opens document management and loads `employee_documents`. Upload writes the storage object in `employee-documents`, then inserts metadata and uploader reference. Download retrieves a blob and triggers a browser download. Delete removes the object and metadata, then reloads. No atomic storage/database transaction exists.
- **View profile:** navigates to the selected employee's profile. **Payroll/wallet:** loads `payroll_employee_elements` joined to `payroll_elements` into a read-only dialog; its navigation shortcut opens payroll-element maintenance. **Close:** dismisses the dialog.
- **Delete employee:** opens confirmation; confirmed deletion deletes by employee ID. Payroll/timesheet dependency errors instruct the user to set status to terminated instead. **Cancel:** closes confirmation.
- **Load Users:** lists active profiles without an employee link. Individual selection and Select All/clear-selection controls prepare bulk insertion. Bulk Add requires at least one selection, splits profile names, supplies a fallback last name, generates employee numbers, and inserts active/fixed employees with today's job start date. A per-user add/edit shortcut opens a prefilled employee form instead.
- **Export Excel:** exports filtered, nonterminated employees using `xlsx`; includes identity/contact/organization/attendance/payroll fields and current-year remaining vacation summed across types. **TODO:** Confirm salary export authorization independently of the salary input guard.
- **Card/table**, **search**, **Search By**, **lookup filters**, and **letter controls:** change client-side display/filter state; changing language reapplies sorting/filtering.
- **Add Business Unit (+):** opens the auxiliary name dialog; its save inserts an active unit, refreshes choices and selects the created unit. Cancel closes it.

### Business Rules
- Active lookup options are fetched for departments, positions, profiles, vacation codes, insurance, shift plans, document types, attendance types, business units, cost centers, currencies, and companies. Mapping rows supply cost-center/payroll-account relationships.
- Optional blank scalar fields are generally persisted as null. Salary is omitted entirely from unauthorized save payloads rather than overwritten with a blank.
- Vacation allocation editing concerns the current calendar year only. Remaining is `balance - used_days`; enabling a type does not automatically establish that the vacation setup's default days were allocated.
- Employee save replaces annual allocation records, not a row-by-row balance patch. Concurrent edits can overwrite allocation changes.
- Contact/document actions require a saved employee. A document type's mandatory flag is loaded, but the employee save handler does not require every mandatory document to exist.
- Deletion is not the recommended path for employees with payroll/timesheet history. Employment status and termination date are separate fields; the save handler does not automatically synchronize them.

### Dependencies
`EmployeeSetup.tsx`; `LanguageContext`; Supabase auth/tables/storage; React Router navigation/search parameters; `date-fns`; `xlsx`; profile and payroll-element pages; lookup setup pages. No direct function invocation or RPC.

### Database
- `employees`: UUID `id`; `employee_number`; attendance/payment external codes; nullable `user_id`; bilingual names; contact/demographic identifiers; photo reference; organization FKs (`department_id`, `job_position_id`, `working_business_unit_id`, `cost_center_id`, `company_id`); employment dates/status; manager self-reference; attendance/shift settings; payroll country, salary and currency; medical-insurance reference.
- `employee_vacation_types`: `id`, `employee_id`, `vacation_code_id`, `year`, `balance`, `used_days`, `custom_days`.
- `employee_contacts`: `id`, `employee_id`, contact type/name/phone/address, emergency flag, notes, timestamps.
- `employee_documents`: `id`, `employee_id`, `document_type_id`, file name/path/size, expiry date, notes, uploader and timestamps.
- Lookups: `profiles(user_id,user_name,email,is_active)`, `departments`, `job_positions`, `business_units`, `companies`, `cost_centers`, `business_unit_cost_center_mapping(business_unit_id,cost_center_id,payroll_dr_account)`, `currencies`, `vacation_codes`, `medical_insurance_plans`, `shift_plans`, `attendance_types`, `document_types`.
- Payroll display: `payroll_employee_elements(employee_id,amount,effective_from,effective_to,is_active)` joined to `payroll_elements(code,name_en,name_ar,element_type)`.

### Step-by-step Example
1. Click Add Employee and enter **Employee A** using fictitious first/last-name components; accept a generated employee number, represented here as **EMP-001**.
2. In Job Info, select **Department A**, **Position A**, **Example Company A**, and a start date.
3. In Shifts & Leave, choose **Attendance Type A**, enable **Annual Leave**, and enter a balance of **10** and used days of **0**.
4. Save the employee. Reopen the editor and add **Contact A**, using placeholder contact details.
5. Open Documents, select **Document Type A**, and upload a fictitious test document.
6. Search for EMP-001 and verify its directory entry. Do not use real employee data for training.

## 3. Employee Requests (`/employee-self-requests`)

### Purpose
Submit and review employee self-service requests. A logged-in user needs an associated employee record. Active HR managers can select any other employee; non-HR subordinate choices are derived from department descendants and position hierarchy. Lower numeric position levels represent higher positions in the selection logic. RLS remains the write boundary.

Supported types: Sick Leave, Vacation, Delay Request, Early Leave, Expense Refund, Experience Certificate, Penalty Deduction, Work From Home, and Other Request.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Request type | Type card / selected type | Yes | One of nine supported types | Vacation initially |
| Employee / on-behalf selection | Select | No | Self or permitted employee list | Self |
| Vacation Type | Select for leave | Not enforced by submit handler | Only allocations already assigned to target employee in current year | None |
| Available balance | Read-only number | N/A | Allocation balance minus used days | 0 without selected type |
| Start Date / End Date | Calendar dates for leave/WFH | Not enforced by submit handler | Total uses inclusive calendar-day difference; no comprehensive submit-handler range validation | Unset |
| Total Days | Calculated | N/A | End minus start plus one; 0 when dates missing | 0 |
| Delay / Early Leave Date | Calendar date | Not enforced by submit handler | Used for duration fallback lookup | Unset |
| Delay / Early Leave Minutes | Numeric state/input | No | Integer; falls back to relevant timesheet minutes when absent/nonfinite | Blank |
| Actual Arrival | Time | No | Optional time stored for delay/early-leave requests | Blank |
| Expense Amount | Number | Not explicitly checked in handler | Parsed as float | Blank |
| Expense Currency | Select | Not explicitly checked in handler | Loaded currency IDs | None |
| Expense Description | Textarea | Not explicitly checked in handler | Stored for expense request | Blank |
| Deduction Rule | Select | No | Loaded deduction rules | None |
| Deduction Amount | Number | No | Parsed float; blank becomes 0 | Blank |
| Violation / Deduction Date | Calendar date | No | Stored for penalty deduction | Unset |
| Reason / Notes | Textarea | No explicit handler check | Stored as reason | Blank |
| Attachment | File picker | Yes for sick leave and expense refund | Mandatory presence checked on Submit; no explicit upload size/type validation in handler | None |
| Request # / Employee / Type / Status / Date / Details / Action | Grid columns | N/A | Date is creation date; status badges localized | Loaded requests |
| Request detail / approval history | Read-only dialog | N/A | Conditional fields by type, attachment and workflow information | Selected request |

**TODO:** Some input labels may imply a requirement that is not enforced by `handleSubmit`. Do not treat the form as validating positive expenses, sufficient balance, date completeness, or overlap unless server-side constraints are independently verified.

### Actions
- **New Request** and each **request-type card:** reset fields and open the selected request dialog.
- **Employee selection:** reloads the target employee's current-year vacation allocations and clears the selected vacation type.
- **Calendar/date controls and selectors:** set local request state; the computed day count updates from dates.
- **Upload Attachment:** immediately uploads to `attachments` under `employee-requests/`, obtains a public-location value and retains the original file name for display. Expenses persist it as `expense_receipt_url`; sick leave and Other use `attachment_url`.
- **Submit:** checks required attachment presence, builds type-specific fields and approval-routing metadata, inserts `employee_requests`, closes/resets and refreshes. On-behalf submission records the submitter's employee ID in `submitted_by_id`.
- **Cancel / dialog close:** dismisses without inserting; an already uploaded attachment is not automatically deleted.
- **View details (eye):** opens read-only request details with `RequestApprovalHistory`; attachment links open the attachment.
- **Delete:** shown only for pending, manager-approved, or HR-pending requests; asks browser confirmation, deletes with an additional status filter and removes the row locally. It is a deletion, not a status change to cancelled.

### Business Rules
- Annual balances are only those already assigned to the target employee; no automatic allocation creation occurs here.
- Inclusive day count does not exclude weekends or holidays. Displaying an available balance is not an insufficient-balance enforcement check.
- Most requests route to an eligible direct manager when that manager is a department approver and is not the submitter. Otherwise a submitting department approver routes to the next greater `admin_order`; a non-approver routes to the first department approver.
- If there is no next departmental approver, requests enter the HR phase with manager-approved status. HR routing prefers payroll-country region, then unscoped HR managers, then all active HR managers.
- **Other** is explicitly created with `hr_pending`; this branch does not explicitly assign the HR phase/level. **TODO:** Verify database defaults/triggers reconcile this with approval eligibility.
- The immediate-HR submission branches pass the logged-in employee's payroll country rather than fetching the target employee's country. **TODO:** Confirm intended cross-country on-behalf routing.
- Delay/early-leave durations can be inferred from `timesheets`; display also has a fallback for older requests with no saved duration.
- No certificate generation, expense payment, or payroll posting is directly triggered by Submit.

### Dependencies
`EmployeeSelfRequests.tsx`, `src/lib/hrRouting.ts`, `RequestApprovalHistory`, Supabase auth/storage/tables, language context, `date-fns`, calendars/dialogs. The history component resolves workflow actor labels from profiles; `submitted_by_id` is an employee reference, while its profile lookup uses user IDs. **TODO:** Verify submitter-name resolution for on-behalf requests.

### Database
`employee_requests`: UUID PK; unique `request_number`; employee/type/status; department; reason; leave code/dates/day count; delay date/minutes/arrival time; expense amount/currency/description/receipt reference; deduction rule/amount/date; general attachment reference; phase/level; manager/HR approval actors/timestamps; rejection actor/time/reason; comments; submitter; creation/update timestamps. Structure also includes escalation tracking fields.

Supporting tables: `employees`, `departments(parent_department_id)`, `job_positions(position_level)`, `department_admins(department_id,user_id,approve_employee_request,admin_order)`, `hr_managers`, `employee_vacation_types`, `vacation_codes`, `currencies`, `deduction_rules`, `timesheets(employee_id,work_date,late_minutes,early_leave_minutes)`, `profiles`. Request-number generation is database-managed rather than an editable form field.

### Step-by-step Example
1. Open Vacation and leave Employee as Self (**Employee A**).
2. Select an assigned **Annual Leave** allocation.
3. Choose **2030-06-10** through **2030-06-12**; the page calculates **3** calendar days.
4. Enter **Example leave reason** and Submit.
5. View the request and its history. If still in an eligible pending state, Delete requires confirmation.

## 4. Request Approvals (`/employee-request-approvals`)

### Purpose
Review and process departmental and HR approval queues. Permissions are loaded from active `hr_managers` and `department_admins` rows with `approve_employee_request=true`. There is no standalone “admin role means approver” branch in `canTakeAction`.

HR business-unit assignments restrict the loaded employee scope; no assigned units means unrestricted units. Region-scoped HR managers see only employees with the same payroll country. Department access also depends on RLS; the request fetch itself does not add a department-ID filter for departmental approvers.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Type filter | Select | No | Supported request types or all | All |
| Status filter | Select | No | Pending groups pending/manager_approved/hr_pending | Pending queue |
| Employee filter | Select | No | Loaded request employees | All |
| From Date / To Date | Calendar filters | No | Local date filtering | Unset |
| # / Employee / Type / Status / Waiting For / Action | Grid columns | N/A | Waiting For resolves current-phase/level approvers | Loaded values |
| Employee / Department / Request Type / Status | Read-only detail fields | N/A | Joined employee/department labels | Selected request |
| Description / Notes / dates / duration / amount / deduction information | Conditional read-only details | N/A | Depends on type; duration fallback from timesheets | Stored or derived values |
| Attachments | Read-only links | N/A | Stored attachment/receipt reference | If present |
| Rejection Reason / Approval Comments / Approval History | Read-only details | N/A | Stored workflow data | If present |
| Approval Comment | Textarea in action dialog | No | Appended to prior comments with separator | Blank |
| Rejection Reason | Textarea in action dialog | Yes | Confirmation disabled when trimmed value is empty | Blank |
| Waiting For (reassign dialog) | Approver select | Yes for Save | Phase-specific eligible options | Selected/current choice |

### Actions
- **Type/Status filters:** trigger request reload; **Employee/date filters:** narrow displayed results. **Clear filters:** clears employee and date controls.
- **View Details:** opens read-only type-specific details/history; **Close** dismisses. Attachment controls open stored files.
- **Approve / Reject:** available only when `canTakeAction` passes; open an action dialog. Detail-dialog actions open the same workflow. **Confirm:** updates request status/level/actor metadata and applies final-approval side effects. **Cancel:** closes without update.
- **Reassign Waiting For:** opens an approver selector; Save updates only `current_approval_level` using the selected option's `admin_order`. It does not change employee/department/phase or record an explicit reassignment history row. Cancel closes.
- **Delete:** requests browser confirmation and deletes the request by ID. Unlike self-service deletion, its handler has no status predicate. **TODO:** Review deletion visibility and authorization as a distinct privilege from approval.

### Business Rules
- Approved, rejected, and cancelled requests cannot be actioned through `canTakeAction`.
- Department approvers must match both the request department and current manager level. HR approvers must match current HR level and, if scoped, payroll region.
- Manager approval moves to the next greater departmental order; at the end it moves to the first regional HR order with status manager-approved.
- HR approval moves to the next greater order in the selected HR chain; the final level sets approved. Actor/time fields retain the latest manager/HR action, not a full immutable record of every level.
- Reject records rejected status, actor, timestamp, and reason. Approve appends nonempty comments.
- Final sick-leave/vacation/WFH approval upserts inclusive dates in `timesheets`, marks not absent, sets status vacation or wfh, writes a leave label, clears late minutes, deduction rule, and deduction amount.
- Final WFH approval also upserts `employee_wfh_days` by employee/date with a request-derived description.
- If a vacation code is present, final dated leave approval increments current-year `employee_vacation_types.used_days` by request total days (fallback 1). It uses approval-time calendar year, not necessarily the request dates' year. There is no balance-sufficiency check here.
- Final delay/early-leave approval clears the relevant late/early minutes and deductions in matching timesheets. Matching `saved_attendance` deductions are cleared via employee ZK code and date, with an approval note.
- These are separate client-side writes, not one transaction. Several request updates do not inspect returned errors, and side-effect helpers log failures; a Done toast does not prove all dependent changes succeeded. No direct expense payment/certificate production/penalty payroll posting occurs here.

### Dependencies
`EmployeeRequestApprovals.tsx`, `hrRouting.ts`, `RequestApprovalHistory`, Supabase auth/table client, `date-fns`, language context and shared dialogs/calendar UI. No direct Edge Function or RPC invocation.

### Database
Reads/writes `employee_requests` workflow columns described above. Permission/routing sources: `department_admins`, `hr_managers`, `hr_manager_business_units(hr_manager_id,business_unit_id)`, `employees(working_business_unit_id,payroll_country,zk_employee_code)`, `profiles`, `departments`. Side effects target `employee_vacation_types(id,employee_id,vacation_code_id,year,used_days)`, `timesheets(employee_id,work_date,status,is_absent,notes,late_minutes,early_leave_minutes,deduction_rule_id,deduction_amount)`, `employee_wfh_days(employee_id,wfh_date,description)`, and `saved_attendance(employee_code,attendance_date,deduction_rule_id,deduction_amount,notes)`. `vacation_codes` supplies localized leave labels.

### Step-by-step Example
1. As **Manager A**, filter to pending vacation requests for **Employee A**.
2. Open request details and inspect fictitious dates and balance context.
3. Click Approve, enter **Example manager review**, and confirm; it advances to the next manager or HR level.
4. As **HR Approver A** at the current level, approve the final step.
5. Confirm approved status and inspect the dependent updates in the appropriate application screens; a three-day annual-leave request should increase the assigned current-year used days by three.

## 5. HR Manager Setup (`/hr-manager-setup`)

### Purpose
Configure active HR approvers, their region-specific approval sequence, and optional business-unit scope. The page does not hide all editing controls behind its own admin check. The HR-manager creation migration permits authenticated reads and restricts HR-manager insert/update/delete to users with the `admin` role. **TODO:** Reconcile later policies, especially for the business-unit link table, before relying on this as a complete security statement.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Region filter | Select | No | All, Egypt, KSA, and unscoped grouping as rendered | All |
| User (add dialog) | Profile select | Yes | Required; excludes users already registered as managers | None |
| Region (add / row) | Select | No | Egypt, KSA, or All Regions; All Regions stored as null | All Regions |
| Order / drag handle | Ordered list control | System-assigned | Zero-based within region, displayed as approval sequence | Next regional order |
| User name / email | Read-only row identity | N/A | Profile join | Stored profile values |
| Active | Switch | Yes in payload | Boolean | True on add |
| Business Units | Assignment badges / management dialog | No | Existing business units; checkbox selection | No links |
| Business Unit checkboxes | Boolean selection per unit | No | Set of selected unit IDs | Existing links |

### Actions
- **Add HR Manager:** opens the add dialog. **Add/Save:** requires a user, inserts an active `hr_managers` row, and uses the maximum order in the selected region plus one. Cancel/close dismisses.
- **Drag handle:** reorders managers; dropping between different region groups is rejected. Persists renumbered regional orders.
- **Region selector:** updates region (All Regions becomes null), renumbers the affected ordering state and persists orders.
- **Active switch:** immediately updates `is_active`; does not delete the approver.
- **Remove/trash:** deletes the HR-manager row and renumbers remaining managers. No separate removal confirmation is implemented in its handler.
- **Manage Business Units:** opens checkboxes preselected from existing links. Select-all/clear controls, where shown, change the local set. **Save:** deletes all old links then inserts selected links; Cancel dismisses without writing.
- **Region filter:** changes visible grouped rows.
- **Initial load:** also normalizes order numbering per region and may write corrected orders; opening this page is not guaranteed to be read-only.

### Business Rules
- A user may have only one `hr_managers` record; the database declares unique `user_id`.
- Ordering is independent per region, starts at zero, and is normalized after load/moves/removal. The first available regional HR level begins the HR workflow.
- No business-unit links means all units, not “no access.” Links restrict the approvals page's HR employee scope.
- Region routing prefers payroll-country matches, otherwise All Regions, otherwise all active HR managers. This routing fallback differs from the approvals page's strict filter for a region-scoped manager. **TODO:** Test the fallback when only mismatched regional managers exist.
- Business-unit replacement is not transactional; its initial delete is not checked for errors before insertion. Failures can leave an incomplete scope.
- Business-unit choices are loaded without the active-only filter used by Employee Setup.

### Dependencies
`HRManagerSetup.tsx`, drag-and-drop utilities (`@dnd-kit`), shared UI/language/toast, Supabase client. Consumers include `hrRouting.ts`, self-service submission, and Request Approvals.

### Database
- `hr_managers`: UUID PK `id`; unique required auth-user reference `user_id`; integer `admin_order` default 0; boolean `is_active` default true; nullable text `region`; creation timestamp.
- `hr_manager_business_units`: link identity and `hr_manager_id`, `business_unit_id` references.
- `profiles`: user ID/name/email for selecting and displaying approvers.
- `business_units`: `id`, English/Arabic unit names for scope selection.
- `user_roles(user_id,role)`: referenced by admin write policies.

### Step-by-step Example
1. Add **HR Approver A** with region **Egypt**.
2. Add **HR Approver B** in the same region, then drag B before A if B should review first.
3. Open B's business-unit dialog and select **Business Unit A**; Save.
4. Leave A without business-unit links only if A should have unrestricted unit scope.
5. Turn an approver inactive to exclude it from active HR routing without deleting the configuration.

## 6. Vacation Setup (`/vacation-setup`)

### Purpose
Maintain vacation-type definitions used by employee annual allocations and request details. The page itself has no explicit role gate; Supabase RLS determines permitted reads/writes. **TODO:** Verify the final vacation-code write policy before assigning this page to non-admin HR staff.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Code | Text; form and grid | Yes | Nonempty save-handler check; uppercased on change/save; no trim | Blank |
| Name (English) | Text; form and grid | Yes | Nonempty save-handler check; no trim | Blank |
| Name (Arabic) | Text; form and grid | No | Empty string stored as null | Blank |
| Description | Textarea; form only | No | Empty string stored as null | Blank |
| Default Days | Number; form and grid | No explicit handler requirement | Numeric input; UI minimum 0; handler does not separately reject negative values | 0 |
| Paid | Switch; grid check/cross | Boolean supplied | Boolean | True |
| Requires Approval | Switch; grid check/cross | Boolean supplied | Boolean | True |
| Active | Switch; grid check/cross | Boolean supplied | Boolean | True |
| Actions | Edit/delete grid controls | N/A | Subject to database authority | N/A |

### Actions
- **Add Type:** resets fields to the defaults and opens the create dialog.
- **Edit:** loads the selected vacation code into the same dialog.
- **Save:** requires Code and Name (English), uppercases the code, converts blank optional text to null, then inserts or updates `vacation_codes`. On success closes and reloads the ordered table.
- **Cancel / close:** dismisses the add/edit dialog without saving.
- **Delete/trash:** selects a code and opens a confirmation dialog. **Confirm Delete:** deletes by ID, closes and reloads; **Cancel:** retains the type.
- Database errors surface as error toasts; loading/empty states display in the grid.

### Business Rules
- The grid loads all vacation codes and sorts by code, not just active codes.
- Employee Setup offers active codes; self-service requests offer assigned annual allocations rather than every setup row.
- Default Days is metadata on the type, not proof that every employee received that allocation.
- Paid and Requires Approval are stored flags. The self-service and approvals pages documented here do not branch around the approval chain based on Requires Approval, nor calculate payroll based on Paid.
- No dedicated duplicate-name/code handling is implemented beyond surfacing database errors. Referenced types may fail deletion under database constraints; deactivation can preserve the definition.

### Dependencies
`VacationSetup.tsx`, Supabase table client, `LanguageContext`, shared table/dialog/switch/input controls, `sonner` toast. Consumed by Employee Setup, Employee Requests through annual allocations, and Request Approvals for leave labels. No direct RPC or Edge Function call.

### Database
`vacation_codes`: UUID `id`; text `code`, `name_en`; nullable `name_ar`, `description`; numeric `default_days`; booleans `is_paid`, `requires_approval`, `is_active`; creation/update timestamps. Referenced by `employee_vacation_types.vacation_code_id`, `employee_requests.vacation_code_id`, and legacy employee vacation configuration. Generated types distinguish required code/name from optional insert fields with database defaults.

### Step-by-step Example
1. Click Add Type and enter code **LEAVE-A**, English name **Example Annual Leave**, and Default Days **10**.
2. Leave Paid, Requires Approval, and Active enabled; Save.
3. Open Employee Setup for **Employee A** and explicitly enable/allocate this vacation type for the current year.
4. To retire the type later, Edit and switch Active off rather than deleting a referenced definition.

---

## 7. Timesheet Management (`/timesheet-management`)

### Purpose
Review, correct, approve, recalculate, export, and report employee attendance and its deduction/overtime consequences. Intended for HR and attendance managers. `checkCurrentUser` grants privileged editing to HR managers and specific hard-coded admin users. A non-master HR manager with business-unit assignments is scoped to those units; having no assignments leaves the scope unrestricted in this component. Other users can edit only employees with active monthly edit permissions. These are client-side controls, not a substitute for database authorization.

### Fields
Required means enforced by the page save handler; grid-only values are read-only. Defaults below describe a new form, not necessarily database defaults.

| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Filter By | Select | Yes for retrieval | Specific Date / Date Range / Full Month | Specific Date; restored from session storage |
| Date; Date From; Date To | Date inputs | Applicable dates | Missing applicable dates stops retrieval; no explicit range-order check | Today; restored values |
| Month | Month input | In month mode | Used to construct first/last day | Current month |
| Department | Hierarchical select | No | Includes descendant departments | All |
| Payroll Country | Select | No | All / Egypt / KSA | Saved filter, otherwise logged-in employee's country when available |
| Employee filter | Searchable combobox | No | Loaded active, scoped employees | All |
| Summary-card filter | Clickable cards | No | All / approved / waiting / absent / delay / early leave | All |
| Employee (entry form) | Select | Yes | Must be nonempty | Blank; existing employee on edit |
| Work Date | Date | Yes | Must be nonempty | Selected date |
| Scheduled Start; Scheduled End | Time | No | Browser time format | Attendance-type fixed times, falling back to employee fixed times when employee selected |
| Actual Start; Actual End | Time | No | Normalized to database time format on save | Blank |
| Changed Start; Changed End | Time | No | Override actual times for calculations, not storage of originals | Blank |
| Break Duration | Integer minutes | No | Numeric input; subtraction in engine | 0 |
| Absent | Boolean checkbox | No | Switches absence calculation/form visibility | False |
| Absence Reason | Text | No | Blank stored as null | Blank |
| Absence Notice | Three-state select | No | Unspecified / with notice / without notice; saved null if not absent | Unspecified |
| Notes | Textarea | No | Blank becomes null | Blank |
| Delay; Early Leave; Total Attendance | Calculated previews | No | Effective times and attendance grace; total preview clamps below zero | 0 |
| Manager Note | Dialog textarea | No | Blank becomes null; records author/time | Existing note or blank |
| Date (grid) | Date | — | Hidden for single-date mode | Stored date |
| Employee (grid) | Name/code | — | Joined employee identity | Joined value |
| Scheduled; Actual; Changed Time (grid) | Time pairs | — | Display original and override values separately | Stored/merged values |
| Work Hours; Late; Overtime (grid) | Duration | — | Stored or merged calculations | Calculated |
| Deduction Type; Deduction Value (grid) | Rule label; amount | — | Rule relation and calculated deduction | Stored/merged values |
| Mail Sent; Status; WFH (grid) | Indicators | — | Notification evidence, workflow state, WFH source | Record-dependent |
| Manager Note; Actions (grid) | Text; controls | — | Note and permission-dependent controls | Record-dependent |
| Print employee selection | Checkbox list | No | Select individual employees or select/deselect all | All grouped employees |
| Payroll months grid | Year/month, employee count, entry count, total, last sent, locked state/time | — | Aggregated relevant payroll variable entries | Loaded on opening |
| Payroll month details grid | Employee, employee number, payroll element, amount, notes, created time | — | Selected month's deduction elements | Loaded on demand |
| Frequent-lateness drilldown | Date, scheduled start, actual start, late minutes, deduction rule | — | Current-month late records excluding approved delays | Selected employee's records |

### Actions
- **Refresh:** reruns `fetchData`.
- **Recalculate:** opens confirmation showing current period/scope. **Cancel** closes; **Recalculate** iterates inclusive dates, calling edge function `process-zk-attendance` with `target_date`, `process_type: evening`, `send_notifications: false`, and optional `employee_ids`. Progress shows completed/total dates; failures are counted and records refreshed afterward. Disabled during loading/running.
- **Payroll deduction months:** opens `PayrollDeductionMonthsDialog`. **Refresh** reloads aggregates; a month's **Details** loads employee/element entries; **Confirm/Lock** and **Unlock** upsert `payroll_month_locks` on year/month, setting lock/unlock audit fields. This is separate from timesheet locking.
- **Export Excel:** creates a workbook from the currently sorted/filtered timesheets using ExcelJS and downloads it locally.
- **Print Attendance:** opens `AttendancePrintDialog`; employee checkboxes and **Select All/Deselect All** control employee pages; **Cancel** closes; **Print** opens the browser print workflow for selected employees.
- **Print Deduction Summary:** groups currently displayed sorted rows by employee, totals deductions/overtime and incident counts/minutes, and produces a printable summary.
- **Deduction Summary:** navigates to `/timesheet-management/deduction-summary` with current date/employee filtering information.
- **Resend Deduction Mails:** invokes `send-deduction-notification` with `target_date: selectedDate`, then refreshes. It is date-based even when another filter mode is displayed.
- **Confirm Month:** privileged control upserts `timesheet_month_locks` by `month_key`, sets confirmation actor/time, and deactivates all monthly employee edit permissions. **Unlock Month** clears confirmation and audit values.
- **Add Timesheet:** disabled for nonprivileged users; resets and opens entry dialog. **Edit** loads an editable row; **Save** validates employee/date, calculates values, and upserts `timesheets` on `employee_id,work_date`; **Cancel** discards the dialog. Manual saves set `changed_by/changed_at` and reset deduction-notification flags. No delete-timesheet action is implemented on this page.
- Row **Approve/Reject:** updates timesheet status with reviewer/time; virtual WFH rows update the underlying `wfh_checkins.status` instead.
- Row **Open/Close employee edit:** grants/revokes monthly `timesheet_edit_permissions` using month/employee conflict key; shown for privileged management.
- **Manager Note:** opens note dialog; **Save** writes note, author label, and timestamp to `timesheets`, or to underlying `wfh_checkins` for virtual WFH rows; **Cancel** closes.
- Click a summary card to filter; clicking its active category restores All. Click a frequently-late employee for the drilldown; **Close** dismisses it.
- Click sortable headers to switch direction; Ctrl/Cmd-click adds/toggles secondary sorts. Initial sort is date then employee ascending.
- Standard dialog close controls dismiss dialogs. Recalculation confirmation is not a background cancelable job once started.

### Business Rules
**Manual calculation engine (`calculateTimesheet`):**
1. Effective actual times are changed times when supplied, otherwise actual times. Schedule selection favors attendance type over employee fixed shift.
2. For absence, choose the first active absence rule matching notice; fall back to the first absence rule. Deduction is `(basic_salary / 30) × deduction_value`, regardless of the rule's deduction-type label. All time/overtime values are zero.
3. Nonabsence calculations require all four scheduled/actual endpoints. Late minutes = max(0, actual minus scheduled start minus allowed late minutes). Early leave = max(0, scheduled minus actual end minus allowed early-exit minutes).
4. Overtime = max(0, minutes after scheduled end − net late minutes − net early-leave minutes). Work minutes = actual end minus actual start minus break duration.
5. First matching inclusive late-arrival range wins. A falsey minimum means 0; a falsey maximum means infinity. No matching rule or value ≤ 0 clears rule and deduction.
6. With salary available: fixed deduction = rule value; percentage deduction = daily salary × value (a fraction, not divided by 100); hourly deduction = `(salary / 30 / 8) × (late_minutes / 60) × value`.
7. Overtime pay = hourly rate × overtime hours × first `is_overtime` rule's multiplier (fallback 1.5).
8. Early-departure rules are **not applied to monetary deductions by this manual engine**, although early minutes are calculated. All times are parsed on the same work date; unlike the preview, saved work minutes are not clamped. **TODO:** reconcile overnight shifts, negative saved duration, and early-departure deductions across engines.

**Retrieval and workflow:**
- Only active employees populate the form. Department selection includes descendants; employee selection takes precedence over department selection in retrieval/recalculation.
- Rows before an employee's job-start date are defensively hidden. Approved vacation, sick leave, WFH, delay, early-leave, and manually entered vacation information annotate/adjust the displayed attendance.
- Company-specific and recurring WFH days, employee WFH days, and WFH sessions are merged; WFH virtual rows need not already exist in `timesheets`. Shift-session information is loaded for display. Do not interpret every displayed row as a persisted timesheet.
- Frequent-lateness information is based on the current month rather than the selected filter period and excludes approved delay dates.
- Active month key is selected month, single date's month, or **range start's month**. Privileged users bypass `canEditTimesheet`; others require an employee permission, not merely an unlocked month. **TODO:** confirm intended multi-month-range lock behavior and enforce equivalent rules server-side.
- Recalculation sends no notifications; it uses a separate server engine, not the manual formula above. The server considers device punches, approved requests, shifts, weekends/holidays, WFH and authoritative manual changes. **TODO:** formally reconcile server/manual calculation differences before treating them as interchangeable.
- `buildFilterEmployeeIds` returns null for an empty department result and for unfiltered selection; the server call then omits employee IDs. Payroll-country and business-unit scope are not explicitly serialized in that payload. **TODO:** verify server-side scope prevents unintended broad recalculation.

### Dependencies
`src/pages/TimesheetManagement.tsx`; routes in `src/App.tsx`; `LanguageContext`; Supabase authentication/client; date-fns; ExcelJS; browser session storage, downloads and printing; `AttendancePrintDialog`, `PayrollDeductionMonthsDialog`, print-logo utility; edge functions `process-zk-attendance` and `send-deduction-notification`. No page-level RPC call. The notification function uses employee/user mail configuration and records delivery evidence; no credentials or service addresses are documented here.

### Database
Structure only; UUID record keys and created/updated timestamps are used where defined.
- `timesheets`: `id`, `employee_id`, `work_date` (upsert key pair), scheduled/actual/changed start/end time columns, break duration, absence/reason/notice, late/early/overtime/work minutes, deduction/overtime amounts, `deduction_rule_id`, status, approval/rejection audit fields, manual-change audit fields, notification flags/timestamp, notes and manager-note audit columns.
- `employees`: key, employee number, names, attendance type, fixed shifts, salary, user, department, job start, working business unit, payroll country, device code. `attendance_types`: schedule and grace settings. `deduction_rules`: ranges, rule type, value/type, absence flags and overtime multiplier.
- `departments`: key, name, parent key; `hr_managers(user_id)`; `hr_manager_business_units(hr_manager_id,business_unit_id)`; `profiles(user_id,user_name)`.
- `timesheet_month_locks(month_key,is_confirmed,confirmed_by,confirmed_at)`; `timesheet_edit_permissions(month_key,employee_id,is_active,granted_by)`.
- `employee_requests`: employee, request type/status, request/delay/start/end dates, vacation-code relation; `vacation_requests`: employee, dates, status, vacation code; `vacation_codes`: translated labels.
- `wfh_checkins`: user/date, check-in/out timestamps, status and manager-note audit; `company_wfh_days(wfh_date)`; `company_wfh_recurring(day_of_week,is_active)`; `employee_wfh_days(employee_id,wfh_date)`; shift-session tables supply assigned shift/session timing.
- `payroll_elements`: key, names, delay/absence flags, calculation type; `payroll_variable_entries`: employee/element, year/month, amount, notes, created time; `payroll_month_locks`: unique year/month, lock flag and actor/time audit.
- **TODO:** verify the deployed effective RLS and function authorization independently of frontend permissions; no database queries were performed for this document.

### Step-by-step Example
1. An authorized HR manager selects a sample month, Department A, and Employee A (`EMP-001`).
2. Click Add Timesheet; enter a sample date, schedule 09:00–17:00, actual 09:20–17:30, zero break, and save.
3. With 5-minute late grace, calculated late is 15 minutes and overtime is 15 minutes. At fake salary 10,000 EGP and a matching percentage value 0.25, the manual deduction is approximately 83.33 EGP.
4. Edit changed start to 09:00 and save to retain the original punch while recalculating from the correction.
5. Approve, add a manager note, select the employee in Print Attendance, and print. Confirm the month only after review; payroll-month locks are managed separately.

## 8. ZK Attendance Logs (`/zk-attendance-logs`)

### Purpose
Inspect and maintain raw device attendance punches, employee/day summaries and employee totals; approve raw records, save summary snapshots, and invoke attendance processing. Intended for attendance administrators. The page itself does not implement role-based hiding of edit/delete controls; Supabase RLS determines permitted writes. “Approve” here marks logs processed, not a timesheet approval.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| View | Toggle buttons | Yes | Detailed / Summary / Employee Totals | Detailed |
| Employee code search | Text | No | Case-insensitive substring filter | Blank |
| From Date; To Date | Calendar pickers | Both for saving summary; From for auto-process | Inclusive bounds; no explicit ordering check | Unset |
| Record Type filter | Select | No | All / entry / exit / unknown | All |
| Employee filter | Select | No | Employee device code | All |
| Attendance Type filter | Select | No | Matches employees' attendance-type IDs | All |
| Page size; page | Select; navigation | Yes in detailed view | Available page sizes; bounded previous/next | 50; 1 |
| Employee Code (edit) | Text | Yes | Nonempty; no employee-existence check | Selected log |
| Attendance Date (edit) | Date | Yes | Nonempty | Selected log |
| Attendance Time (edit) | Time, seconds enabled | Yes | Appends seconds to HH:MM | Selected log |
| Record Type (edit) | Select | Yes | Entry / Exit / Unknown | Selected log; initial unknown |
| Summary Date/employee | Read-only | — | Group identity cannot be changed in summary dialog | Selected group |
| Summary In Time; Out Time | Time, seconds enabled | No | Blank omits corresponding replacement punch | Selected group |
| Detailed grid | Code, employee name, attendance type, date, time, type, status, received time, actions | — | Stored log plus employee lookup | Loaded page |
| Summary grid | Employee name, date, in, out, total hours, difference, status, received time, actions | — | Grouped employee/day and synthetic absence/leave rows | Calculated |
| Employee Totals grid | Employee name, total days, present days, absent days, vacation days, worked hours, expected hours, difference hours, actions | — | Aggregated summaries | Calculated |
| Sort levels | Clickable headers/chips | No | Direction and priority; removable levels | Date descending |

### Actions
- **Detailed / Summary / Employee Totals:** changes view and resets page. Summary/totals load all filtered chunks rather than one detailed page.
- **Refresh:** reloads logs; **Export CSV:** downloads the current view's sorted records; **Print:** browser print output with print-only paginated layout, primarily summary/totals; per-employee **Print Employee Summary** prints that employee's report.
- **Save Summary:** requires both dates, nonempty summaries and an authenticated user. Generates a new batch key, upserts `saved_attendance` on `employee_code,attendance_date,batch_id`, then navigates to `/saved-attendance`. **Saved Attendance** navigates there without saving.
- **Morning / Evening auto-process:** requires From Date; invokes `process-zk-attendance` with that single date, corresponding `process_type`, and `send_notifications: true`. Other filters and To Date do not scope this request. Displays processed/notification counts and refreshes.
- **Delete All Filtered:** confirmation then direct deletion from `zk_attendance_logs` with current search/date/type/employee/attendance-type filters; not just visible page. **Cancel** dismisses. No date requirement protects this operation.
- Detailed row **Approve:** opens confirmation; **Confirm** sets `is_processed` and `processed_at`. **Edit** opens detailed editor; **Save** updates by key and requests the updated row, reporting failure if none is returned. **Cancel** closes. **Delete** opens confirmation and deletes the selected key.
- Summary row **Approve:** sets processed flag/time for all backing `log_ids`. **Edit** opens in/out dialog; **Save** deletes all backing logs, then inserts up to two replacement entry/exit punches. This is not a transactional update and can remove extra punches/raw metadata. Both blank times delete the group without replacements. **Delete** deletes all backing log IDs. Synthetic absent/vacation rows do not show these mutation buttons.
- Sort header click changes primary sort; Ctrl/Cmd-click adds/toggles secondary sorts. Sort-chip **X** removes that level; **Clear All** clears sorts.
- Calendar controls select dates; **Clear Dates** resets both. Page-size selection and **Previous/Next** reload the detailed page. Standard dialog confirmation/cancel/close buttons complete or dismiss pending actions.

### Business Rules
- Device employee code maps to `employees.zk_employee_code`; an unmatched punch can still exist and be shown.
- Summary/totals fetch chunks of 1,000 with a safety break beyond 50,000 offset; very large ranges may therefore be incomplete. Detailed view is server-paginated.
- Groups infer in/out from punches, calculate hours/expected duration and differences, and generate absence/leave information for a selected date range. Holiday eligibility uses attendance-type links and religion; fixed schedules and shift-based schedules are treated differently. **TODO:** verify all boundary cases for single unknown punches, cross-midnight grouping and weekend treatment against the operational policy.
- Expected start/end for late/early calculations are unavailable for shift-based types. Late = positive start difference; early exit uses an overnight adjustment when actual end is more than 12 hours before expected end. This page's saved-summary rule matching does not subtract attendance-type grace.
- Summary rule priority: absence rule for absence, otherwise first matching late-arrival range, then early-departure range. Bounds are inclusive and null means unbounded.
- Saved-summary `deduction_amount` is the rule's **raw deduction value**, not salary-converted money; it must not be confused with `timesheets.deduction_amount`.
- Each Save Summary creates a fresh batch; repeated saves can create separate snapshots for the same employee/day. Initial `is_confirmed` is false.
- Raw-log edits do not themselves run recalculation. Marking processed does not execute the attendance engine. No import/upload button exists here; device ingestion is handled outside the page by `api-zk-attendance`.

### Dependencies
`src/pages/ZKAttendanceLogs.tsx`, `LanguageContext`, Supabase, date-fns, browser CSV/download/print, navigation to saved attendance, edge function `process-zk-attendance`; upstream ingestion function `api-zk-attendance`. No direct RPC invocation in the page. **TODO:** validate deployed authorization for broad deletion and notification-producing processing calls.

### Database
- `zk_attendance_logs`: UUID key, `employee_code` text, `attendance_date` date, `attendance_time` time, `record_type`, JSON `raw_data`, `created_at`, `is_processed`, `processed_at`. Migration defines uniqueness on employee code/date/time and enables RLS.
- `employees`: device code, employee number, names, attendance-type key, attendance-signin requirement, religion. `attendance_types`: translated type names, fixed schedule, shift-based flag.
- `vacation_requests`: employee/code references, date range, status; `vacation_codes`: code and translated names.
- `official_holidays`: key, translated names, date, recurrence/year and religion; `holiday_attendance_types(holiday_id,attendance_type_id)`.
- `deduction_rules`: key, labels, type, bounds, deduction type/value, active flag.
- `saved_attendance`: employee code/date, in/out, actual/expected/difference hours, record status, leave label, notes, saved actor/time, filter bounds, batch key, confirmation flag, rule key and raw deduction amount.
- The processing function also reads/writes attendance, employee/request/shift/WFH and notification structures; it is not limited to raw log state.

### Step-by-step Example
1. Select a fake date range and Employee A's placeholder device code `DEVICE-001`.
2. Inspect Detailed punches; edit an incorrect sample time to 09:05:00 and save.
3. Switch to Summary and review in/out and difference. Use Edit only if replacing the entire day's punch set is intended.
4. Save Summary to create an unconfirmed snapshot and open Saved Attendance.
5. To process operational attendance, return and choose Morning or Evening; only From Date is sent and notifications are enabled.

## 9. Deduction Rules (`/deduction-rules-setup`)

### Purpose
Maintain reusable late-arrival, early-departure, absence and overtime rules used by attendance/payroll workflows. Intended for HR/payroll setup administrators. The component has no local role check; migrations contain authenticated-user and admin policies, so button visibility does not establish effective database privileges. **TODO:** confirm effective deployed RLS.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Rule Name | Text | Yes | Nonempty, not trimmed by handler | Blank |
| Arabic Rule Name | Text | No | Blank becomes null | Blank |
| Rule Type | Select | Yes | late_arrival / early_departure / absence / overtime | late_arrival |
| Min Minutes; Max Minutes | Number | No | Parsed integers; no range-order/overlap validation | Blank → null |
| Deduction Type | Select | Yes | fixed / percentage / hourly | percentage |
| Deduction Value | Number | Yes | Nonempty string then parseFloat; step 0.01; no enforced business cap | Blank |
| Is Overtime | Switch | No | Independent flag | False |
| Overtime Multiplier | Number | No | parseFloat; step 0.1 | 1.5 |
| Active | Switch | No | Boolean | True |
| Absence With Notice; Without Notice | Switches | No | Visible/applicable to absence; both can be true | False / False |
| Grid Rule Name | Text/badges | — | Translated fallback and absence-notice badges | Stored |
| Grid Type; Range; Deduction Type; Value; OT Multiplier; Active; Actions | Labels/numbers/status/buttons | — | Range displays unbounded endpoint; multiplier for overtime | Stored |

### Actions
- **Add Rule:** opens reset form; row **Edit** populates form.
- **Save:** checks rule name/value; inserts or updates `deduction_rules` by key, closes and refetches sorted by type/minimum.
- **Cancel/close:** dismisses add/edit without save.
- Row **Delete:** opens confirmation; **Delete** permanently deletes selected rule; **Cancel** dismisses. Errors are shown in a toast.
- No edge-function/RPC call or automatic recalculation is performed by these buttons.

### Business Rules
Blank optional names/ranges become null. Nonabsence saves force both notice flags false. The overtime switch and rule type are independent; consumers may select overtime by flag rather than type. No duplicate name, overlapping range, mutually exclusive notice, negative amount, or minimum-before-maximum check exists in the save handler. Zero entered as text passes required validation. Percentage interpretation is consumer-specific: the manual timesheet engine multiplies daily salary by the value directly. Editing rules does not retroactively update all attendance automatically. **TODO:** establish consistent percentage units and precedence for overlapping ranges.

### Dependencies
`src/pages/DeductionRulesSetup.tsx`, Supabase, `LanguageContext`; downstream timesheets, ZK summary saving and attendance-processing function.

### Database
`deduction_rules`: UUID `id`, `rule_name`, nullable `rule_name_ar`, `rule_type`, nullable integer min/max minutes, `deduction_type`, numeric `deduction_value`, `is_overtime`, numeric `overtime_multiplier`, active flag, notice booleans and timestamps. Attendance records reference the rule by `deduction_rule_id`; database references may prevent deletion.

### Step-by-step Example
1. Click Add Rule; name it Sample Late Rule and choose Late Arrival.
2. Enter 16–30 minutes, Percentage, value 0.25, and keep Active on.
3. Save, then edit to check the range. Use a fake Employee A timesheet to test the applicable engine's interpretation.
4. To retire the rule without removing references, edit and switch Active off.

## 10. Medical Insurance (`/medical-insurance-setup`)

### Purpose
Maintain medical-insurance plan definitions and contribution amounts for employee assignment. Intended for HR benefits administrators; no component-level role gate. Authenticated/admin policies occur in migrations. **TODO:** verify effective deployment permissions rather than assuming only visible admins can write.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Plan Name | Text | Yes | Nonempty; not trimmed | Blank |
| Arabic Plan Name | Text | No | Blank → null | Blank |
| Provider | Text | No | Blank → null | Blank |
| Coverage Type | Text | No | Free text, not controlled taxonomy | Blank |
| Max Coverage Amount | Number | No | parseFloat; no currency/range validation in handler | Blank → null |
| Employee Contribution | Number | No | parseFloat; no percentage or amount semantics enforced | Blank → null |
| Employer Contribution | Number | No | parseFloat | Blank → null |
| Includes Family | Switch | No | Boolean | False |
| Description | Textarea | No | Blank → null | Blank |
| Active | Switch | No | Boolean | True |
| Grid Plan Name; Provider; Coverage Type | Text | — | Arabic label falls back to English | Stored |
| Grid Max Coverage; Employee Contrib.; Employer Contrib. | Numeric display | — | Locale formatting; missing value shown as dash | Stored |
| Grid Family; Active; Actions | Indicators/buttons | — | Check/cross and edit/delete controls | Stored |

### Actions
**Add Plan** resets/open dialog; row **Edit** loads existing plan. **Save** validates name, inserts or updates `medical_insurance_plans`, closes and refreshes alphabetically. **Cancel/close** discards changes. Row **Delete** opens confirmation; confirmation **Delete** deletes by key; **Cancel** dismisses. No RPC, edge function, employee assignment, billing, or payroll recalculation is triggered here.

### Business Rules
Only plan name is application-required. Contributions and coverage limit are nullable numeric values; the page does not validate contribution totals, coverage eligibility or currency. Inactive plans remain visible in this setup grid. Employee assignment is managed elsewhere. **TODO:** define contribution units and any downstream payroll effect; the page does not establish them.

### Dependencies
`src/pages/MedicalInsuranceSetup.tsx`, Supabase and `LanguageContext`; employee insurance-plan selection downstream.

### Database
`medical_insurance_plans`: UUID key, translated plan names, nullable provider/coverage type/description, numeric nullable maximum coverage and employee/employer contributions, family and active booleans, timestamps. `employees.medical_insurance_plan_id` references the plan; the employee schema migration uses `ON DELETE SET NULL`.

### Step-by-step Example
1. Add Sample Plan A with Provider A and free-text coverage “Outpatient”.
2. Enter fake maximum 10,000 EGP, employee contribution 100 and employer contribution 300; enable Family.
3. Save and check the grid. Edit to deactivate when no longer available; assignment to Employee A occurs outside this page.

## 11. Document Types (`/document-type-setup`)

### Purpose
Define employee-document categories and mark categories mandatory or active. Intended for HR document administrators. No component-local role check; database migrations include authenticated and admin policy definitions. **TODO:** verify effective RLS for mutations.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Name (English) | Text | Yes | Nonempty; no trim/uniqueness check in handler | Blank |
| Name (Arabic) | Text | No | Blank → null | Blank |
| Mandatory | Switch | No | Boolean | False |
| Active | Switch | No | Boolean | True |
| Description | Textarea | No | Blank → null | Blank |
| Grid English Name; Arabic Name | Text | — | Separate translated-name columns | Stored |
| Grid Mandatory; Status | Badge/status | — | Required/optional and active/inactive | Stored |
| Grid Description; Actions | Text/buttons | — | Missing description placeholder | Stored |

### Actions
**Add Document Type** opens empty form; row **Edit** loads it; **Save** inserts or updates `document_types` by key then closes and refetches. **Cancel/close** dismisses. Row **Delete** opens a confirmation dialog; **Delete** removes selected type; **Cancel** dismisses. No upload, RPC or edge-function action occurs on this page.

### Business Rules
Mandatory is metadata consumed by employee-document workflows; this page does not upload files or verify an employee's compliance. Inactive categories remain in this grid. Referenced document types can be protected by database foreign keys. **TODO:** confirm downstream mandatory enforcement and desired referenced-type deletion policy.

### Dependencies
`src/pages/DocumentTypeSetup.tsx`, Supabase, `LanguageContext`, downstream employee-document UI/storage workflow.

### Database
`document_types`: UUID key, English/Arabic names, `is_mandatory`, `is_active`, nullable description, created/updated timestamps. `employee_documents`: key, employee reference, required document-type reference, and document metadata; this setup page writes only `document_types`.

### Step-by-step Example
1. Add “Sample Identity Document”, leaving Arabic name blank.
2. Enable Mandatory and Active and save.
3. Edit its description to “Sample onboarding category”.
4. Check Employee A's document workflow separately; no employee file was created by adding the category.

## 12. Attendance Types (`/attendance-type-setup`)

### Purpose
Configure fixed-schedule versus shift-based attendance, grace minutes and weekend days for employee attendance calculations. Intended for HR setup administrators. Controls have no local role gate; migrations include admin mutation policies and authenticated read policies. **TODO:** confirm effective RLS, including earlier policies with different scopes.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Type Code | Text | Yes | Nonempty; database unique code | Blank |
| Type Name | Text | Yes | Nonempty | Blank |
| Arabic Type Name | Text | No | Blank → null | Blank |
| Description | Textarea | No | Blank → null | Blank |
| Shift Based | Switch | No | If true, clears fixed start/end in saved payload | False |
| Fixed Start Time; Fixed End Time | Time | No | Available for non-shift types; no chronology check | Blank → null |
| Allow Late Minutes | Number | No | Integer parsing; falsey/invalid parse → 0; numeric UI | 0 |
| Allow Early Exit Minutes | Number | No | Integer parsing; falsey/invalid parse → 0 | 0 |
| Weekend Days | Seven checkboxes | No | Sunday=0 through Saturday=6; independently toggled | Friday/Saturday [5,6] |
| Active | Switch | No | Boolean | True |
| Grid Code; Type Name; Arabic Name | Text | — | Stored labels | Stored |
| Grid Shift Based; Fixed Times; Allowed Late; Allowed Early Exit; Weekend Days; Status; Actions | Badges/time/minutes/day labels/buttons | — | Fixed/shift rendering and selected weekdays | Stored |

### Actions
**Add Attendance Type** resets dialog; **Edit** populates all settings. **Save** checks code/name and inserts or updates `attendance_types`, closes and refetches by type name. **Cancel/close** discards changes. Weekday checkboxes add/remove day numbers; Shift Based toggles fixed-time inputs. Row **Delete** opens alert confirmation; **Delete** removes selected type by key; **Cancel** dismisses. No automatic timesheet recalculation, RPC or edge-function invocation occurs.

### Business Rules
Shift-based saves force fixed times null, even if previously entered. Grace values parse to integers; missing values become zero. Existing null weekend settings load as Friday/Saturday. An explicitly empty weekend array is retained. The page does not require a fixed schedule when not shift-based and does not check overlapping schedules or overnight intent. Employees reference attendance types; holidays can target attendance types. **TODO:** reconcile all consumers: manual timesheets subtract grace, whereas this ZK page's saved-summary rule matching does not.

### Dependencies
`src/pages/AttendanceTypeSetup.tsx`, Supabase, `LanguageContext`; employee setup, holiday/type associations, timesheet management, ZK log reporting and server processing.

### Database
`attendance_types`: UUID key, unique nonnull `type_code`, nonnull name, nullable Arabic name/description, shift-based and active booleans, nullable fixed time columns, integer late/early grace, integer-array `weekend_days`, created/updated timestamps. `employees.attendance_type_id` is a foreign key; `holiday_attendance_types` links holiday and attendance-type keys. Referenced deletes may fail according to the relation's delete behavior.

### Step-by-step Example
1. Add code `SAMPLE-DAY`, name “Sample Day Schedule”, leaving Shift Based off.
2. Set 09:00–17:00, late grace 5, early grace 0, and Friday/Saturday weekends.
3. Save and assign to Employee A elsewhere.
4. In a new sample timesheet, arrival at 09:12 produces 7 net late minutes in the manual timesheet engine. Existing records are not automatically recalculated by saving this type.

## 13. Job Setup (`/job-setup`)

### Purpose
Maintain job-position definitions, optional department association, and inspect linked employees/users. Intended for HR organization administrators. The component does not locally restrict mutation buttons by role; Supabase policies enforce access. **TODO:** verify effective deployed job-position policies.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Search | Text | No | Client-side matching of English/Arabic position names | Blank |
| English Name | Text | Yes | Trimmed; rejects whitespace-only | Blank |
| Arabic Name | Text | No | Trimmed; blank → null | Blank |
| Department | Select | No | Active departments; no department sentinel → null | None |
| Active | Switch | No | Boolean | True |
| Grid English Name; Arabic Name; Department; Status; Actions | Text/status/buttons | — | Department name resolved from loaded active departments | Stored |
| Linked Employees dialog | Employee number, employee name, linked-user indicator | — | Employees whose job-position key matches | Loaded on opening |
| Linked Users dialog | User name, email | — | Profiles whose job-position key matches | Loaded on opening |

### Actions
- **Add Job:** opens reset form. Row **Edit:** loads values. **Save:** validates/normalizes names and department, then inserts or updates `job_positions`; closes and reloads jobs. **Cancel/close:** discards edits.
- Row **View Linked:** opens linked-record dialog and queries `employees` and `profiles` by `job_position_id`; **Close** dismisses. This dialog is read-only, not an assignment editor.
- Row **Delete:** opens confirmation. Confirmation **Delete** first counts referencing employees and profiles. Either positive count blocks deletion with an explanatory toast; otherwise deletes selected job key and refreshes. **Cancel** dismisses.
- Search updates the displayed list locally. No RPC or edge function is called.

### Business Rules
English name is trimmed and required; Arabic name is trimmed/null. Department is optional and limited to active department choices. Inactive jobs remain visible. A stored association to a department missing from the active lookup can display as a dash. Deletion checks both employee and profile links, including links not shown by a text search. Count checks and deletion are separate requests, not an atomic reference check; foreign keys remain authoritative. The linked dialog does not grant/revoke jobs or roles. Although later schema additions include position-level metadata, this page does not edit it.

### Dependencies
`src/pages/JobSetup.tsx`, Supabase, `LanguageContext`, active department setup, employee and user-profile job assignment workflows.

### Database
`job_positions`: UUID key, English/Arabic position names, nullable `department_id` reference, active flag, timestamps; later migrations add `position_level` (default 0), not exposed here. Department reference uses `ON DELETE SET NULL`. `departments`: key, name, code, active flag. `employees`: key, employee number, names, `user_id`, `job_position_id`. `profiles`: `user_id`, `user_name`, email column, `job_position_id`. Other job-position references include shift-job links; the page only prechecks employees/profiles before deletion. **TODO:** verify behavior for references from those other tables.

### Step-by-step Example
1. Search for “Sample Analyst” to avoid accidentally creating another similarly named position.
2. Click Add Job; enter “Sample Analyst”, choose Department A, and save Active.
3. Assign the job to fake Employee A (`EMP-001`) using the employee workflow, then return and click View Linked.
4. Close the dialog and try Delete: the employee reference should block removal. Deactivate instead if the position must remain on historical assignments.

---

**Source basis:** routes in `src/App.tsx`; the seven corresponding `src/pages/*.tsx` implementations; `src/components/AttendancePrintDialog.tsx` and `PayrollDeductionMonthsDialog.tsx`; attendance/notification edge-function source; table definitions in `src/integrations/supabase/types.ts`; and relevant schema/RLS migrations under `supabase/migrations`. Documentation is source-based, not a runtime or database audit. All worked examples are fictional. No project files or database records were modified.

---

## 14. Vacation Calendar (`/hr-vacation-calendar`)

### Purpose
Maintain official holidays, their attendance-type eligibility, and monthly/yearly calendar views; review active employees grouped by attendance type. This is not an employee vacation-request calendar. Intended for HR administrators. The page itself has no `usePageAccess` guard or role-dependent action visibility; the holiday creation migration permits authenticated CRUD despite its admin-oriented comment.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Year filter | Integer select | Yes | Current year −2 through current year +3 | Current year |
| Attendance type filter | Select | No | All or an active attendance type | All |
| View | Toggle: list/calendar | Yes | Supported modes only | List |
| Display month | Calendar state | Yes | Previous/next/current month controls | Current month |
| Holiday Name (English) | Text | Yes | Nonempty; no trim/length validation | Empty |
| Holiday Name (Arabic) | Text | No | None in handler | Empty |
| From Date | Date | Yes | Nonempty | Empty |
| To Date | Date | No | Cannot precede From Date; HTML minimum follows start | From Date when omitted |
| Eligible Attendance Types | Checkbox list | Yes | At least one active type selected | None |
| Religion | Select | No | `all`, `muslim`, `christian`, `other` | `all` |
| Country | Select | No | `all`, `egypt`, `ksa` | `all` |
| Recurring Yearly | Switch | No | Boolean | False |
| Description | Text input | No | None | Empty; stored null when empty |
| Holiday grid: Date | Read-only date | — | Formatted stored date | Stored value |
| Holiday grid: Holiday Name | Read-only text | — | Arabic name falls back to English | Stored value |
| Holiday grid: Attendance Types | Read-only badges | — | Relationship lookup | Stored associations |
| Holiday grid: Type | Read-only badge | — | Recurring or one-time | Stored flag |
| Holiday grid: Actions | Buttons | — | Edit/delete | — |
| Calendar cells | Read-only dates/holiday highlights | — | Month/day matching for recurring holidays | Selected period |
| Employee cards | Name, employee number | — | Active employees only; grouped by attendance type, including Unassigned | Filtered employees |
| Summary cards | Holiday count, this-month holiday-day count, active employee count | — | Derived client-side | Loaded data |

### Actions
- **Add Holiday** resets and opens the form; **Edit** preloads one holiday and sets both dates to its date.
- **Save** validates, then updates one `official_holidays` row when editing. Creation expands the inclusive date range into separate daily rows, then inserts `holiday_attendance_types` links for each row. Editing replaces that row's attendance-type associations. Success closes and reloads.
- **Delete** asks for browser confirmation, deletes the selected holiday, and reloads.
- **Cancel / dialog close** dismiss without saving.
- **List / Calendar**, year and attendance-type selectors change the presentation/filter state. The year selector reloads holidays; the attendance filter changes employee groups/counts, not the holiday query.
- **Previous month / Today / Next month** change the monthly display. There is no RPC or edge-function call on this page.

### Business Rules
- Holidays are fetched where `year` equals the selected year **or** `is_recurring` is true. A recurring holiday stores `year = null`; a one-time holiday stores its date's year.
- Recurrence matches calendar month/day, not the original year. Adding a range creates independent holidays, not one range object; editing operates on one day only.
- Eligibility links are required on save. Religion and country are stored attributes; the page does not evaluate individual employee eligibility using them.
- The monthly holiday lookup uses the first matching holiday. Same-day records can therefore be collapsed in highlighting/counting even if multiple records exist.
- Holiday writes and association replacement are separate requests, not an atomic transaction. **TODO:** define rollback/recovery expectations for partial failures.
- Selected year and selected month are independent state. **TODO:** clarify expected behavior when navigating to a month outside the loaded year.

### Dependencies
`src/pages/HRVacationCalendar.tsx`; `YearlyCalendarGrid`; language context and Arabic date-fns locale; date-fns; Supabase client; Sonner; shared dialog/select/table controls. Schema references: `src/integrations/supabase/types.ts`, holiday creation and subsequent religion/country/attendance-link migrations.

### Database
- `official_holidays`: UUID `id` PK; required text `holiday_name`; optional `holiday_name_ar`; required date `holiday_date`; boolean `is_recurring` default false; nullable integer `year`; `description`, `religion`, `country`; creation/update timestamps. Country has an allowed-value constraint.
- `holiday_attendance_types`: `id`, `holiday_id`, `attendance_type_id`; links holidays to attendance types.
- `attendance_types`: `id`, `type_code`, `type_name`, `type_name_ar`, `is_active`.
- `employees`: `id`, `employee_number`, English/Arabic first and last names, `attendance_type_id`, `employment_status`; read only here.

### Step-by-step Example
1. Select a year and choose **Add Holiday**.
2. Enter “Sample Holiday,” a two-day future range, and attendance type “Office.” Leave recurrence off.
3. Save; two holiday rows and their Office eligibility links are created.
4. Switch to Calendar to inspect the highlighted dates.
5. Filter employees to Office and inspect the sample card “Employee A / EMP-001.” Edit one holiday day if necessary.

## 15. Company Hierarchy (`/company-hierarchy`)

### Purpose
Display and maintain a visual department/job/employee organization chart, including layout and additional visual assignments. Intended for organization administrators and viewers. Employee-profile editing is enabled for an `admin` role or `user_permissions.menu_item = employeeSetup` with `has_access = true`. This check does not gate every organization-chart write; there is no page-local `usePageAccess` guard. The hierarchy-assignment migration allows authenticated CRUD.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Department Name | Text | Yes | Trimmed, nonempty | Empty/new or existing |
| Department Code | Text | Yes | Trimmed, nonempty | Empty/new or existing |
| Parent Department | Select | No | Available department or none; own row excluded in edit selector | None for a root; invoking department for a child |
| Position X / Position Y | Number | No | Numeric input; no business range check | Computed initial position or stored coordinates |
| Department color | Palette selection | No | Offered colors | Existing color or chart fallback |
| Add Type | Existing/new job select | Yes for job creation | Supported modes | Existing |
| Select Job | Select | Conditional | Required in existing-job mode | Empty |
| Select Employees | Checkbox list | Conditional | At least one for existing-job assignment | None |
| Job Title | Text | Conditional | Trimmed, nonempty for new/edit job | Empty or existing |
| Job Department | Select | No | Department lookup | Invoking department |
| Department employee search | Text | No | Client-side filtering | Empty |
| Department employees | Checkbox list | Yes to submit assignment | At least one | None |
| Employee First Name / Last Name | Text | No explicit handler requirement | No nonempty validation in save handler | Selected employee |
| Employee Job Position / Department | Select | No | Lookup or none | Selected employee |
| Position hierarchy Level | Number | Yes per displayed position | Integer parsing; UI minimum 0 | Stored level, otherwise 0 |
| Chart node fields | Department name/code/color; job titles; employee names/photos and counts | — | Localized names with fallback; active employee query | Loaded values |
| Employee profile display | Photo, name, employee number, job, department, contact display where present | — | Read-only until permitted edit | Selected employee |
| Zoom / design lock | View state | No | Zoom bounded 0.3–2 | Zoom 1; locked |

### Actions
- **Lock/Unlock Design** enables/disables layout manipulation; it is a local design lock, not authorization.
- **Print** captures the chart using `html2canvas`, opens printable output, and invokes browser printing.
- **Auto Align** calculates a department-level layout and persists department coordinates. **Reset Positions** clears saved positions and regenerates layout. Both are disabled while locked.
- **Zoom In / Zoom Out** change the bounded display scale. Dragging an unlocked department persists `position_x`/`position_y` on mouse release. Palette choices update `departments.color` immediately.
- **Add Department / Add Child Department / Edit Department** open the department form; **Save** inserts or updates `departments`. **Delete Department** refuses a department with children or job positions, otherwise deletes it.
- **Add Job / Edit Job**, then **Save** create/update `job_positions`. In existing-job mode, Save resolves a same-name job in the target department if available, optionally attaches an unassigned job to that department, and updates selected `employees.job_position_id` and `department_id`.
- **Delete Job** refuses a job referenced by loaded employees, then deletes it.
- **Assign Employee to Job** opens the employee picker; clicking an employee upserts a `hierarchy_assignments` row using `(employee_id, department_id)` as the conflict key.
- **Assign Employees to Department** opens search/multi-selection; its submit button upserts assignments with a null job position.
- **Remove Employee** deletes the visual assignment; if the employee's legacy department matches, also clears the employee's department/job fields.
- **Position Hierarchy** opens `PositionHierarchyDialog`; **Up / Down**, or the numeric level input, adjust local levels; **Save** updates `job_positions.position_level`; **Cancel** discards local edits.
- Clicking an employee opens a profile. Authorized **Edit**, **Save**, and **Cancel** manage the editable employee fields; Save updates name, job, department and existing photo state, not email.
- Dialog close controls dismiss their dialogs. No page RPC or edge-function call is used.

### Business Rules
- Visual `hierarchy_assignments` are additional placements; they are not automatically the employee's canonical department/job. Existing-job assignment and legacy-removal paths do modify canonical employee fields.
- One visual assignment exists per employee/department pair; department-only assignment can replace the pair's job placement with null.
- Only active employees are loaded. Deletion checks therefore are not a complete database referential-integrity guarantee.
- Position levels are written to job-position records, including positions shown through cross-department employee relationships; they are not department-specific level overrides.
- **TODO:** confirm intended permissions for department/job/layout writes, and whether indirect parent cycles require prevention beyond the selector's self-exclusion.

### Dependencies
`CompanyHierarchy.tsx`; `PositionHierarchyDialog.tsx`; Supabase auth/client; `user_roles`, `user_permissions`; language context; html2canvas; shared avatar, palette/popover, dialog, select and checkbox components.

### Database
- `departments`: `id` PK; `department_name`, `department_name_ar`, `department_code`, nullable self-reference `parent_department_id`, `description`, `is_active`, `is_outsource`, `display_order`, `color`, nullable numeric `position_x`, `position_y`.
- `job_positions`: `id`, names, nullable `department_id`, `is_active`, nullable integer `position_level`.
- `employees`: `id`, employee number, names, department/job references, `photo_url`, `employment_status`, `user_id`, `email`.
- `hierarchy_assignments`: UUID PK, employee and department FKs with cascade deletion, nullable job FK with set-null deletion, timestamps; unique `(employee_id, department_id)`.
- `user_roles(user_id, role)` and `user_permissions(user_id, menu_item, has_access)` supply profile-edit authorization.

### Step-by-step Example
1. Add department “Sample Operations” with code “OPS-TEST.”
2. Add a new job “Sample Coordinator” to that department.
3. Use Assign Employee to Job and select Employee A, creating a visual placement.
4. Unlock the design, drag the department, then lock it again.
5. Open Position Hierarchy, set the sample job to level 1, and Save. Print the chart if needed.

## 16. Company News (`/company-news`)

### Purpose
Create and manage rich-text company announcements. Database policies grant administrators management access and authenticated readers access to published items. The page does not hide management buttons based on role and does not use `usePageAccess`; successful writes depend on RLS.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title | Text | Yes | Trimmed nonempty | Empty |
| Content | Rich text/HTML | Yes | `content.trim()` nonempty; does not test meaningful rendered text | Empty |
| Image upload | File | No | MIME starts with `image/`; no page size limit | None |
| Image reference | Text state with preview/removal | No | Set by upload; trimmed on save | Empty/null |
| Published | Switch | No | Boolean | False |
| News cards | Title, Published/Draft badge, creation date/time, optional image, HTML content | — | Newest creation first; HTML sanitized with DOMPurify for display | Stored values |

### Actions
- **Add News** opens an empty draft. **Edit** preloads a news item.
- **Upload Image** opens the file picker; selecting an image reads it as base64 and invokes `upload-to-cloudinary` with folder `company-news` and resource type `image`. The returned media reference populates the preview. **X / Remove Image** clears the form reference, not the remote asset.
- **Save** requires a signed-in user, validates title/content, then inserts or updates `company_news`; new rows use the current auth user as `created_by`. Closes and reloads on success.
- **Publish / Unpublish** directly toggles publication state and sets/clears `published_at`.
- **Delete** uses browser confirmation, deletes the row, and reloads; no remote-image deletion is triggered.
- **Cancel / dialog close** dismiss changes. Rich-text toolbar actions are local editor formatting actions, not database calls. No RPC is used.

### Business Rules
- Any save of a published item resets `published_at` to the current timestamp, even if the publication switch was unchanged. Draft saves clear it.
- The page requests all news; database visibility, rather than a page query filter, determines draft access.
- Sanitization is applied to rendered content; the saved content is the editor HTML.
- The upload uses an asynchronous FileReader callback; the outer `finally` can clear upload-busy state before the upload finishes. **TODO:** confirm intended save-during-upload behavior and upload callback error handling.

### Dependencies
`CompanyNews.tsx`; `RichTextEditor`; DOMPurify; date-fns; language context; Sonner; `upload-to-cloudinary` edge function. That function builds a signed media upload using server environment configuration. No credentials or endpoint values are reproduced here.

### Database
`company_news`: UUID `id` PK; text `title`, `content`; nullable media reference `image_url`; boolean `is_published`; nullable timestamp `published_at`; `created_by`; `created_at` and `updated_at`. Management policy uses `has_role(..., 'admin')`; published-read policy checks `is_published = true`.

### Step-by-step Example
1. As an authorized administrator, choose Add News.
2. Enter “Sample Office Update” and a paragraph of placeholder content.
3. Optionally upload a sample image; save with Published off.
4. Edit the draft, then use Publish. Confirm the badge changes.
5. Unpublish or delete the sample announcement after testing.

## 17. Department Management (`/department-management`)

### Purpose
Maintain departments, parent relationships, outsource classification, department administrators, members, and task phases. Intended for organizational administrators. The component has no page-local role/access guard; actions call Supabase directly, so database policies govern actual access. Administrator flags configure downstream responsibilities, not access to this page itself.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Department Name | Text | Yes | Zod minimum 2 characters; not trimmed by schema | Empty |
| Department Name (Arabic) | Text | No | Optional string | Empty/null |
| Department Code | Text | Yes | Zod minimum 2 characters | Empty |
| Description | Textarea | No | Optional string | Empty/null |
| Parent Department | Hierarchy picker | No | Cannot set own ID on edit | Null |
| Outsource Department | Switch/boolean | No | Boolean | False |
| Department search | Text | No | Client-side search | Empty |
| Normal / Outsource | Tabs | Yes | Classification filter | Normal |
| Add Administrator user | Profile picker | Yes | Not already an administrator in selected department | None |
| Purchase Admin on confirmation | Checkbox | No | Boolean | False |
| Requires Cost Center | Administrator switch | No | Boolean | Stored flag |
| Purchase Admin | Administrator switch | No | Boolean | Stored flag |
| Approve Employee Requests | Administrator switch | No | Boolean | Stored flag |
| Department Manager | Administrator switch | No | Boolean | Stored flag |
| Add Member user | Profile picker | Yes | Duplicate membership prevented | None |
| Task Phase Key | Text | Yes | Nonempty; lowercased and whitespace converted to underscores on save | Empty |
| Task Phase Name | Text | Yes | Nonempty | Empty |
| Task Phase Arabic Name | Text | No | None | Empty/null |
| Task Phase Color | Color input | No | Color picker | Blue (`#3B82F6`) |
| Department cards | Name, code, description/classification, administrator/member counts | — | Filtered department records | Loaded data |
| Administrator rows | User display, order, responsibility switches, remove action | — | Sorted administrator order | Loaded data |
| Member rows | User display and remove action | — | Department membership | Loaded data |
| Task phase rows | Name/key, Arabic name/color, drag handle, delete | — | Phase order | Loaded data |

### Actions
- **Add Department** opens the form; **Create/Save** inserts `departments`. **Edit** preloads it; **Save** updates the selected department. **Cancel / dialog close** discards form changes.
- Parent hierarchy nodes select a parent; hierarchy expand/collapse controls reveal descendants; the no-parent choice clears selection.
- **Normal / Outsource**, search, and department expand/collapse controls change visible cards/details.
- **Delete Department** opens confirmation; **Confirm Delete** deletes its administrator rows, then member rows, then the department. **Cancel** aborts. These requests are not transactional.
- **Add Administrator** opens a user picker; selecting a user opens confirmation with Purchase Admin choice. **Confirm/Add** inserts `department_admins` at maximum current order +1. Cancel closes confirmation without inserting.
- Administrator **Requires Cost Center**, **Purchase Admin**, **Department Manager**, and **Approve Employee Requests** switches update the corresponding boolean column immediately. Purchase-role changes also recalculate order.
- Dragging administrators reorders them, persisting `admin_order`; purchase and non-purchase groups are handled separately. **Remove Administrator** deletes the row and normalizes the remaining order.
- **Add Member** opens a picker; clicking an available profile inserts `department_members`. **Remove Member** deletes that membership.
- **Task Phases** opens `DepartmentTaskPhases`. **Add Phase** inserts a phase using maximum order +1. **Delete Phase** deletes it. Drag/drop persists `phase_order`. Dialog close dismisses it.
- No page or embedded management component invokes an edge function or RPC.

### Business Rules
- Department names/codes require two characters here, unlike the hierarchy page's nonempty rule.
- Edit explicitly blocks self-parenting; **TODO:** verify prevention of indirect department cycles.
- Department admins and members are separate relationships and are not equivalent to `employees.department_id`.
- Administrator and member additions reject duplicates within the target department. Administrator flags can coexist; the UI does not enforce a single manager or purchase administrator.
- Outsource classification controls which tab contains the department.
- **TODO:** confirm foreign-key behavior for children/jobs/tasks when deleting a department. The handler explicitly cleans administrators/members only and can leave partial cleanup if a later request fails.

### Dependencies
`DepartmentManagement.tsx`; `DepartmentHierarchy.tsx`; `DepartmentTaskPhases.tsx`; React Hook Form; Zod resolver; dnd-kit pointer/keyboard sorting; language/toast hooks; Supabase.

### Database
- `departments`: `id`, names, `department_code`, `description`, `is_active`, nullable `parent_department_id`, `is_outsource`.
- `profiles`: `user_id`, `user_name`, `email`; used to populate user pickers and enrich relationship displays.
- `department_admins`: `id`, `department_id`, `user_id`, integer `admin_order`, booleans `is_purchase_admin`, `requires_cost_center`, `is_department_manager`, `approve_employee_request`.
- `department_members`: `id`, `department_id`, `user_id` and relationship metadata.
- `department_task_phases`: `id`, `department_id`, `phase_key`, `phase_name`, `phase_name_ar`, `phase_color`, integer `phase_order`.

### Step-by-step Example
1. Create “Sample Support,” code “SUP-TEST,” with no parent and Outsource off.
2. Expand its card and add Employee A's sample user as an administrator.
3. Enable Approve Employee Requests and add Employee B's sample user as a member.
4. Open Task Phases; add key “initial review,” name “Initial Review.” The saved key becomes `initial_review`.
5. Add another phase and drag to reorder. Edit the department to choose a sample parent if needed.

## 18. Administrative Decisions (`/acknowledgment-documents`)

### Purpose
Manage bilingual acknowledgment/administrative-decision documents, recipients, approval assignments, recorded signatures, printing, and email distribution. English UI calls the page “Acknowledgment Documents.” `usePageAccess` requires authentication and the latest granted `acknowledgmentDocuments` permission; denied users see AccessDenied. Management operations additionally depend on RLS; the initial document/recipient management policies are admin-based. This page views signatures but does not itself collect a signature.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title (English) / Title (Arabic) | Text | At least one | Truthiness check, not trim | Empty |
| Content (English) / Content (Arabic) | Rich-text HTML | At least one | Truthiness check; no rendered-text validation | Empty |
| Active | Checkbox | No | Boolean | True |
| Requires Signature | Checkbox | No | Boolean | True |
| Recipient type | User / Job Position tabs | Yes | Determines inserted reference | User |
| Recipients | Multi-checkbox list | Yes to send | At least one; active users/jobs offered | None |
| Approvers | Multi-checkbox list | Yes to request approval | At least one new approver | None |
| Test email | Email input | Yes to send test | Handler requires trimmed nonempty value | Empty |
| Document grid | Title, active status, approval status, creation date, actions | — | Newest creation first | Loaded data |
| Current approvers | User, status, review information where available, remove | — | Existing document approver rows | Loaded data |
| Signature grid | Signed By, Signed At | — | Newest signing first; name lookup | Loaded signatures |
| View/print document | Localized title/content | — | Language fallback | Selected document |

### Actions
- **Add Document / Edit**, then **Save** insert/update `acknowledgment_documents`. Creating a row also starts a non-awaited normal `send-acknowledgment-email` invocation. Editing does not automatically send mail.
- **View** opens document content. **Print** calls `printAcknowledgmentDocument` and browser printing; the preview also offers printing/close controls.
- **Delete** asks for browser confirmation then deletes the document and reloads.
- **Send for Approval** opens `AcknowledgmentApprovalDialog`. **Send** inserts pending `acknowledgment_approvers`, then sets the document to `pending_approval`; **Remove** deletes an approver row. **Cancel** closes. No approval email function is invoked by this dialog.
- **Send To / Recipients** loads existing recipients and opens user/job selection. **Send** inserts new `acknowledgment_recipients`; it does **not** invoke the email function.
- **Signatures** loads `acknowledgment_signatures`, enriches signer names from active users, and displays them.
- **Test Mail** opens a test-address dialog; **Send Test** invokes `send-acknowledgment-email` with document ID, one supplied address, and `isTest = true`.
- **Send All Mail** invokes the same function with `isTest = false` and no explicit addresses. Normal mode resolves direct-user recipients and job-position recipients through `profiles`, adds fixed configured recipients, and deduplicates email addresses before SMTP delivery.
- All modal **Cancel / Close** controls dismiss their modal; selection checkboxes and editor formatting modify local state only. No RPC is called.

### Business Rules
- Missing English title/content is copied from Arabic and vice versa when saving; at least one title and one content value must exist.
- Active and Requires Signature are independent flags. Saving an edit does not reset approval status in the update payload.
- Approval sending is two separate requests, not a transaction. Removing approvers does not recompute document approval status in this dialog.
- Recipient inserts append; existing rows are not replaced. The recipient constraint requires a user or job reference. **TODO:** confirm intended duplicate-recipient handling.
- Normal email includes fixed recipients even if no document recipients have yet been assigned. Test mode uses only the supplied test addresses. No real addresses or delivery configuration are documented here.
- **TODO:** confirm server-side authorization requirements for email invocation and desired publication/approval gating; do not assume page permission alone secures the edge function.

### Dependencies
`AcknowledgmentDocuments.tsx`; `AcknowledgmentApprovalDialog.tsx`; `AcknowledgmentDocumentPrint`; `RichTextEditor`; `usePageAccess`; route-to-menu mapping; language context; date-fns; Sonner; `supabase/functions/send-acknowledgment-email/index.ts` and its SMTP environment configuration.

### Database
- `acknowledgment_documents`: UUID `id`; bilingual title/content; `is_active`, `requires_signature`; creator and timestamps; `approval_status`, `approved_at`, `approved_by`.
- `acknowledgment_recipients`: `id`, document FK, nullable `user_id`, nullable `job_position_id`, timestamp; at least one recipient reference must be non-null.
- `acknowledgment_signatures`: `id`, document/user references, `signed_at`, signing metadata; unique `(document_id, user_id)`.
- `acknowledgment_approvers`: `id`, `document_id`, `user_id`, `status`, `reviewed_at`, `review_notes`, `created_at`.
- `job_positions`: `id`, localized names, `is_active`; recipient options.
- `profiles`: `user_id`, `user_name`, `email`, `is_active`, `job_position_id`; recipient and email resolution.
- `user_permissions`: latest `has_access` for the route's menu key, read by the shared guard.

### Step-by-step Example
1. With the required permission and write role, add “Sample Safety Policy” and placeholder content in one language.
2. Save; fallback fills the other language and creation triggers normal email delivery, including fixed configured recipients.
3. Open Send for Approval, select Employee A's sample user, and send; inspect Pending Approval.
4. Add Employee B's sample user under Recipients. This creates recipient rows, not an email delivery.
5. Use Send All Mail when ready, then inspect Signatures later and print the sample document if required.

## 19. WFH Check-In (`/wfh-checkin`)

### Purpose
Allow a signed-in user with the latest granted `wfhCheckin` menu permission to record personal WFH sessions and close current or historical open sessions. `usePageAccess` redirects unauthenticated users to auth and displays AccessDenied for denied users. RLS permits users to read/insert/update their own check-ins; an admin policy also permits reading all, but this page's queries still filter to the current user.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Notes | Textarea | No | Trimmed; empty becomes null | Empty |
| Location | Browser geolocation, read-only state | No | High accuracy, 10-second timeout; permission failure does not block check-in | Null |
| User name | Read-only profile display | — | `profiles.user_name` lookup | Empty until loaded |
| Current time | Read-only clock | — | Cairo timezone | Updated every second |
| Today's sessions | Check-in/out times and status, checkout control | — | Current user's KSA date | Loaded sessions |
| History Date | Read-only date | — | Stored `checkin_date` | Stored value |
| History Check In / Check Out | Read-only times | — | Cairo timezone; missing checkout shown as dash | Stored values |
| History Status | Badge | — | Checked in / checked out | Stored status |
| History Notes | Read-only text | — | Empty shown as dash | Stored notes |
| History Action | End Session button for open records | — | Hidden for closed records | — |
| Check-out Date | Date input | Yes for manual ending | Must be present; combined timestamp must follow check-in | Record's check-in date |
| Check-out Time | Time input | Yes for manual ending | Cairo-local conversion; strictly after check-in | Current Cairo time |

### Actions
- **Check In** refuses another active session among today's loaded records, then inserts `wfh_checkins` with user, KSA date, optional notes/location, and browser user agent. Database defaults supply timestamp and checked-in status. Clears notes and refreshes today's/history queries.
- **Check Out** on a today's active session writes the current instant to `checkout_time`, sets `status = checked_out`, and refreshes both lists.
- **End Session** on an open history record opens manual date/time entry. **Save Check-out** converts Cairo local input to UTC, validates it against check-in, updates the record, and refreshes. **Cancel / dialog close** aborts.
- Geolocation is requested automatically after user resolution; it is not a prerequisite or a remote attendance-verification call. No edge function or RPC is invoked.

### Business Rules
- Multiple sessions per date are supported: a later migration removes the original unique user/date constraint.
- Only an active session in today's loaded records blocks a new check-in; an older unclosed session does not block it. This is a client-side check, not a database concurrency lock.
- History loads at most 60 records, sorted by date descending and time ascending within each date.
- Date grouping uses KSA helpers while displayed clock/session times and manual end input use Cairo. **TODO:** confirm expected behavior near midnight when those local dates differ.
- Manual ending must be strictly after check-in. The handler does not forbid future checkout times.
- No check against company WFH schedule, employee eligibility, allowed coordinates, or mandatory GPS exists here. The insert does not populate `ip_address`.

### Dependencies
`WFHCheckIn.tsx`; `usePageAccess`; `AccessDenied`; language/toast hooks; `src/lib/ksaTime`; browser geolocation/user agent; Intl timezone conversion; Supabase auth/client.

### Database
- `wfh_checkins`: UUID `id` PK; required `user_id`; date `checkin_date` default current date; timestamptz `checkin_time` default now; nullable `checkout_time`; text `status` default `checked_in`; nullable `notes`, double-precision latitude/longitude, `device_info`, `ip_address`; creation/update timestamps. Additional nullable `manager_note`, `manager_note_by`, `manager_note_at` exist but are not edited here.
- `profiles(user_id, user_name)` supplies greeting/display name.
- `user_permissions(user_id, menu_item, has_access, created_at)` supplies page access.

### Step-by-step Example
1. Sign in as Employee A's permitted sample user and open the page.
2. Optionally allow browser location and enter “Working on sample documentation.”
3. Click Check In; a current session appears.
4. Click Check Out when finished, then start a second session if needed.
5. For a leftover open record, click End Session and enter a Cairo-local checkout later than its check-in; save and verify Checked Out.

## 20. WFH Calendar (`/company-wfh-calendar`)

### Purpose
Maintain company-wide specific WFH dates, weekly recurring WFH weekdays, and employee-specific WFH exceptions. The component has no local `usePageAccess` or role-based button gating. Migrations allow authenticated reads, restrict company-wide/recurring writes to admins, and allow authenticated CRUD for employee-specific dates. It configures scheduling, not actual check-in sessions.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Display month | Calendar state | Yes | Previous/next month controls | Current month |
| Company WFH Date | Date input | Yes | Handler returns if empty; DB requires unique date | Empty |
| Company Description | Textarea | No | Empty becomes null | Empty |
| Recurring weekday | Seven switches | No | Sunday=0 through Saturday=6 | Stored active state, otherwise off |
| Employee | Searchable/select lookup | Yes for employee date | Active employee option; required with date | Empty |
| Employee WFH Date | Date input | Yes | Handler returns if empty; unique employee/date in DB | Empty |
| Employee Description | Textarea | No | Empty becomes null | Empty |
| Calendar cells | Day number, company WFH indicator, employee names | — | Sunday-first grid; localized employee names | Current month data |
| Company-specific table | Date, Description, delete action | — | Selected month, sorted date | Stored values |
| Employee-specific table | Date, Employee, Description, delete action | — | Selected month, sorted date | Stored values |
| WFH day count | Read-only number | — | Distinct company-specific plus active-recurring dates in month | Derived count |

### Actions
- **Back** navigates to the previous browser route. **Refresh** reloads all four source datasets; disabled while loading.
- **Add WFH Day** opens the company date dialog; **Add** inserts `company_wfh_days`, closes/resets on success, and refreshes.
- Each **Recurring weekday switch** updates an existing recurring row's `is_active` or inserts a new active row with that `day_of_week`, then refreshes.
- **Previous Month / Next Month** change the month and trigger reload.
- **Add Employee WFH** opens employee/date/description entry; **Add** inserts `employee_wfh_days`, closes/resets, and refreshes. Required-field conditions disable/short-circuit submission.
- **Delete** in either date table directly deletes the relevant company or employee WFH row and refreshes; there is no confirmation dialog in these handlers.
- Dialog close controls dismiss the corresponding forms. There are no edit, RPC, or edge-function actions on this page.

### Business Rules
- Company-specific and employee-specific records are queried within the selected month; recurring rules are loaded independently for all weekdays. Only active employees are offered for a new exception.
- A company WFH date is highlighted if it is a specific date or matches an active recurring weekday. Overlapping sources count as one company WFH day.
- Employee exceptions are rendered separately and do not increase the company-wide WFH day count.
- Company-specific dates are unique; recurring weekday values must be 0–6 and unique; employee dates are unique per employee/date. Duplicate insertion errors are surfaced as toasts.
- The UI does not enforce past/future limits or prohibit an employee exception on an existing company WFH date. Insert payloads omit `created_by`, leaving the nullable audit field unset unless another database mechanism supplies it.
- Fetch calls destructure data but not Supabase query errors; failed reads may appear as empty lists rather than an error toast. **TODO:** confirm desired error and permission-denial presentation.

### Dependencies
`CompanyWFHCalendar.tsx`; language/toast hooks; React Router navigation; date-fns; shared calendar-like grid, select/dialog/switch/table components; Supabase. Relevant migrations create company date/recurrence tables and `employee_wfh_days`; generated structure is in `src/integrations/supabase/types.ts`.

### Database
- `company_wfh_days`: UUID `id` PK; required unique date `wfh_date`; nullable `description`, nullable auth-user FK `created_by`; `created_at` default now.
- `company_wfh_recurring`: UUID `id` PK; required unique integer `day_of_week` constrained 0–6; required `is_active` default true; optional description/creator; creation timestamp.
- `employee_wfh_days`: UUID `id` PK; employee FK with cascade delete; required date `wfh_date`; optional description/creator; creation/update timestamps; unique `(employee_id, wfh_date)`; date and employee indexes.
- `employees`: `id`, English/Arabic first and last names, employee number, employment status; read for employee lookup and joined display.
- These tables are distinct from `wfh_checkins`; the page does not insert attendance records.

### Step-by-step Example
1. As an authorized administrator, enable the Monday recurring switch.
2. Add a sample company-specific WFH date and description “Sample remote-work day.”
3. Verify the month highlights both recurring Mondays and the sample date without double-counting overlap.
4. Add a separate date for Employee A / EMP-001 with description “Sample individual exception.”
5. Verify the employee appears in that date's cell and exception table. Delete the sample exception using its row action if no longer needed.

---

# Payroll administration — Part 4

Source basis: `src/App.tsx`, the seven corresponding `src/pages/Payroll*.tsx` files, `src/components/PayrollAccessGate.tsx`, `src/hooks/useHRBusinessUnitScope.ts`, `src/hooks/usePayrollMonthLock.ts`, `src/pages/DeductionSummary.tsx`, payroll migrations, `src/integrations/supabase/types.ts`, and the `fetch-sajel-chart-of-accounts` and `post-sajel-payroll` edge functions. Structure and behavior only; examples are fictional.

**Shared access:** All seven routes use `PayrollAccessGate`: specific hard-coded admin users or users registered in `hr_managers` can enter. Employee-oriented pages use `useHRBusinessUnitScope`: linked working business units restrict employees; a manager's region additionally filters `employees.payroll_country`. A manager with neither links nor region retains unrestricted legacy visibility. Setup and eligibility are not employee-scoped. Run headers and their totals are loaded globally; detail lines are employee-scoped. These client checks are not equivalent to database authorization: the foundational payroll migrations grant authenticated CRUD with permissive RLS. **TODO:** Validate deployment-specific security policies and edge-function authorization separately; the inspected edge handlers do not implement their own HR-role check.

**Shared conventions:** In field tables, “Display” means not an input, and “—” means no independent default/requirement. No page below invokes a Supabase RPC. Database writes are direct Supabase table operations unless an edge function is explicitly named. There is no transactional rollback across the sequential client writes described below.

# Part II — Payroll

## 21. Payroll Element Setup (`/payroll/element-setup`)

### Purpose
Maintain the earning, deduction, employer-contribution, and information element catalog and accounting mappings. Available to the shared payroll roles; catalog maintenance is global.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Code | Text; grid column | Yes | Nonempty client check; database unique; no trimming | Empty |
| Name (EN) | Text; grid column | Yes | Nonempty client check | Empty |
| Name (AR) | Text; grid column | No | Empty saved as null | Empty |
| Type | Select; grid badge | Yes | `earning`, `deduction`, `employer_contribution`, `information` | `earning` |
| Classification | Text | No | Free text; blank becomes null | Empty |
| Calculation Type / Calc | Select; grid column | Yes | `fixed`, `formula`, `variable`, `delay_minutes`; selector disabled when delay flag is on | `fixed` |
| Default Amount | Number; grid column | No | Step 0.01; numeric conversion with zero fallback; no nonnegative check | 0 |
| Sort Order | Number | No | Numeric conversion with zero fallback; database integer | 0 |
| Element Account | Searchable account selector; grid code/name | No | Options fetched from accounting; “No account” clears code and name | Empty/null |
| Account search | Text | No | Searches code/name in picker | Empty |
| Formula | Text | No | Free text; no formula validation/evaluation here | Empty/null |
| Delay Minutes | Switch; grid indicator | No | Forces deduction and `delay_minutes` on save | Off |
| Basic Salary | Switch | No | Database unique partial index permits only one flagged element | Off |
| Absence | Switch | No | Enabling sets type to deduction in form state | Off |
| Active | Switch; grid indicator | No | Boolean | On |
| Actions | Grid controls | Display | Edit/delete | — |

### Actions
- **New Element:** opens a reset creation dialog.
- **Edit (pencil):** opens the existing row in the dialog.
- **Delete (trash):** browser confirmation, then deletes the element and reloads. Referenced run lines can prevent deletion.
- **Element Account picker/search/select/No account:** chooses or clears the stored account code/name.
- **Refresh** inside account field: calls `fetch-sajel-chart-of-accounts`; this also runs at initial load. The function reads the latest ERP settings, fetches the chart, normalizes account code/name fields, and returns options. Errors show a destructive toast.
- **Save:** requires code/name, inserts or updates `payroll_elements`, closes and reloads on success; otherwise shows the error.
- **Cancel/dialog close:** closes without saving.

### Business Rules
- Rows sort by sort order, type, and English name. Default amounts display with two decimals.
- Delay mode is enforced at save even if other form state conflicts. Absence only sets deduction when toggled on; there is no corresponding save-time force in this page.
- Help text describes minute deduction as salary / 30 / 8 / 60 × minutes and absence as rule multiplier × basic salary / 30 × absent days. Actual payroll runs consume posted amounts rather than calculating attendance here.
- Formula text is stored, but `PayrollRun` does not evaluate it. **TODO:** Clarify intended formula engine; a formula element currently needs an assignment to generate a normal line.
- No period, month-lock check, currency conversion, or accounting posting occurs here.

### Dependencies
Shared payroll gate, Supabase client, language context, ERP setup and chart-of-accounts edge function; element consumers on subsequent pages.

### Database
- `payroll_elements`: UUID `id`; unique required `code`; required `name_en`, `element_type`, `calculation_type`; nullable `name_ar`, `classification`, `default_amount`, `formula`, `sort_order`, `element_account`, `element_account_name`; boolean special flags and `is_active`; creation/update timestamps.
- Unique partial index on the basic-salary flag allows one basic element.
- `sajel_erp_settings`: latest configuration selected by `updated_at`; sensitive connection values are not reproduced here.
- Eligibility and assignments reference elements with cascade deletion; run-line `element_id` restricts deletion.

### Step-by-step Example
1. Select **New Element** and enter fictional code `BASIC-DEMO`, name “Demo Basic Salary”, earning/fixed, amount 10,000 EGP.
2. Turn on Basic Salary only if no other element is flagged.
3. Choose a configured example account, then **Save**.
4. Verify the catalog row; edit the sort order if needed.

## 22. Element Eligibility (`/payroll/eligibility`)

### Purpose
Define job/department eligibility for an active payroll element. Shared payroll roles maintain global rules, not individual employee assignments.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Element | Select | Yes to add | Active catalog elements only; displays type/code/name | Unselected |
| Job Position | Select; grid badge | At least one filter | Existing job or All Jobs/null | All Jobs |
| Department | Select; grid badge | At least one filter | Existing department or All Departments/null | All Departments |
| Actions | Grid controls | Display | Delete rule | — |

### Actions
- **Element selection:** loads its rules.
- **Add:** rejects All Jobs plus All Departments; inserts a rule, resets both selectors, reloads.
- **Delete (trash):** immediately deletes the selected rule and reloads; no confirmation dialog.

### Business Rules
- Within a rule, non-null job and department must both match; multiple rules are OR alternatives in payroll computation.
- **TODO:** Resolve a direct contradiction: this page's empty state says “No rules — element applies to no one,” but `PayrollRun.computePeriod` treats zero rules as eligible for everyone. The latter is the implemented computation behavior.
- No duplicate-rule validation is implemented. Null means unrestricted on that dimension.
- This page does not assign amounts or enforce month locks.

### Dependencies
Active element catalog, job and department setup, shared gate and language context; eligibility is consumed by Payroll Run, not by the matrix editor.

### Database
- `payroll_element_eligibility`: UUID `id`; required FK `element_id`; nullable FKs `job_position_id`, `department_id`; `created_at`. All three parent references use cascade deletion in the foundational migration.
- Lookups: `payroll_elements(id, code, name_en, name_ar, element_type, is_active)`, `job_positions(id, position_name, position_name_ar)`, `departments(id, department_name, department_name_ar)`.

### Step-by-step Example
1. Select fictional element `ALLOW-DEMO`.
2. Choose “Demo Analyst” and “Demo Operations”.
3. Click **Add**; this rule requires both values to match.
4. Add a second department-only rule if another department should independently qualify.

## 23. Employee Element Assign (`/payroll/employee-elements`)

### Purpose
Assign persistent element values to individual employees or bulk-create missing employee/element pairs. Employee selection and bulk targets respect shared HR scope; employees are not filtered to active status by this page.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Employee | Select | Yes to add | Scoped employees; number and localized name | Unselected |
| Basic salary | Read-only summary | Display | Legacy employee salary; two decimals | 0 if missing |
| Element | Select; grid label/type | Yes to add | Active elements | Unselected |
| Amount | Number; editable grid number | No | Add uses `Number(value) || 0`; row edit saves `Number(value)` on blur; step 0.01 | New form: 0 |
| Effective From | Date; grid date | No | No date-order validation | Blank/null |
| Effective To | Date; grid date | No | No date-order validation | Blank/null |
| Active | Clickable grid badge | Display/control | Toggles boolean | True on insert |
| Actions | Grid controls | Display | Delete | — |

### Actions
- **Employee selection:** loads all assignments for that employee, ordered by creation time.
- **Add:** requires employee and element; inserts active assignment and resets element, amount and dates.
- **Amount blur:** immediately updates that row and reloads.
- **Active badge:** immediately toggles `is_active` and reloads.
- **Delete:** immediately removes assignment and reloads; no confirmation.
- **Assign All Elements to All Employees:** opens a confirmation dialog; cancel closes it, confirm creates every missing pair among scoped loaded employees and active elements. Existing pairs, including inactive ones, are skipped. Uses element defaults and inserts in chunks of 500. “Nothing to add” is reported when appropriate.

### Business Rules
- Bulk assignment does not apply eligibility rules and does not reactivate existing pairs.
- Choosing an individual element does not automatically populate its default amount; the add form starts at zero. Bulk assignment does use defaults.
- Effective dates are stored/displayed but ignored by the inspected matrix, preview, and run calculations. **TODO:** Confirm whether effective dating should be enforced.
- Duplicate individual assignments are not blocked here. Preview sums active duplicates; run computation generally uses the first matching assignment. **TODO:** Define uniqueness/duplicate handling.
- No month lock is checked: these are ongoing values, not period records. Sequential bulk writes can partially succeed. Inline update/delete handlers do not surface returned errors explicitly.

### Dependencies
Shared employee scope; employee and active element masters; language context; confirmation dialog for mass assignment only.

### Database
- `payroll_employee_elements`: UUID `id`; required employee/element FKs; numeric `amount` default 0; nullable dates `effective_from`, `effective_to`; `is_active` default true; nullable `notes`; timestamps. Parent employee/element deletion cascades.
- `employees`: `id`, employee number, localized names, `basic_salary`; scope uses working business unit and payroll country.
- `payroll_elements`: `id`, code/name/type, active flag, default amount.

### Step-by-step Example
1. Select Employee A (`EMP-001`).
2. Select fictional `ALLOW-DEMO`, enter 500 EGP, and optionally an effective start date.
3. Click **Add**.
4. Change the grid amount to 600 EGP and leave the field to save.
5. Click the active badge to deactivate the assignment if required.

## 24. Multi Element Entry (`/payroll/matrix-entry`)

### Purpose
Spreadsheet-style maintenance of persistent employee element assignments. Shared payroll roles see scoped employees; all active elements can be edited regardless of eligibility or calculation type.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Search | Text | No | Space-separated terms must all match employee/name/department/job text | Empty |
| Department, Job, Status | Multi-select checkbox filters | No | Options derived from loaded employees | All |
| Elements | Multi-select column filter | No | Active elements | All |
| Import file | File | For import | Spreadsheet first sheet; supported workbook formats via picker | None |
| Employee | Grid text | Display | Localized name | Master data |
| Number | Grid text | Display | Employee number | Master data |
| Department | Grid text | Display | Lookup label | Master data |
| Job | Grid text | Display | Lookup label | Master data |
| Each active element | Editable decimal grid column | No | Blur removes commas; invalid/empty converts to 0; negatives allowed | Existing active assignment or blank |
| Column totals | Grid footer | Display | Sums shown employee rows | Calculated |

### Actions
- **Save All:** persists every dirty cell in matrix state, including cells hidden by filters. Existing IDs update one by one; missing cells insert active assignments. Clears dirty flags after success.
- **Template:** downloads a blank workbook using scoped employee rows and active element columns; no active elements produces a notification.
- **Import:** opens file picker, reads first worksheet, maps first column by employee number and columns from index 2 by exact element code. Optional names subheader is skipped if its first cell is blank. Unknown employees/columns are reported; blank or nonnumeric amounts are skipped. Marks cells dirty only; **Save All** is required.
- **Export:** downloads a workbook populated from current matrix state.
- **Print:** opens a landscape print document with current sorted employees, visible columns and totals; reports empty result or blocked popup.
- **Filter buttons/checkboxes/Clear:** update or clear each selection. **Clear Filters** resets filter state.
- **Column headers:** toggle ascending/descending sorting; Shift-click adds or changes multi-column sort precedence.

### Business Rules
- Not a monthly editor: no year/month, lock, eligibility filtering, effective-date filtering, currency conversion, or payroll confirmation.
- Only active assignments are loaded. Creating a cell when an inactive row already exists can create a second assignment rather than reactivate it.
- Blank imported cells do not delete or zero existing values. Manual blank commits zero, not deletion.
- Saves are not transactional; earlier updates can remain after a later failure. No database rollback or edge function is called.

### Dependencies
Employee scope, active elements, `xlsx`, browser file/download/print support, top horizontal scrollbar, department/job labels.

### Database
- Reads `employees(id, employee_number, localized names, department_id, job_position_id, employment_status)` joined to departments and job positions.
- Reads `payroll_elements(id, code, names, element_type, default_amount, sort_order, is_active)`.
- Reads/writes `payroll_employee_elements(id, employee_id, element_id, amount, is_active)`; new rows use other database defaults.

### Step-by-step Example
1. Filter to “Demo Operations” and locate Employee A (`EMP-001`).
2. Enter 10,000 in a basic element and 500 in an allowance column; leave each cell.
3. Click **Save All**.
4. Download **Template**, fill a fictional employee/element value, and **Import**.
5. Review dirty cells before saving again; export or print for review.

## 25. Variable Element Entry (`/payroll/variable-entry`)

### Purpose
Enter period-specific amounts for active elements whose calculation type is `variable`. Scoped HR payroll operators use it for monthly values rather than recurring assignments.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Year | Number | Yes for period | Converted to number; no explicit year-range validation | Current year |
| Month | Select | Yes | 1–12 | Current month |
| Search | Text | No | All space-separated terms match employee metadata | Empty |
| Department, Job, Status, Payroll Country | Multi-select filters | No | Loaded employee metadata | All |
| Elements | Multi-select column filter | No | Active `variable` elements only | All |
| Import file | Spreadsheet file | For import | First sheet; employee-number and element-code mapping | None |
| Employee, Number, Department, Job | Grid text columns | Display | Master data labels | Master data |
| Each variable element | Editable decimal grid column | No | Commas removed on blur; blank/invalid becomes 0; no sign restriction | Existing period entry or blank |
| Totals | Grid footer | Display | Visible employee amounts | Calculated |

### Actions
- **Save All:** freshly checks `isPayrollPeriodLocked`; rejects locked periods, updates existing dirty entries sequentially, inserts new entries with selected year/month, then clears dirty state on success.
- **Template / Import / Export:** workbook operations parallel matrix entry. Import is a staged edit, not immediate persistence; unknown employees/columns are skipped/reported and blank/nonnumeric amounts ignored.
- **Print:** opens a landscape period-specific report with logo, visible employee rows/columns and totals.
- **Filter buttons / checkbox selections / per-filter Clear / Clear Filters:** adjust the display only. Column clicks toggle sort; Shift-click enables multi-sort.
- **Year/month selection:** reloads entries for that period. There is no copy-previous-month button and no row-delete action in this page.

### Business Rules
- Entries are period-specific; they do not alter ongoing assignment amounts.
- Displayed lock state disables saving, and save performs a fresh database lock read. Cell/import draft edits are not equivalent to successful database writes.
- Zero is stored, not deleted. Changes not saved before changing period are replaced by the reload; no unsaved-change confirmation is implemented.
- Eligibility is not checked here; Payroll Run applies eligibility later. Employee status is only an optional filter here.
- Saves are nontransactional. **TODO:** Establish uniqueness guarantees for employee/element/period; the foundational table has no unique constraint on that combination.
- No currency conversion or attendance calculation occurs here.

### Dependencies
Shared employee scope, month-lock hook/helper, variable element catalog, `xlsx`, print logo helper, browser workbook and popup support.

### Database
- `payroll_variable_entries`: UUID `id`; required employee/element FKs, integer `period_year`, integer `period_month` checked 1–12, numeric `amount` default 0; nullable notes; timestamps. Parent deletion cascades.
- `payroll_month_locks`: period pair and `is_locked` read for guard checks.
- Employee, department, job and element masters as in matrix entry; employee includes `payroll_country`.

### Step-by-step Example
1. Select a fictional open June payroll period.
2. Find Employee A (`EMP-001`) and enter 750 EGP under `BONUS-DEMO`, configured as variable.
3. Click **Save All**.
4. Export or print to review. If the month is locked, ask an authorized payroll operator to unlock it in Month Element Preview before retrying.

## 26. Month Element Preview (`/payroll/month-preview`)

### Purpose
Review monthly employee element amounts, calculate and persist basic-salary proration, and lock/unlock a payroll month. Available to shared payroll roles with scoped employee rows; the month lock itself is global, not business-unit-specific.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Year / Month | Number / select | Yes | Month 1–12; year number conversion | Current period |
| Search | Text | No | All space-separated terms match metadata | Empty |
| Employee, Department, Job | Searchable multi-select filters | No | Loaded scoped options | All |
| Status, Payroll Country | Multi-select filters | No | Loaded metadata | All |
| Element Type | Multi-select | No | Earning, deduction, employer contribution, information | All |
| Elements | Searchable multi-select | No | Active elements | All |
| Hide zero employees | Checkbox | No | Hides rows without nonzero visible-element values | Off |
| Employee, Number, Department, Job | Read-only grid columns | Display | Employee/lookup metadata | Master data |
| Each visible element | Read-only numeric grid column | Display | Assignment/period value with proration rules | Blank for zero |
| Net | Read-only grid column | Display | Earnings less deductions | Calculated |
| Element totals / summary amounts | Read-only totals | Display | Current filtered population | Calculated |
| Month lock status | Badge/audit information | Display | Stored lock record | Unlocked if no record |

### Actions
- **Refresh:** reloads source amounts for selected period.
- **Export:** downloads the current review data as a workbook.
- **Calculate Basic Salary:** rejects locked month; calculates filtered employees' basic amounts, deletes their old basic-element period overrides, then inserts prorated overrides. Full-month employees have old overrides cleared without replacement. Reloads after completion.
- **Print:** opens the preview report for current filtered/sorted rows and visible element columns.
- **Lock Month / Unlock Month:** opens confirmation; cancel leaves unchanged. Confirm locks by period upsert or unlocks by period update and records actor/time. Refreshes lock state.
- **Filter buttons / Clear selections / Clear Filters / Hide zero checkbox:** update visible employees/columns. Column header clicks sort; Shift-click combines sorts.

### Business Rules
- Active recurring assignment amounts are summed per employee/element. A selected-period variable entry then **overrides**, rather than adds to, that amount. The preview reads all active elements, not just variable ones.
- Effective assignment dates and eligibility rules are not applied. This is not the same calculation pipeline as Payroll Run.
- Basic salary uses the flagged element's assignment amount, falling back to `employees.basic_salary` when zero/missing. Read-time proration does not replace an existing period override.
- Fixed payroll divisor is 30. Effective start is later of month start/job start; effective end is earlier of actual calendar month end/valid termination date. Day numbers cap at 30; inclusive worked days clamp to 0–30. Amount = salary / 30 × worked days, rounded to two decimals. Termination dates at or before year 1900 are ignored.
- **TODO:** Confirm February policy: the implementation's day-number calculation yields 28/30 or 29/30 even for a whole calendar February.
- Employees terminated before the month or joining after month end are hidden. An employee terminated during the month can appear here, unlike Payroll Run's status-based exclusion.
- Calculate Basic Salary explicitly deletes existing basic-element overrides for eligible filtered targets with positive salary; manual overrides can therefore be overwritten/removed. Delete and insert are separate operations without a transaction; failure may leave deleted values absent.
- Lock record blocks guarded variable saves, basic recalculation, deduction posting, run computation/confirmation/rollback. It is separate from run status. Recurring assignment/setup editors do not consult it. **TODO:** Do not interpret lock help text as proof every possible write path is protected; inspect security and all callers.
- Attendance deduction window, upstream in `DeductionSummary`, is previous month's 26th through selected month's 25th. Basic salary still uses the calendar-month boundary and 30-day divisor. Preview does not recalculate attendance or exchange currencies.

### Dependencies
Shared employee scope; month-lock hook; employee start/termination dates; flagged basic element; recurring and monthly values; upstream Deduction Summary; `xlsx` and browser print support.

### Database
- Reads `employees`: identity/display fields, department/job/status/country, `job_start_date`, `termination_date`, `basic_salary`.
- Reads `payroll_elements`: active flag, names/code/type/calculation, sort order and basic flag.
- Reads `payroll_employee_elements(employee_id, element_id, amount, is_active)` and `payroll_variable_entries(employee_id, element_id, period_year, period_month, amount)`; recalculation deletes/inserts the latter with explanatory `notes`.
- `payroll_month_locks`: UUID PK; unique `(period_year, period_month)`; `is_locked`, lock/unlock actor UUIDs and timestamps, nullable notes, creation/update timestamps.

### Step-by-step Example
1. Choose a fictional June period and filter to Employee A (`EMP-001`).
2. Assume basic salary 10,000 EGP and a June 16 start. Worked days are 15; preview prorates to 5,000 EGP.
3. Click **Calculate Basic Salary** to persist that override after reviewing overwrite implications.
4. Export/print, then **Lock Month** and confirm when review is complete.
5. Use **Unlock Month** and confirm before any guarded correction.

## 27. Payroll Run & Confirm (`/payroll/run`)

### Purpose
Compute draft payroll, inspect and print payslips, confirm runs, prepare/post Sajel AP invoices, and perform local rollback. Shared payroll roles can access the page. Employee computation and line detail use HR scope, but run headers/totals and accounting invoice assembly are not restricted to that line-detail subset.

### Fields
| Name | Type | Required | Validation | Default |
|---|---|---|---|---|
| Year | Number | Yes | Numeric conversion; no explicit range | Current year |
| Month | Select | Yes | 1–12 | Current month |
| Employees | Searchable multi-select scope | No | Scoped non-terminated employee options | All |
| Departments / Jobs | Multi-select scope | No | Lookup options; intersection with employee selection | All |
| Scope search | Text in searchable picker | No | Case-insensitive option matching | Empty |
| Period | Run grid text | Display | Year/month | Stored |
| Status | Run grid badge | Display | Draft or confirmed | Draft on creation |
| Employees | Run grid count | Display | Distinct employees with run lines | Computed |
| Gross / Deductions / Net / Employer Contrib. | Run grid amounts | Display | Totals across all run lines | 0 initially |
| SAR Rate | Inline number | No | Step 0.000001; blank saves null; otherwise finite and greater than zero; blur saves | Stored/null |
| Actions | Run grid controls | Display | Depends on status/sent state | — |
| Employee detail | Group heading and totals | Display | Scoped loaded run lines | Stored lines |
| Element / Type / Minutes / Amount | Detail grid columns | Display | Minute values may be null; two-decimal amounts | Stored lines |
| Status in all bodies | AP preview select | Yes for send body | `POSTED` or `DRAFT`; updates every assembled invoice | `POSTED` |
| Invoice body / warnings / currency totals / SAR total | AP preview read-only content | Display | Generated from full run and mappings | Generated |
| Result status / duration / response | AP results | Display | Per-invoice integration response | None |

### Actions
- **Compute:** fresh period-lock check, loads scoped employees and source configuration, builds or replaces draft lines, inserts in batches of 500, recomputes global run totals and reloads headers. Rejects confirmed period or empty employee scope.
- **Scope picker buttons/search/checkboxes/Clear; Clear scope:** select computation target; no extra selection means all available employees.
- **View:** loads selected run's scoped detail lines.
- **SAR Rate blur:** updates the run's optional exchange-rate override directly; no month-lock/status guard is present in this handler.
- **Confirm:** confirmation dialog, fresh month-lock check, sets status confirmed plus `confirmed_at` and `confirmed_by`. Prevents subsequent recomputation; does not create a `payroll_month_locks` row.
- **Delete draft (trash):** confirmation, deletes run with cascading lines, clears selected detail. This handler does not perform the explicit month-lock check used by rollback.
- **Rollback** (draft or confirmed): confirmation then fresh lock check; explicitly deletes all run lines and then the run. This is destructive deletion, not conversion to draft.
- **Print All Payslips / employee Print:** browser print popup for all loaded detail employees or one group. Nonconfirmed runs have draft watermark; earnings, deductions, other elements and net are rendered. Print toolbar calls browser print.
- **View API Body** (confirmed run): builds AP invoice preview; no send required to inspect.
- **Send to Acc.** (confirmed run): opens same preview; disabled when send marker exists.
- **Status in all bodies:** changes all staged bodies to POSTED or DRAFT; not a payroll status change.
- **Send to Accounting** in dialog: invokes `post-sajel-payroll` with `{ journals: [...] }`. Shows per-invoice results. If no results are marked failed, writes accounting send timestamp/actor and reloads runs.
- **Close** exits AP preview. Confirmation dialogs provide cancel and the action-specific confirm control.
- **Rollback Send:** confirmation clears only accounting send timestamp/actor and re-enables sending. It does not cancel or delete external invoices.

### Business Rules
**Computation and eligibility**
- Employees with `employment_status === 'terminated'` are excluded even when termination falls inside the payroll period. Other statuses are included unless filtered. **TODO:** Reconcile this with preview's date-based treatment of leavers.
- Only active elements and active assignments participate. Eligibility is OR across rules and AND across each rule's job/department filters; null matches all. No rules means everyone in run computation, despite eligibility-page wording.
- Delay elements (`is_delay_minutes_element` or `delay_minutes`) require a posted period variable value greater than zero. Minutes remain null; run never recalculates from attendance.
- Variable-calculation elements require a period entry. Basic salary otherwise comes from the flagged element assignment or legacy salary, prorated using the same 30-day logic described in section 26.
- Other elements use the first matching active assignment; otherwise a fixed element can use a positive default. Formula strings are not evaluated. Assignment effective dates are ignored.
- A monthly override for a **fixed basic** element is used by preview but is not consumed in that basic branch of run computation. Similarly, a fixed absence element needs a suitable calculation type/assignment path to consume upstream values. **TODO:** Align calculation types and override precedence before treating preview as authoritative.
- Zero-amount lines are skipped; negative ordinary amounts can pass through. Each stored line rounds to two decimals. Totals are then recalculated from all stored run lines: gross = earnings, deductions = deduction sum, employer contributions separate, net = gross − deductions. Information does not affect net.
- Explicit employee/department/job filters cause only selected employees' existing lines to be replaced. Without those explicit filters, existing run lines are all deleted, even when HR visibility itself is scoped. **TODO:** Review cross-scope deletion risk.
- Run period has a unique year/month pair. Sequential deletes, inserts and header updates are not a transaction: partial results may survive failure. Confirmed status and independent month locks are different mechanisms.
- Upstream deduction attendance period is previous month's 26th to current month's 25th; this run selects posted entries by payroll year/month only. It does not select attendance dates itself.

**Currency, grouping and AP body**
- One invoice per working business unit and employee salary currency. Missing salary currency falls back to base currency. Earnings are positive, deductions negative; employer contributions and information are excluded from AP lines.
- Employees need working business unit and cost center; missing metadata causes warning and skips those amounts. Account precedence: element account, then business-unit/cost-center `payroll_dr_account`. Missing both skips amount; fallback emits a warning but retains it. Warnings are not send blockers.
- Within an invoice, amounts group by account + cost center + department. Rounded-zero groups are removed. No conversion is applied to line unit prices.
- Base currency gets rate 1. Other currencies use the run's positive SAR rate if present; otherwise latest configured rate by effective date (no payroll-date cutoff), applying multiply directly or divide as reciprocal. Missing/zero configured rate falls back to 1. Override applies to every non-base currency, not just SAR. **TODO:** Confirm base currency is SAR before relying on the UI's SAR labels.
- UI SAR totals multiply invoice totals by exchange rate. There is no run calculation currency conversion or mixed-currency normalization in run header totals.
- Body fields: `businessUnitCode`; configured payroll vendor constant; `invoiceDate` and `dueDate` = calendar month end; `periodCode` = MM/YYYY; `currencyCode`; `exchangeRate` rounded to six decimals; `reference` = `PAYROLL-YYYY-MM-<business-unit-code>`; `notes` = payroll month/year; `status` = selected POSTED/DRAFT; `lines`.
- Each line has `itemCode` empty, description `Payroll For Department : <business-unit-name>-<department-name>`, `quantity: 1`, signed two-decimal `unitPrice`, `taxRate: 0`, `accountId`, and `costCenterCode`. `_total` is UI-only and stripped by the edge function.
- Edge function also accepts `invoices` as an alternative input; it reads latest ERP configuration, generates one fresh `batchNumber`, adds it to every invoice, and submits invoices sequentially using configured request methods. Per-invoice success requires successful HTTP status and response `success` not false. Network exceptions become failed result entries.
- There is no external rollback or idempotency/deduplication check. Partial success followed by a full retry or Rollback Send may create duplicates; reference does not include currency.
- **TODO:** Fix error interpretation before relying on send markers: batch-generation failure can return HTTP 200 with an error and no results. Client only counts failed result entries; an empty results array can be treated as complete success and mark the run sent.
- Local payroll rollback does not remove period inputs, assignments, month locks, or accounting invoices. Rollback Send clears markers only. SAR-rate edits and accounting send paths do not check the month lock.

### Dependencies
Shared gate and scope; month-lock helper; element catalog and eligibility; assignments/monthly entries; upstream Deduction Summary; working business units, cost centers and mapping; currencies/rates; Sajel ERP settings; `post-sajel-payroll`; authenticated user for audit fields; browser payslip printing. No RPC is invoked.

### Database
- `payroll_runs`: UUID PK; unique period year/month (month 1–12); draft/confirmed status; numeric gross/deductions/employer/net totals; employee count; nullable confirmation actor/time, SAR rate, send actor/time, notes, created-by; timestamps.
- `payroll_run_lines`: UUID PK; required `run_id` (cascade), employee FK (cascade), element FK (restrict); stored element type, numeric amount, nullable minutes/notes, creation timestamp.
- Computation reads `employees(id, basic_salary, department_id, job_position_id, employment_status, job_start_date, termination_date)`, `payroll_elements`, `payroll_element_eligibility`, active `payroll_employee_elements`, period `payroll_variable_entries`; lock helper reads `payroll_month_locks`.
- Accounting reads employee `working_business_unit_id`, `cost_center_id`, `salary_currency_id`, `department_id`; `business_units(id, unit_code, unit_name)`; `cost_centers(id, cost_center_code, cost_center_name)`; `business_unit_cost_center_mapping(business_unit_id, cost_center_id, payroll_dr_account)`; `currencies(id, currency_code, is_base, is_active)`; `currency_rates(currency_id, rate_to_base, conversion_operator, effective_date)`; department labels; element account fields.
- Edge function reads latest `sajel_erp_settings` integration configuration. Sensitive configuration values are intentionally omitted. External invoice results are returned to the client; this handler does not persist an invoice ledger in Supabase.

### Step-by-step Example
1. Use a fictional open June period. Employee A (`EMP-001`) has an eligible earning of 10,000 EGP and a variable deduction of 500 EGP already posted for that period.
2. Select Employee A in run scope and click **Compute**. Inspect draft lines with **View**: gross 10,000, deductions 500, net 9,500 EGP, assuming no other elements.
3. Print a draft payslip, review eligibility and amounts, then **Confirm** and approve the dialog.
4. Populate valid example accounting mappings and currency rates in their respective setup screens. Use **View API Body**, inspect signed lines and warnings, and choose DRAFT or POSTED for external invoices.
5. Click **Send to Accounting** only after review. Inspect every result before assuming delivery.
6. If a correction is necessary, understand the distinction: **Rollback Send** only clears local delivery markers; **Rollback** deletes local payroll run and lines. Neither reverses an external invoice. Unlock an independently locked month before a guarded rollback or recomputation.
