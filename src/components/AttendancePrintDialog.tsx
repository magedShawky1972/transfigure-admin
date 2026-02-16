import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { getPrintLogoUrl } from "@/lib/printLogo";
import { format, parseISO } from "date-fns";

interface TimesheetRecord {
  id: string;
  employee_id: string;
  work_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  total_work_minutes: number;
  is_absent: boolean;
  absence_reason: string | null;
  status: string;
  deduction_rules?: {
    rule_name: string;
    rule_name_ar: string | null;
    deduction_type: string;
    deduction_value: number;
  } | null;
  employees?: {
    employee_number: string;
    first_name: string;
    last_name: string;
    zk_employee_code: string | null;
  };
}

interface AttendancePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timesheets: TimesheetRecord[];
  filterLabel: string;
}

export default function AttendancePrintDialog({
  open,
  onOpenChange,
  timesheets,
  filterLabel,
}: AttendancePrintDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  // Group timesheets by employee
  const grouped = timesheets.reduce<Record<string, { name: string; empNumber: string; records: TimesheetRecord[] }>>((acc, ts) => {
    const key = ts.employee_id;
    if (!acc[key]) {
      acc[key] = {
        name: ts.employees ? `${ts.employees.first_name} ${ts.employees.last_name}` : "—",
        empNumber: ts.employees?.employee_number || "",
        records: [],
      };
    }
    acc[key].records.push(ts);
    return acc;
  }, {});

  const employeeIds = Object.keys(grouped);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set(employeeIds));

  // Reset selection when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setSelectedEmployees(new Set(Object.keys(grouped)));
    onOpenChange(v);
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmployees.size === employeeIds.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employeeIds));
    }
  };

  const handlePrint = () => {
    const logoUrl = getPrintLogoUrl();
    const selected = employeeIds.filter((id) => selectedEmployees.has(id));

    const pages = selected.map((empId) => {
      const emp = grouped[empId];
      const rows = emp.records
        .sort((a, b) => a.work_date.localeCompare(b.work_date))
        .map((r) => {
          const workDate = format(parseISO(r.work_date), "dd/MM/yyyy");
          const scheduled = r.scheduled_start && r.scheduled_end ? `${r.scheduled_start} - ${r.scheduled_end}` : "-";
          const actual = r.actual_start || r.actual_end ? `${r.actual_start || "-"} - ${r.actual_end || "-"}` : "-";
          const workHours = `${Math.floor(r.total_work_minutes / 60)}h ${r.total_work_minutes % 60}m`;
          const late = r.late_minutes > 0 ? `${r.late_minutes}m` : "-";
          const overtime = r.overtime_minutes > 0 ? `${r.overtime_minutes}m` : "-";
          const absent = r.is_absent ? (isAr ? "غياب" : "Absent") : "-";
          const deduction = r.deduction_rules && r.deduction_rules.deduction_value > 0
            ? (isAr ? r.deduction_rules.rule_name_ar || r.deduction_rules.rule_name : r.deduction_rules.rule_name)
            : "-";
          const status = r.is_absent
            ? `<span style="color:#dc2626">${absent}</span>`
            : r.status === "approved"
              ? `<span style="color:#16a34a">${isAr ? "معتمد" : "Approved"}</span>`
              : r.status === "pending"
                ? `<span style="color:#ca8a04">${isAr ? "معلق" : "Pending"}</span>`
                : r.status;

          return `<tr>
            <td>${workDate}</td>
            <td>${scheduled}</td>
            <td>${actual}</td>
            <td>${workHours}</td>
            <td style="${r.late_minutes > 0 ? "color:#dc2626;font-weight:600" : ""}">${late}</td>
            <td style="${r.overtime_minutes > 0 ? "color:#16a34a;font-weight:600" : ""}">${overtime}</td>
            <td>${deduction}</td>
            <td>${status}</td>
          </tr>`;
        })
        .join("");

      // Summary
      const totalLate = emp.records.reduce((s, r) => s + r.late_minutes, 0);
      const totalOT = emp.records.reduce((s, r) => s + r.overtime_minutes, 0);
      const totalAbsent = emp.records.filter((r) => r.is_absent).length;
      const totalWork = emp.records.reduce((s, r) => s + r.total_work_minutes, 0);

      return `
        <div class="page">
          <div class="header">
            <img src="${logoUrl}" style="width:120px;height:auto;" />
            <h2>${isAr ? "كشف حضور وانصراف" : "Attendance Record"}</h2>
            <p style="color:#666;font-size:12px;">${filterLabel}</p>
          </div>

          <div class="emp-info">
            <div><strong>${isAr ? "اسم الموظف" : "Employee Name"}:</strong> ${emp.name}</div>
            <div><strong>${isAr ? "الرقم الوظيفي" : "Employee No."}:</strong> ${emp.empNumber}</div>
            <div><strong>${isAr ? "عدد السجلات" : "Total Records"}:</strong> ${emp.records.length}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${isAr ? "التاريخ" : "Date"}</th>
                <th>${isAr ? "المجدول" : "Scheduled"}</th>
                <th>${isAr ? "الفعلي" : "Actual"}</th>
                <th>${isAr ? "ساعات العمل" : "Work Hours"}</th>
                <th>${isAr ? "التأخير" : "Late"}</th>
                <th>${isAr ? "الإضافي" : "Overtime"}</th>
                <th>${isAr ? "الخصم" : "Deduction"}</th>
                <th>${isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary">
            <div><strong>${isAr ? "إجمالي التأخير" : "Total Late"}:</strong> ${totalLate}m</div>
            
            <div><strong>${isAr ? "أيام الغياب" : "Absent Days"}:</strong> ${totalAbsent}</div>
            <div><strong>${isAr ? "إجمالي ساعات العمل" : "Total Work Hours"}:</strong> ${Math.floor(totalWork / 60)}h ${totalWork % 60}m</div>
          </div>

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line"></div>
              <p>${isAr ? "توقيع مدير الموارد البشرية" : "HR Manager Signature"}</p>
              <p class="sig-sub">${isAr ? "الاسم: ..........................." : "Name: ..........................."}</p>
              <p class="sig-sub">${isAr ? "التاريخ: ..........................." : "Date: ..........................."}</p>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <p>${isAr ? "توقيع الموظف" : "Employee Signature"}</p>
              <p class="sig-sub">${isAr ? "الاسم: ..........................." : "Name: ..........................."}</p>
              <p class="sig-sub">${isAr ? "التاريخ: ..........................." : "Date: ..........................."}</p>
            </div>
          </div>
        </div>
      `;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="${isAr ? "rtl" : "ltr"}">
      <head>
        <title>${isAr ? "كشف حضور وانصراف" : "Attendance Record"}</title>
        <style>
          @media print {
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
          .page { padding: 20px; max-width: 900px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a1a2e; padding-bottom: 15px; }
          .header h2 { margin: 10px 0 5px; font-size: 20px; color: #1a1a2e; }
          .emp-info { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; }
          th { background: #1a1a2e; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary { display: flex; justify-content: space-around; padding: 12px; background: #f0f4ff; border-radius: 6px; margin-bottom: 40px; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .sig-block { text-align: center; width: 45%; }
          .sig-line { border-bottom: 1px solid #333; margin-bottom: 8px; height: 40px; }
          .sig-block p { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
          .sig-sub { font-size: 11px; font-weight: 400; color: #666; }
        </style>
      </head>
      <body>
        ${pages.join("")}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {isAr ? "طباعة كشف الحضور" : "Print Attendance Report"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{filterLabel}</p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              checked={selectedEmployees.size === employeeIds.length}
              onCheckedChange={toggleAll}
              id="select-all"
            />
            <Label htmlFor="select-all" className="font-medium cursor-pointer">
              {isAr ? "تحديد الكل" : "Select All"} ({employeeIds.length})
            </Label>
          </div>
          {employeeIds.map((empId) => (
            <div key={empId} className="flex items-center gap-2">
              <Checkbox
                checked={selectedEmployees.has(empId)}
                onCheckedChange={() => toggleEmployee(empId)}
                id={`emp-${empId}`}
              />
              <Label htmlFor={`emp-${empId}`} className="cursor-pointer">
                {grouped[empId].empNumber} - {grouped[empId].name} ({grouped[empId].records.length} {isAr ? "سجل" : "records"})
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handlePrint} disabled={selectedEmployees.size === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {isAr ? "طباعة" : "Print"} ({selectedEmployees.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
