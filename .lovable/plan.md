
# Employee Self-Service Requests System - Updated Plan

## Overview

This plan transforms the current "User Dashboard" into an "Employee Dashboard" and implements a comprehensive employee self-service request system with workflow approval. The approval structure leverages the existing `department_admins` table pattern rather than creating separate tables for HR managers.

## Request Types

1. **Sick Leave** (إجازة مرضية) - Request sick days with balance check
2. **Vacation Request** (طلب إجازة) - Request vacation days with balance verification before submission
3. **Delay Request** (طلب تأخير) - Request to excuse late arrival
4. **Expense Refund** (استرداد مصروفات) - Request reimbursement for personal expenses
5. **Experience Certificate** (شهادة خبرة) - Request employment verification certificate

---

## Workflow Design

### Approval Flow

```text
Employee Submits Request
        │
        ▼
┌─────────────────────────┐
│ Department Manager(s)   │  (is_department_manager = true)
│ Level 0 → Level 1 → ... │  Sequential approval
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ HR Manager(s)           │  (is_hr_manager = true)  
│ Level 0 → Level 1 → ... │  Sequential approval
└───────────┬─────────────┘
            │
            ▼
      Request Approved
```

### Key Points
- Each department can have multiple Department Managers with sequential levels (0, 1, 2...)
- HR Managers are also configured per-department with sequential levels
- If a department has 2 managers at Level 0, request waits for any one to approve before moving to Level 1
- Vacation/Sick Leave requests validate balance BEFORE submission

---

## Database Changes

### 1. Alter `department_admins` Table

Add two new boolean columns to the existing `department_admins` table:

```sql
ALTER TABLE public.department_admins 
ADD COLUMN is_department_manager BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN approve_employee_request BOOLEAN NOT NULL DEFAULT false;
```

| Column | Purpose |
|--------|---------|
| `is_department_manager` | Flags admin as Department Manager for employee requests |
| `approve_employee_request` | Enables this admin to approve employee self-service requests |

### 2. Create `hr_managers` Table

```sql
CREATE TABLE public.hr_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.hr_managers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read HR managers"
ON public.hr_managers FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can manage HR managers"
ON public.hr_managers FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
```

### 3. Create `employee_requests` Table

```sql
CREATE TABLE public.employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'sick_leave', 'vacation', 'delay', 'expense_refund', 'experience_certificate'
  )),
  
  -- Common fields
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'manager_approved', 'hr_pending', 'approved', 'rejected', 'cancelled'
  )),
  request_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT,
  
  -- Leave-specific fields (sick_leave, vacation)
  vacation_code_id UUID REFERENCES vacation_codes(id),
  start_date DATE,
  end_date DATE,
  total_days DECIMAL(5,2),
  
  -- Delay-specific fields
  delay_date DATE,
  delay_minutes INTEGER,
  actual_arrival_time TIME,
  
  -- Expense refund fields
  expense_amount DECIMAL(15,2),
  expense_currency_id UUID REFERENCES currencies(id),
  expense_description TEXT,
  expense_receipt_url TEXT,
  
  -- Workflow tracking
  department_id UUID REFERENCES departments(id),
  current_phase VARCHAR(20) DEFAULT 'manager' CHECK (current_phase IN ('manager', 'hr')),
  current_approval_level INTEGER DEFAULT 0,
  
  -- Manager phase tracking
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  manager_approved_by UUID REFERENCES auth.users(id),
  
  -- HR phase tracking
  hr_approved_at TIMESTAMP WITH TIME ZONE,
  hr_approved_by UUID REFERENCES auth.users(id),
  
  -- Rejection
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_employee_requests_employee ON employee_requests(employee_id);
CREATE INDEX idx_employee_requests_status ON employee_requests(status);
CREATE INDEX idx_employee_requests_department ON employee_requests(department_id);
CREATE INDEX idx_employee_requests_phase_level ON employee_requests(current_phase, current_approval_level);

-- Employees can view their own requests
CREATE POLICY "Employees can view own requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Employees can insert their own requests
CREATE POLICY "Employees can create own requests"
ON employee_requests FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Department managers can view requests in their department
CREATE POLICY "Dept managers can view department requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  department_id IN (
    SELECT department_id FROM department_admins 
    WHERE user_id = auth.uid() 
    AND approve_employee_request = true
  )
);

-- HR managers can view all requests
CREATE POLICY "HR managers can view all requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hr_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

---

## UI Changes

### 1. Department Management Page Updates

Modify `src/pages/DepartmentManagement.tsx` to add new controls for each admin:

**New Controls Per Admin:**
- **Checkbox**: "Approve Employee Request" (اعتماد طلبات الموظفين)
- **Switch/Flag**: "Department Manager" (مدير القسم)

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ≡  Level 0  │ Ahmed Mohamed                                     │
│             │ ahmed@company.com                                  │
│             │ [🔲 CC] [🔘 Purchase] [☑ Emp Request] [🔘 Dept Mgr]│
│             │                                           [🗑️]    │
└─────────────────────────────────────────────────────────────────┘
```

