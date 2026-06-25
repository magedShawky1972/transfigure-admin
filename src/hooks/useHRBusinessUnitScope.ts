import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAWAF_USER_ID = "f47f5a2e-f10a-4849-b9f6-9ea2f9d83cfb";

/**
 * Determines visibility scope for payroll/HR screens based on the
 * Working Business Units assigned to the current user as an HR Manager.
 *
 * Returns:
 *   loading: true while resolving
 *   isMaster: true if user is the master admin (sees everything)
 *   isHRManager: true if user is listed in hr_managers
 *   allowedEmployeeIds:
 *     - null  => no restriction (master admin OR HR manager without any
 *                business-unit links => full visibility, preserving legacy behavior)
 *     - []    => user has no access (not an HR manager and not master) – screen shows nothing
 *     - [ids] => restrict employee queries to these ids
 */
export function useHRBusinessUnitScope() {
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);
  const [isHRManager, setIsHRManager] = useState(false);
  const [allowedEmployeeIds, setAllowedEmployeeIds] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const master = user.id === NAWAF_USER_ID;
        setIsMaster(master);

        const { data: hrRow } = await supabase
          .from("hr_managers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const hr = !!hrRow;
        setIsHRManager(hr);

        if (master) {
          setAllowedEmployeeIds(null);
          return;
        }

        if (!hr) {
          // Non-HR users: no payroll data visibility
          setAllowedEmployeeIds([]);
          return;
        }

        // HR Manager: scope to linked Working Business Units (if any)
        const { data: links } = await supabase
          .from("hr_manager_business_units")
          .select("business_unit_id")
          .eq("hr_manager_id", (hrRow as any).id);

        const unitIds = (links || []).map((l: any) => l.business_unit_id);
        if (unitIds.length === 0) {
          // No units linked => full visibility (legacy behavior)
          setAllowedEmployeeIds(null);
          return;
        }

        // Resolve employees in those Working Business Units (paginated to bypass 1000-row limit)
        const ids: string[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data: empPage, error } = await supabase
            .from("employees")
            .select("id")
            .in("working_business_unit_id", unitIds)
            .range(from, from + pageSize - 1);
          if (error) break;
          const rows = (empPage || []) as any[];
          ids.push(...rows.map(r => r.id));
          if (rows.length < pageSize) break;
          from += pageSize;
        }
        setAllowedEmployeeIds(ids);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, isMaster, isHRManager, allowedEmployeeIds };
}
