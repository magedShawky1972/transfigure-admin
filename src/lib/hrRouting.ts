import { supabase } from "@/integrations/supabase/client";

export interface HRChainEntry {
  user_id: string;
  admin_order: number;
  region: string | null;
}

/**
 * Returns the ordered HR approval chain for an employee based on their
 * payroll country. HR managers whose region matches the payroll country
 * come first; if none exist for that region, "All Regions" managers
 * (region = null) are used; if none of those either, all active managers.
 */
export const getHRChainForPayrollCountry = async (
  payrollCountry?: string | null
): Promise<HRChainEntry[]> => {
  const { data } = await supabase
    .from("hr_managers")
    .select("user_id, admin_order, region")
    .eq("is_active", true)
    .order("admin_order", { ascending: true });

  const all = (data || []) as HRChainEntry[];
  let chain = payrollCountry ? all.filter((m) => m.region === payrollCountry) : [];
  if (chain.length === 0) chain = all.filter((m) => !m.region);
  if (chain.length === 0) chain = all;
  return chain;
};