When "Dept Mgr" is toggled ON:
- Badge appears: "مدير القسم" / "Dept Manager"
- Level sequence applies (0, 1, 2...) just like purchase admins

### 2. HR Manager Configuration

Add a new tab or section in Department Management or a dedicated page:

**Option A**: New section in System Config page
**Option B**: New "HR Managers" tab in Department Management

This section allows:
- Adding users as HR Managers
- Setting their approval level order (0, 1, 2...)
- Toggling active status
- Drag-and-drop reordering

### 3. Rename User Dashboard to Employee Dashboard

**File:** `src/pages/UserDashboard.tsx`

- Change page title from "User Dashboard" to "Employee Dashboard" (لوحة الموظف)
- Update sidebar navigation label

**File:** `src/components/AppSidebar.tsx`

```typescript
// Change from:
{ title: language === 'ar' ? "لوحة المستخدم" : "User Dashboard", url: "/user-dashboard", icon: Users }

// To:
{ title: language === 'ar' ? "لوحة الموظف" : "Employee Dashboard", url: "/user-dashboard", icon: Users }
```

### 4. New Widget: Employee Requests Quick Access

Add to Employee Dashboard a new widget showing:
- Quick action buttons for each request type
- Recent requests list with status badges
- Pending count indicator

### 5. New Page: `/employee-requests`

**File:** `src/pages/EmployeeRequests.tsx`

Full page for:
- Creating new requests (tabbed or dropdown for request type)
- Viewing request history with filters
- Request detail view

**Form Fields by Type:**

| Request Type | Fields |
|--------------|--------|
| Sick Leave | Vacation Code, Start Date, End Date, Reason, Attachment |
| Vacation | Vacation Code, Start Date, End Date, Reason (shows balance) |
| Delay | Delay Date, Delay Minutes, Actual Arrival, Reason |
| Expense Refund | Amount, Currency, Description, Receipt Upload |
| Experience Certificate | Reason (optional) |

### 6. New Page: `/employee-request-approvals`

**File:** `src/pages/EmployeeRequestApprovals.tsx`

For Department Managers and HR Managers:
- View pending approvals for their level
- Approve/Reject with comments
- Filter by request type and status
- Shows "My Pending Approvals" count

---

## Edge Function: `handle-employee-request-action`

**File:** `supabase/functions/handle-employee-request-action/index.ts`

Handles:
- **Submit**: Validate balance, find first department manager, set status
- **Approve (Manager)**: 
  - Check for next manager level in department
  - If none, transition to HR phase (current_phase = 'hr', level = 0)
- **Approve (HR)**:
  - Check for next HR level
  - If none, finalize approval, deduct vacation balance if applicable
- **Reject**: Set status, store reason, notify employee

### Balance Deduction Logic

```typescript
// Only deduct on final HR approval for vacation/sick_leave
if (request.request_type === 'vacation' || request.request_type === 'sick_leave') {
  await supabase
    .from('employee_vacation_types')
    .update({ 
      used_days: supabase.raw('used_days + ?', [request.total_days]) 
    })
    .eq('employee_id', request.employee_id)
    .eq('vacation_code_id', request.vacation_code_id);
}
```

---

## Permissions

New permission keys to add:

| Key | Arabic | English |
|-----|--------|---------|
| `employeeRequests` | طلبات الموظف | Employee Requests |
| `employeeRequestApprovals` | اعتماد طلبات الموظفين | Employee Request Approvals |
| `hrManagerSetup` | إعداد مديري الموارد البشرية | HR Manager Setup |

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/DepartmentManagement.tsx` | Modify | Add checkboxes for approve_employee_request and is_department_manager flags |
| `src/pages/UserDashboard.tsx` | Modify | Rename to Employee Dashboard, add requests widget |
| `src/components/AppSidebar.tsx` | Modify | Update menu label to "Employee Dashboard" |
| `src/pages/EmployeeRequests.tsx` | Create | New page for creating/viewing employee requests |
| `src/pages/EmployeeRequestApprovals.tsx` | Create | Approval page for managers/HR |
| `src/components/EmployeeRequestForm.tsx` | Create | Dynamic request form component |
| `src/components/EmployeeRequestsWidget.tsx` | Create | Dashboard widget for quick access |
| `src/pages/HRManagerSetup.tsx` | Create | HR manager configuration page |
| `supabase/functions/handle-employee-request-action/index.ts` | Create | Workflow handling edge function |
| `supabase/functions/send-employee-request-notification/index.ts` | Create | Notification edge function |
| Database Migration | Create | Add columns to department_admins, create employee_requests and hr_managers tables |

---

## Technical Notes

1. **Reuses Existing Pattern**: The `admin_order` sequential leveling pattern from tickets is replicated for employee requests

2. **Department-Scoped Managers**: Department managers are scoped to their department via `department_admins` table

3. **Global HR Managers**: HR managers are system-wide and can approve requests from any department

4. **Balance Pre-Validation**: Vacation balance is checked before form submission, not during approval

5. **Audit Trail**: All approval/rejection actions are timestamped with user references

6. **Notifications**: Edge function sends notifications at each workflow transition

