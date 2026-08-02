import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PayrollMonthLock = {
  id: string;
  period_year: number;
  period_month: number;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
};

/**
 * Reads the payroll lock state for a given period. When a period is locked no
 * payroll value may change: no recalculation, no variable entry edits, no
 * deduction posting and no payroll run confirm/rollback.
 */
export function usePayrollMonthLock(year: number, month: number) {
  const [lock, setLock] = useState<PayrollMonthLock | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payroll_month_locks")
      .select("id, period_year, period_month, is_locked, locked_at, locked_by, notes")
      .eq("period_year", year)
      .eq("period_month", month)
      .maybeSingle();
    setLock((data as any) || null);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { refresh(); }, [refresh]);

  return { lock, isLocked: !!lock?.is_locked, loading, refresh };
}

/** One-off check used before write actions (avoids trusting stale client state). */
export async function isPayrollPeriodLocked(year: number, month: number) {
  const { data } = await supabase
    .from("payroll_month_locks")
    .select("is_locked")
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();
  return !!(data as any)?.is_locked;
}
