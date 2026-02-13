

# Upload Missing Images for Unopened Shifts

## Problem
When a user didn't open their shift on a previous date, there is no `shift_session` record. Without a session, there's no place to attach brand closing images. The supervisor wants to upload those images anyway, but creating a full "Open Shift" is problematic because the user might already have an active shift today.

## Solution
Add an "Upload Images" button for shifts with "Not Started" status. When clicked, it will automatically create a **lightweight closed session** (opened and immediately closed, marked as a supervisor action) specifically for holding the uploaded images -- without interfering with the user's current or future shifts.

This is safe because each `shift_session` is tied to a specific `shift_assignment` (which is date-specific), so it won't conflict with any other shift the user has open today.

## How It Will Work

1. Supervisor navigates to a previous date in Shift Follow-Up
2. Sees a shift marked "Not Started" (no session exists)
3. Clicks the new "Upload Images" button
4. System auto-creates a closed session for that assignment with a note like "Supervisor image upload - session created for image attachment"
5. Upload Missing Images dialog opens with the new session ID
6. Supervisor uploads the brand images as normal

## Technical Details

### File: `src/pages/ShiftFollowUp.tsx`

- Add an "Upload Images" button in the actions column when `currentStatus` is `null` (Not Started), alongside the existing "Open Shift" button
- When clicked, the handler will:
  1. Create a new `shift_session` record with `status: 'closed'`, `opened_at: now`, `closed_at: now`, and `closing_notes` indicating it was a supervisor upload
  2. Store the new session ID and open the `UploadMissingImagesDialog`
  3. Refresh the assignments list

### File: `src/components/UploadMissingImagesDialog.tsx`
- No changes needed -- it already works with any valid session ID

### No database changes needed
- The existing `shift_sessions` table supports this flow as-is

