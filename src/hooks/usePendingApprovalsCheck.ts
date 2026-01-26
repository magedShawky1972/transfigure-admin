import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UsePendingApprovalsCheckOptions {
  /** Interval in milliseconds. Default: 1 hour (3600000ms) */
  intervalMs?: number;
  /** Whether to check immediately on mount */
  checkOnMount?: boolean;
}

interface PendingApprovalsState {
  hasPendingApprovals: boolean;
  pendingCount: number;
  lastChecked: Date | null;
  isChecking: boolean;
}

export const usePendingApprovalsCheck = (
  userId: string | null,
  options: UsePendingApprovalsCheckOptions = {}
) => {
  const { intervalMs = 60 * 60 * 1000, checkOnMount = true } = options; // Default 1 hour
  
  const [state, setState] = useState<PendingApprovalsState>({
    hasPendingApprovals: false,
    pendingCount: 0,
    lastChecked: null,
    isChecking: false,
  });
  const [showPopup, setShowPopup] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotifiedCountRef = useRef<number>(0);

  const checkPendingApprovals = useCallback(async (triggerPopup = false) => {
    if (!userId) return;

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      // Get user's department admin assignments
      const { data: adminAssignments, error: adminError } = await supabase
        .from("department_admins")
        .select("department_id, admin_order, is_purchase_admin")
        .eq("user_id", userId);

      if (adminError || !adminAssignments || adminAssignments.length === 0) {
        setState(prev => ({
          ...prev,
          hasPendingApprovals: false,
          pendingCount: 0,
          lastChecked: new Date(),
          isChecking: false,
        }));
        return;
      }

      // Get all admins for matching departments
      const deptIds = adminAssignments.map(a => a.department_id);
      const { data: allAdmins } = await supabase
        .from("department_admins")
        .select("department_id, admin_order, is_purchase_admin")
        .in("department_id", deptIds);

      // Fetch active tickets pending approval
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select(`
          id,
          is_purchase_ticket,
          next_admin_order,
          department_id
        `)
        .eq("is_deleted", false)
        .is("approved_at", null)
        .in("status", ["Open", "In Progress"])
        .in("department_id", deptIds);

      // Count tickets where current user is the next approver
      let pendingCount = 0;

      for (const ticket of ticketsData || []) {
        const userAdmin = adminAssignments.find(a => a.department_id === ticket.department_id);
        if (!userAdmin) continue;

        const deptAdmins = (allAdmins || []).filter(a => a.department_id === ticket.department_id);
        const nextOrder = ticket.next_admin_order ?? 0;

        let isNextApprover = false;

        if (!ticket.is_purchase_ticket) {
          if (!userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
            isNextApprover = true;
          }
        } else {
          const regularAdminsAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
          
          if (regularAdminsAtOrder.length > 0) {
            if (!userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
              isNextApprover = true;
            }
          } else {
            if (userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
              isNextApprover = true;
            }
          }
        }

        if (isNextApprover) {
          pendingCount++;
        }
      }

      const hasPending = pendingCount > 0;
      
      setState({
        hasPendingApprovals: hasPending,
        pendingCount,
        lastChecked: new Date(),
        isChecking: false,
      });

      // Show popup if:
      // 1. triggerPopup is true (manual check or mount check)
      // 2. OR there are new pending approvals since last notification
      if (hasPending && (triggerPopup || pendingCount > lastNotifiedCountRef.current)) {
        setShowPopup(true);
        lastNotifiedCountRef.current = pendingCount;
      }
    } catch (error) {
      console.error("Error checking pending approvals:", error);
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastChecked: new Date(),
      }));
    }
  }, [userId]);

  // Setup interval and initial check
  useEffect(() => {
    if (!userId) return;

    // Check on mount if enabled
    if (checkOnMount) {
      // Use session storage to prevent showing popup on every page load
      const lastCheck = sessionStorage.getItem("pendingApprovalsLastCheck");
      const now = Date.now();
      
      if (!lastCheck || (now - parseInt(lastCheck)) > 5000) {
        sessionStorage.setItem("pendingApprovalsLastCheck", now.toString());
        checkPendingApprovals(true);
      } else {
        // Still check but don't trigger popup
        checkPendingApprovals(false);
      }
    }

    // Setup hourly interval
    intervalRef.current = setInterval(() => {
      checkPendingApprovals(true);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, intervalMs, checkOnMount, checkPendingApprovals]);

  return {
    ...state,
    showPopup,
    setShowPopup,
    checkNow: () => checkPendingApprovals(true),
  };
};
