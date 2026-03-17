

## Current Behavior

When migrating table data, the edge function (`migrate-to-external`) generates SQL with **`ON CONFLICT (pk) DO UPDATE`** — meaning it automatically **overwrites** existing records that share the same primary key. There is **no user prompt** asking how to handle duplicates during migration.

The flow:
1. Data is exported as INSERT statements with `ON CONFLICT ("id") DO UPDATE SET ...` 
2. Foreign key checks are disabled (`SET session_replication_role = 'replica'`)
3. If a batch fails, it falls back to individual INSERT execution
4. No duplicate detection or user choice is offered

## Proposed Enhancement

Add a **duplicate handling option** to the migration UI, similar to the existing `DuplicateRecordsDialog` component used in `LoadData.tsx`. Before migrating each table, the user can choose:

### UI Changes (`SystemRestore.tsx`)
1. Add a **"Duplicate Data Strategy"** selector in the migration settings section (alongside the existing checkboxes for data/users/storage), with three options:
   - **Update Existing** (current default) — `ON CONFLICT DO UPDATE`
   - **Skip Duplicates** — `ON CONFLICT DO NOTHING`  
   - **Fail on Duplicates** — plain INSERT, stops on conflict

2. Pass the chosen strategy to the edge function via a new `conflictStrategy` parameter.

### Edge Function Changes (`migrate-to-external/index.ts`)
1. Accept `conflictStrategy` parameter (`'update' | 'skip' | 'fail'`) in the `export_table_as_sql` action.
2. Generate SQL accordingly:
   - `'update'` → current `ON CONFLICT DO UPDATE SET ...`
   - `'skip'` → `ON CONFLICT DO NOTHING`
   - `'fail'` → plain `INSERT` with no conflict clause

### Migration Progress Enhancement
- Show a count of **skipped** vs **inserted** vs **updated** rows per table in the progress UI when strategy is `skip`.

### Files to Modify
- `supabase/functions/migrate-to-external/index.ts` — add `conflictStrategy` support
- `src/pages/SystemRestore.tsx` — add strategy selector UI + pass parameter to edge function

