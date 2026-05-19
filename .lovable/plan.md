## Goal
Let project managers invite external people by email to a single project. Guests receive a signup link, create an account, and land directly inside that one project with one of two permission levels:

- **Editor** — view project, add/update/delete tasks, post chat/comments, upload attachments.
- **Viewer** — read-only access to project, tasks, Gantt and Kanban.

Guests must NOT see any other projects, departments, employees, finance, or admin pages in the app.

---

## 1. Database (one migration)

### New table `project_guests`
- `id` uuid pk
- `project_id` uuid → projects (cascade)
- `email` citext (unique per project)
- `role` text check in (`editor`,`viewer`)
- `invite_token` uuid (unique) — used in signup link
- `invited_by` uuid, `invited_at` timestamptz
- `accepted_at` timestamptz null
- `user_id` uuid null — filled when the guest signs up

### New flag on `profiles`
- `is_external_guest` boolean default false (set true at signup if invited)

### Helper SECURITY DEFINER functions
- `is_project_guest(p_project_id uuid, p_user_id uuid) returns boolean`
- `project_guest_role(p_project_id uuid, p_user_id uuid) returns text`
- `current_user_is_external_guest() returns boolean`

### RLS adjustments
Add policies on `projects`, `tasks`, `task_messages`, `task_attachments`, `project_task_phases`, `project_members` so a guest can `SELECT` only rows for their assigned project; editor guests additionally get `INSERT/UPDATE/DELETE` on `tasks`, `task_messages`, `task_attachments` scoped to their project. Viewer guests get SELECT only.

---

## 2. Edge function `invite-project-guest`
Inputs: `project_id`, `email`, `role`.
- Verifies caller is admin / department admin / project manager.
- Upserts row in `project_guests` with a fresh `invite_token`.
- Sends a branded email containing the signup link:
  `${SITE_URL}/guest-signup?token=<invite_token>`

Uses the existing Lovable email infrastructure (auth-email-hook flow). If email infra isn't configured yet, the agent will run setup the first time this is used.

---

## 3. New public route `/guest-signup`
- Reads `token` from URL.
- Calls edge function `accept-project-guest` which:
  1. Looks up `project_guests` by token (must be unaccepted).
  2. Shows email (read-only) + password field on the page.
  3. Creates the auth user with `email` + chosen password (auto-confirm for guests), sets `profiles.is_external_guest = true`, fills `project_guests.user_id` and `accepted_at`.
- On success, signs the user in and redirects to `/guest/project/<project_id>`.

---

## 4. Guest-only shell
New `GuestLayout` that:
- Hides the global sidebar/menu entirely.
- Shows only: Project header, tabs for **Overview**, **Tasks (Kanban)**, **Gantt**, **Chat**.
- Reuses existing `TaskList`, `ProjectGantt`, task message components but in read-only mode for viewer.
- A top-level guard (`<GuestGuard>`) checks `profiles.is_external_guest`:
  - If true → force route to `/guest/project/:id`. Any other path redirects there.
  - If false → normal app.

---

## 5. UI in Projects & Tasks
In `ProjectsTasks.tsx` add a **"Invite Guest"** button on each project card (visible to managers/admins). Opens a dialog:
- Email input (validated)
- Role radio: **Can edit** / **View only**
- Submit → calls `invite-project-guest` edge function, shows toast.

A second tab/section **"External Guests"** lists current guests with status (Pending/Accepted), role, and a **Revoke** action (deletes the `project_guests` row and the linked auth user if present).

---

## 6. Security notes
- All guest mutations go through RLS scoped by `is_project_guest()` + role check, never trust client.
- Edge functions verify caller permissions before inserting invites.
- Revoking deletes the row → RLS immediately blocks the guest.
- Email validation with zod on both client and edge function.

---

## Files touched
- migration: `project_guests`, helper fns, RLS policies, `profiles.is_external_guest`
- new edge functions: `invite-project-guest`, `accept-project-guest`
- new pages: `src/pages/GuestSignup.tsx`, `src/pages/GuestProject.tsx`
- new component: `src/components/GuestGuard.tsx`, `src/components/InviteGuestDialog.tsx`, `src/components/ProjectGuestsList.tsx`
- edits: `src/App.tsx` (routes + guard), `src/pages/ProjectsTasks.tsx` (button + tab)

After you approve, I'll start with the migration, then build the edge functions, then the UI.