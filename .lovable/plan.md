
## Add "Disable Closing Image Upload" option to Brand Setup

Add a per-brand toggle in Brand Setup so flagged brands are excluded from the shift closing image upload requirement (no upload slot in the shift session, and not counted toward "missing images" reports).

### What changes

**1. Database (schema migration)**
- Add column `brands.skip_closing_image` (boolean, default `false`, nullable=false).

**2. Brand Edit page (`src/pages/BrandEdit.tsx`)**
- Add a new Switch field "Disable Closing Image Upload" near the ABC Analysis / Status section.
- Include in form state, load on edit, and save on insert/update.

**3. Brand Setup list (`src/pages/BrandSetup.tsx`)**
- Add a small badge/icon in the row to indicate when closing image is disabled (so admins can see it at a glance).

**4. Shift Session (`src/pages/ShiftSession.tsx`)** — the user-facing effect
- Both brand-loading queries (lines ~204 and ~308) add `.eq("skip_closing_image", false)` so disabled brands no longer appear in the closing image upload UI.

**5. Reporting alignment (so "missing images" stays accurate)**
- `src/pages/MissingShiftImages.tsx` (line ~93): filter out brands where `skip_closing_image = true`.
- `src/pages/ShiftFollowUp.tsx` (line ~194): same filter, so the "required images count" matches the new reality.
- `src/pages/ClosingTraining.tsx` (line ~165): also exclude disabled brands from the training picker (no point training a brand that won't be uploaded).

### Behavior summary
- Checking the box on a brand → that brand is removed from the shift closing upload screen and is no longer counted as a required image in Missing Shift Images / Shift Follow-Up.
- Unchecking restores normal behavior immediately (no historical data is altered).
- Default for all existing brands is `false` (no behavior change until explicitly toggled).

### Files to edit
- `supabase/migrations/<new>.sql` (add column)
- `src/pages/BrandEdit.tsx`
- `src/pages/BrandSetup.tsx`
- `src/pages/ShiftSession.tsx`
- `src/pages/MissingShiftImages.tsx`
- `src/pages/ShiftFollowUp.tsx`
- `src/pages/ClosingTraining.tsx`
