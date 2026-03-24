

## Add "Transfer Department" Action for Ticket Approvers

### Problem
When a department admin receives a ticket for approval but realizes it belongs to a different department, there's no dedicated action to transfer it. The existing edit mode allows changing the department but doesn't reset the approval workflow, which can cause routing issues.

### Solution
Add a "Transfer Department" button visible to department admins on open (unapproved) tickets. When triggered, it opens a dialog to select a new department with an optional reason. On transfer:
- The ticket's `department_id` is updated
- `next_admin_order` resets to `0` (restarts approval workflow in the new department)
- Status resets to `Open`
- An activity log entry is recorded with the transfer reason
- A notification is sent to the new department's first admin

### Changes to `src/pages/TicketDetails.tsx`

1. **Add state variables** for the transfer dialog (open/close, selected department, reason)
2. **Add `handleTransferDepartment` function** that:
   - Updates `department_id`, resets `next_admin_order` to 0, sets status to "Open"
   - Inserts a workflow note recording the transfer (old dept → new dept, reason)
   - Sends notification to the first admin of the new department
3. **Add Transfer Department button** next to existing action buttons, visible when `isDepartmentAdmin && !ticket.approved_at`
4. **Add Transfer Dialog** with department selector and optional reason textarea

### Technical Details
- Button placement: alongside Approve/Reject/Edit buttons in the ticket header area
- The transfer resets `next_admin_order = 0` so the new department's admin chain starts fresh
- Activity log entry type: `department_transfer` with old/new department names and reason
- Only department admins (not ticket owners) can transfer

