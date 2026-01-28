
# Fix: Show Employees With Unassigned Position Departments

## Problem Identified
Osama Ibrahim is assigned to:
- **Department**: Media (correctly set)
- **Job Position**: "Snr. Social Media Specialist"

However, the job position "Snr. Social Media Specialist" has **no department_id** (`null`). The Position Hierarchy dialog only fetches positions that belong to the selected department tree, so this position and its employees are not displayed.

## Solution
Modify the Position Hierarchy dialog to also include employees whose **department matches** but whose **job position may not have a department assigned**.

### Changes to `src/components/PositionHierarchyDialog.tsx`

1. **Fetch positions with null department_id too**: Include positions that employees in these departments are using, even if the position itself isn't linked to a department

2. **Alternative approach** - Fetch based on employee assignments:
   - First fetch all employees in the descendant departments
   - Then fetch all positions that these employees reference (via `job_position_id`)
   - This ensures we capture positions regardless of whether they have a `department_id`

### Implementation Steps

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch all employees in descendant departments           │
│     (employees.department_id IN descendantDeptIds)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Collect unique job_position_ids from these employees    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Fetch positions matching EITHER:                        │
│     - department_id IN descendantDeptIds                    │
│     - id IN employee job_position_ids                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Display all positions with their assigned employees     │
└─────────────────────────────────────────────────────────────┘
```

### Code Changes

**File: `src/components/PositionHierarchyDialog.tsx`**

Update `fetchPositions` function to:
1. First fetch employees in the department tree
2. Collect their job position IDs
3. Fetch positions using both department filter AND employee position IDs
4. Use `.or()` filter to combine conditions

This ensures that even if a position like "Snr. Social Media Specialist" has no `department_id`, it will still appear because an employee in the Media department is assigned to it.

## Expected Result
After this fix, Osama Ibrahim will appear under "Snr. Social Media Specialist" in the Position Hierarchy dialog for SmartLine/Media department.
