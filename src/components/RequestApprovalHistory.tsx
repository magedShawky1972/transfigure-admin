import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Clock, User } from "lucide-react";
import { format } from "date-fns";

interface Props {
  request: any;
  language: "en" | "ar";
}

interface Step {
  label: string;
  state: "approved" | "rejected" | "pending" | "skipped";
  byId?: string | null;
  at?: string | null;
  note?: string | null;
}

export const RequestApprovalHistory = ({ request, language }: Props) => {
  const [names, setNames] = useState<Record<string, string>>({});

  const ids = [
    request.manager_approved_by,
    request.hr_approved_by,
    request.rejected_by,
    request.submitted_by_id,
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,user_name,email")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = p.user_name || p.email || p.user_id;
      });
      setNames(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const fmt = (d?: string | null) => (d ? format(new Date(d), "yyyy-MM-dd HH:mm") : "");
  const nameOf = (id?: string | null) => (id ? names[id] || "..." : "-");

  const status = request.status;
  const phase = request.current_phase;
  const rejected = status === "rejected" || !!request.rejected_at;

  const steps: Step[] = [];

  // Submitted
  steps.push({
    label: language === "ar" ? "تقديم الطلب" : "Submitted",
    state: "approved",
    byId: request.submitted_by_id || request.employee_id,
    at: request.created_at,
  });

  // Manager phase
  if (request.manager_approved_at) {
    steps.push({
      label: language === "ar" ? "اعتماد المدير" : "Manager Approval",
      state: "approved",
      byId: request.manager_approved_by,
      at: request.manager_approved_at,
    });
  } else if (rejected && phase === "manager") {
    steps.push({
      label: language === "ar" ? "اعتماد المدير" : "Manager Approval",
      state: "rejected",
      byId: request.rejected_by,
      at: request.rejected_at,
      note: request.rejection_reason,
    });
  } else if (phase === "manager" && status === "pending") {
    steps.push({
      label: language === "ar" ? "اعتماد المدير" : "Manager Approval",
      state: "pending",
    });
  } else if (phase === "hr" || status === "approved") {
    // Skipped manager (admin route)
    steps.push({
      label: language === "ar" ? "اعتماد المدير" : "Manager Approval",
      state: "skipped",
    });
  }

  // HR phase
  if (request.hr_approved_at) {
    steps.push({
      label: language === "ar" ? "اعتماد الموارد البشرية" : "HR Approval",
      state: "approved",
      byId: request.hr_approved_by,
      at: request.hr_approved_at,
    });
  } else if (rejected && phase === "hr") {
    steps.push({
      label: language === "ar" ? "اعتماد الموارد البشرية" : "HR Approval",
      state: "rejected",
      byId: request.rejected_by,
      at: request.rejected_at,
      note: request.rejection_reason,
    });
  } else if (phase === "hr" && status === "pending") {
    steps.push({
      label: language === "ar" ? "اعتماد الموارد البشرية" : "HR Approval",
      state: "pending",
    });
  }

  const stateIcon = (s: Step["state"]) => {
    if (s === "approved") return <Check className="h-4 w-4 text-green-600" />;
    if (s === "rejected") return <X className="h-4 w-4 text-red-600" />;
    if (s === "pending") return <Clock className="h-4 w-4 text-amber-600" />;
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  const stateLabel = (s: Step["state"]) => {
    if (s === "approved") return language === "ar" ? "تم الاعتماد" : "Approved";
    if (s === "rejected") return language === "ar" ? "مرفوض" : "Rejected";
    if (s === "pending") return language === "ar" ? "بانتظار الاعتماد" : "Pending";
    return language === "ar" ? "تم التخطي" : "Skipped";
  };

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-medium">
        {language === "ar" ? "سجل الاعتماد" : "Approval History"}
      </div>
      <div className="space-y-2 border rounded-md p-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <div className="mt-0.5">{stateIcon(s.state)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{stateLabel(s.state)}</div>
              </div>
              {(s.byId || s.at) && (
                <div className="text-xs text-muted-foreground">
                  {s.byId && <span>{nameOf(s.byId)}</span>}
                  {s.byId && s.at && <span> · </span>}
                  {s.at && <span>{fmt(s.at)}</span>}
                </div>
              )}
              {s.note && (
                <div className="text-xs text-red-600 mt-1">{s.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
