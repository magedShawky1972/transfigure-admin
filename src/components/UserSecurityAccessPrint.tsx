import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { getPrintLogoUrl } from "@/lib/printLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";

interface UserSecurityAccessPrintProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  jobPositionName?: string | null;
  departmentName?: string | null;
}

const MENU_GROUPS = [
  {
    groupKey: "reports",
    labelAr: "التقارير",
    labelEn: "Reports",
    items: [
      { key: "dashboard", labelAr: "لوحة التحكم", labelEn: "Dashboard" },
      { key: "ticket_dashboard", labelAr: "لوحة التذاكر", labelEn: "Ticket Dashboard" },
      { key: "shift_dashboard", labelAr: "لوحة الورديات", labelEn: "Shift Dashboard" },
      { key: "task_dashboard", labelAr: "لوحة المهام", labelEn: "Task Dashboard" },
      { key: "user_dashboard", labelAr: "لوحة المستخدم", labelEn: "User Dashboard" },
      { key: "softwareLicenses", labelAr: "البرامج والتراخيص", labelEn: "Software & Subscription" },
      { key: "reports", labelAr: "التقارير", labelEn: "Reports" },
      { key: "api_documentation", labelAr: "توثيق API", labelEn: "API Documentation" },
      { key: "transactions", labelAr: "المعاملات", labelEn: "Transactions" },
      { key: "pivotTable", labelAr: "الجدول المحوري", labelEn: "Pivot Table" },
    ],
  },
  {
    groupKey: "entry",
    labelAr: "الإدخال",
    labelEn: "Entry",
    items: [
      { key: "loadData", labelAr: "تحميل البيانات", labelEn: "Load Data" },
      { key: "uploadLog", labelAr: "سجل التحميل", labelEn: "Upload Log" },
      { key: "clearData", labelAr: "مسح البيانات", labelEn: "Clear Data" },
      { key: "tickets", labelAr: "تذاكري", labelEn: "My Tickets" },
      { key: "admin_tickets", labelAr: "تذاكر القسم", labelEn: "Department Tickets" },
      { key: "softwareLicenseSetup", labelAr: "إدخال الترخيص", labelEn: "License Entry" },
      { key: "shiftSession", labelAr: "جلسة الوردية", labelEn: "Shift Session" },
      { key: "myShifts", labelAr: "تقويم وردياتي", labelEn: "My Shifts Calendar" },
      { key: "shiftFollowUp", labelAr: "متابعة الورديات", labelEn: "Shift Follow-Up" },
      { key: "missingShiftImages", labelAr: "صور ناقصة", labelEn: "Missing Shift Images" },
      { key: "tawasoul", labelAr: "تواصل", labelEn: "Tawasoul" },
      { key: "asusTawasoul", labelAr: "أسس تواصل", labelEn: "Asus Tawasoul" },
      { key: "emailManager", labelAr: "مدير البريد", labelEn: "Email Manager" },
      { key: "projectsTasks", labelAr: "المشاريع والمهام", labelEn: "Projects & Tasks" },
      { key: "salesOrderEntry", labelAr: "إدخال أمر البيع", labelEn: "Sales Order Entry" },
      { key: "pricingScenario", labelAr: "سيناريو التسعير", labelEn: "Pricing Scenario" },
    ],
  },
  {
    groupKey: "setup",
    labelAr: "الإعداد",
    labelEn: "Setup",
    items: [
      { key: "reportsSetup", labelAr: "إعداد التقارير", labelEn: "Reports Setup" },
      { key: "customerSetup", labelAr: "إعداد العملاء", labelEn: "Customer Setup" },
      { key: "customerProfile", labelAr: "ملف العميل", labelEn: "Customer Profile" },
      { key: "customerTotals", labelAr: "إجمالي العملاء", labelEn: "Customer Totals" },
      { key: "brandSetup", labelAr: "إعداد العلامات", labelEn: "Brand Setup" },
      { key: "brandType", labelAr: "نوع العلامة", labelEn: "Brand Type" },
      { key: "productSetup", labelAr: "إعداد المنتجات", labelEn: "Product Setup" },
      { key: "paymentMethodSetup", labelAr: "إعداد طرق الدفع", labelEn: "Payment Method Setup" },
      { key: "shiftSetup", labelAr: "إعداد الورديات", labelEn: "Shift Setup" },
      { key: "shiftCalendar", labelAr: "تقويم الورديات", labelEn: "Shift Calendar" },
      { key: "currencySetup", labelAr: "إعداد العملات", labelEn: "Currency Setup" },
      { key: "userGroupSetup", labelAr: "مجموعات المستخدمين", labelEn: "User Groups" },
      { key: "projectSetup", labelAr: "إعداد المشاريع", labelEn: "Project Setup" },
      { key: "taskList", labelAr: "قائمة المهام", labelEn: "Task List" },
    ],
  },
  {
    groupKey: "hr",
    labelAr: "الموارد البشرية",
    labelEn: "HR Management",
    items: [
      { key: "employeeSetup", labelAr: "إعداد الموظفين", labelEn: "Employee Setup" },
      { key: "employeeRequests", labelAr: "طلبات الموظف", labelEn: "Employee Requests" },
      { key: "employeeRequestApprovals", labelAr: "اعتماد طلبات الموظفين", labelEn: "Employee Request Approvals" },
      { key: "hrManagerSetup", labelAr: "إعداد مديري الموارد البشرية", labelEn: "HR Manager Setup" },
      { key: "vacationSetup", labelAr: "إعداد الإجازات", labelEn: "Vacation Setup" },
      { key: "timesheetManagement", labelAr: "إدارة الحضور", labelEn: "Timesheet Management" },
      { key: "zkAttendanceLogs", labelAr: "سجلات حضور ZK", labelEn: "ZK Attendance Logs" },
      { key: "deductionRulesSetup", labelAr: "قواعد الخصم", labelEn: "Deduction Rules" },
      { key: "medicalInsuranceSetup", labelAr: "التأمين الطبي", labelEn: "Medical Insurance" },
      { key: "documentTypeSetup", labelAr: "أنواع المستندات", labelEn: "Document Types" },
      { key: "attendanceTypeSetup", labelAr: "أنواع الحضور", labelEn: "Attendance Types" },
      { key: "jobSetup", labelAr: "إعداد الوظائف", labelEn: "Job Setup" },
      { key: "hrVacationCalendar", labelAr: "تقويم الإجازات", labelEn: "Vacation Calendar" },
      { key: "companyHierarchy", labelAr: "الهيكل التنظيمي", labelEn: "Company Hierarchy" },
      { key: "companyNews", labelAr: "أخبار الشركة", labelEn: "Company News" },
      { key: "department_management", labelAr: "إدارة الأقسام", labelEn: "Department Management" },
      { key: "acknowledgmentDocuments", labelAr: "القرارات الإدارية", labelEn: "Administrative Decisions" },
      { key: "wfhCheckin", labelAr: "تسجيل حضور من المنزل", labelEn: "WFH Check-In" },
      { key: "companyWfhCalendar", labelAr: "تقويم العمل من المنزل", labelEn: "WFH Calendar" },
    ],
  },
  {
    groupKey: "cash",
    labelAr: "إدارة النقدية",
    labelEn: "Cash Management",
    items: [
      { key: "bankSetup", labelAr: "إعداد البنوك", labelEn: "Bank Setup" },
      { key: "treasurySetup", labelAr: "إعداد الخزائن", labelEn: "Treasury Setup" },
      { key: "expenseCategorySetup", labelAr: "فئات المصروفات", labelEn: "Expense Categories" },
      { key: "expenseTypeSetup", labelAr: "أنواع المصروفات", labelEn: "Expense Types" },
      { key: "costCenterSetup", labelAr: "مراكز التكلفة", labelEn: "Cost Centers" },
      { key: "treasuryOpeningBalance", labelAr: "رصيد الخزينة الافتتاحي", labelEn: "Treasury Opening Balance" },
      { key: "treasuryEntry", labelAr: "قيد الخزينة", labelEn: "Treasury Entry" },
      { key: "bankEntry", labelAr: "قيد البنك", labelEn: "Bank Entry" },
      { key: "expenseEntry", labelAr: "قيد المصروفات", labelEn: "Expense Entry" },
      { key: "expenseRequests", labelAr: "طلبات المصروفات", labelEn: "Expense Requests" },
      { key: "voidPayment", labelAr: "إلغاء الدفع", labelEn: "Void Payment" },
      { key: "paymentBankLink", labelAr: "ربط طرق الدفع بالبنوك", labelEn: "Payment Bank Link" },
      { key: "paymentWhatIf", labelAr: "سيناريو ماذا لو - الدفع", labelEn: "Payment What-If Scenario" },
    ],
  },
  {
    groupKey: "coins",
    labelAr: "معاملات الكوينز",
    labelEn: "Coins Transaction",
    items: [
      { key: "coinsCreation", labelAr: "إنشاء طلب شراء", labelEn: "Coins Purchase Creation" },
      { key: "coinsSending", labelAr: "توجيه التحويلات", labelEn: "Sending Transfers" },
      { key: "coinsReceivingPhase", labelAr: "استلام من المورد", labelEn: "Receiving Phase" },
      { key: "receivingCoins", labelAr: "إيصال الاستلام", labelEn: "Receiving Entry" },
      { key: "coinsWorkflowSetup", labelAr: "إعداد سير العمل", labelEn: "Workflow Setup" },
      { key: "coinsPurchaseFollowUp", labelAr: "متابعة شراء الكوينز", labelEn: "Purchase Follow-Up" },
      { key: "supplierSetup", labelAr: "إعداد الموردين", labelEn: "Supplier Setup" },
      { key: "coinsTransactionGuide", labelAr: "دليل المستخدم", labelEn: "User Guide" },
      { key: "supplierAdvancePayment", labelAr: "دفعات مقدمة للموردين", labelEn: "Supplier Advance Payment" },
      { key: "coinsSheets", labelAr: "شيتات الكوينز", labelEn: "Coins Sheets" },
      { key: "salesSheets", labelAr: "شيت المبيعات", labelEn: "Sales Sheets" },
    ],
  },
  {
    groupKey: "crm",
    labelAr: "إدارة العملاء",
    labelEn: "CRM",
    items: [
      { key: "crmAccess", labelAr: "خدمة العملاء", labelEn: "Case Board" },
      { key: "knowledgeBase", labelAr: "قاعدة المعرفة", labelEn: "Knowledge Base" },
      { key: "crmSetup", labelAr: "إعداد CRM", labelEn: "CRM Setup" },
    ],
  },
  {
    groupKey: "admin",
    labelAr: "الإدارة",
    labelEn: "Admin",
    items: [
      { key: "userSetup", labelAr: "إعداد المستخدمين", labelEn: "User Setup" },
      { key: "userLogins", labelAr: "بيانات تسجيل الدخول", labelEn: "Users Logins" },
      { key: "userEmails", labelAr: "المستخدمين والبريد", labelEn: "Users & Mails" },
      { key: "mailSetup", labelAr: "إعداد البريد", labelEn: "Mail Setup" },
      { key: "systemConfig", labelAr: "إعدادات النظام", labelEn: "System Configuration" },
      { key: "apiIntegrationStatus", labelAr: "حالة تكامل API", labelEn: "API Integration Status" },
      { key: "closingTraining", labelAr: "تدريب الإغلاق", labelEn: "Closing Training" },
      { key: "odooSetup", labelAr: "إعداد Odoo", labelEn: "Odoo Setup" },
      { key: "excelSetup", labelAr: "إعداد Excel", labelEn: "Excel Setup" },
      { key: "tableConfig", labelAr: "إعداد الجداول", labelEn: "Table Config" },
      { key: "pdfToExcel", labelAr: "تحويل PDF إلى Excel", labelEn: "PDF to Excel" },
      { key: "systemBackup", labelAr: "نسخ احتياطي", labelEn: "System Backup" },
      { key: "systemRestore", labelAr: "استعادة النظام", labelEn: "System Restore" },
      { key: "auditLogs", labelAr: "سجلات التدقيق", labelEn: "Audit Logs" },
      { key: "certificateManagement", labelAr: "إدارة الشهادات", labelEn: "Certificate Management" },
      { key: "securityDashboard", labelAr: "لوحة الأمان", labelEn: "Security Dashboard" },
      { key: "apiConsumptionLogs", labelAr: "سجلات استهلاك API", labelEn: "API Consumption Logs" },
      { key: "updateBankLedger", labelAr: "تحديث سجل البنك", labelEn: "Update Bank Ledger" },
      { key: "autoUpload", labelAr: "التحميل التلقائي", labelEn: "Auto Upload" },
      { key: "apiTransactionMapping", labelAr: "خريطة حقول المعاملات", labelEn: "Transaction Mapping" },
    ],
  },
];

const UserSecurityAccessPrint = ({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  jobPositionName,
  departmentName,
}: UserSecurityAccessPrintProps) => {
  const { language } = useLanguage();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchPermissions();
    }
  }, [open, userId]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      // Fetch all permissions in batches to avoid 1000 limit
      const PAGE_SIZE = 1000;
      let allPerms: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("user_permissions")
          .select("menu_item, has_access, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const batch = data || [];
        allPerms = allPerms.concat(batch);
        hasMore = batch.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Get latest permission per menu_item
      const permMap: Record<string, boolean> = {};
      for (const p of allPerms) {
        if (!(p.menu_item in permMap)) {
          permMap[p.menu_item] = p.has_access;
        }
      }
      setPermissions(permMap);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const logoUrl = getPrintLogoUrl();
    const today = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const groupsHtml = MENU_GROUPS.map((group) => {
      const rows = group.items
        .map((item) => {
          const hasAccess = permissions[item.key] === true;
          return `
            <tr>
              <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${language === "ar" ? item.labelAr : item.labelEn}</td>
              <td style="padding:4px 8px;border:1px solid #ddd;text-align:center;font-size:14px;width:60px;">
                ${hasAccess ? "☑" : "☐"}
              </td>
              <td style="padding:4px 8px;border:1px solid #ddd;width:120px;font-size:10px;"></td>
            </tr>`;
        })
        .join("");

      return `
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;page-break-inside:avoid;">
          <thead>
            <tr style="background:#f0f4f8;">
              <th colspan="3" style="padding:6px 8px;border:1px solid #ccc;text-align:${language === "ar" ? "right" : "left"};font-size:12px;color:#1a365d;">
                ${language === "ar" ? group.labelAr : group.labelEn}
              </th>
            </tr>
            <tr style="background:#f8fafc;">
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:${language === "ar" ? "right" : "left"};font-size:10px;width:auto;">
                ${language === "ar" ? "الشاشة" : "Screen"}
              </th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:center;font-size:10px;width:60px;">
                ${language === "ar" ? "صلاحية" : "Access"}
              </th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:center;font-size:10px;width:120px;">
                ${language === "ar" ? "ملاحظات" : "Notes"}
              </th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join("");

    const printContent = `
      <!DOCTYPE html>
      <html dir="${language === "ar" ? "rtl" : "ltr"}" lang="${language}">
      <head>
        <meta charset="UTF-8">
        <title>${language === "ar" ? "تقرير صلاحيات المستخدم" : "User Security Access Report"}</title>
        <style>
          @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none !important; }
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: ${language === "ar" ? "rtl" : "ltr"};
            padding: 20px;
            color: #333;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1a365d;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header img { width: 100px; height: auto; }
          .title { text-align: center; flex: 1; }
          .title h1 { font-size: 18px; color: #1a365d; margin: 0 0 4px; }
          .title p { font-size: 11px; color: #666; margin: 0; }
          .user-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 11px;
          }
          .user-info div { display: flex; gap: 6px; }
          .user-info .label { font-weight: 600; color: #1a365d; min-width: 80px; }
          .signatures {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            page-break-inside: avoid;
          }
          .sig-box {
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 8px;
            font-size: 11px;
          }
          .sig-box .sig-label { font-weight: 600; color: #1a365d; }
          .sig-box .sig-line { height: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoUrl}" alt="Logo" />
          <div class="title">
            <h1>${language === "ar" ? "نموذج صلاحيات الوصول للمستخدم" : "User Security Access Form"}</h1>
            <p>${language === "ar" ? "تاريخ الطباعة" : "Print Date"}: ${today}</p>
          </div>
          <div style="width:100px;"></div>
        </div>

        <div class="user-info">
          <div><span class="label">${language === "ar" ? "اسم المستخدم:" : "User Name:"}</span> <span>${userName}</span></div>
          <div><span class="label">${language === "ar" ? "البريد:" : "Email:"}</span> <span>${userEmail}</span></div>
          <div><span class="label">${language === "ar" ? "المسمى الوظيفي:" : "Position:"}</span> <span>${jobPositionName || "-"}</span></div>
          <div><span class="label">${language === "ar" ? "القسم:" : "Department:"}</span> <span>${departmentName || "-"}</span></div>
        </div>

        <p style="font-size:10px;color:#666;margin-bottom:10px;">
          ${language === "ar"
            ? "☑ = لديه صلاحية حالياً | ☐ = بدون صلاحية — يرجى التأشير على الشاشات المطلوبة والتوقيع أدناه"
            : "☑ = Currently has access | ☐ = No access — Please check required screens and sign below"}
        </p>

        ${groupsHtml}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">${language === "ar" ? "مدير القسم" : "Department Manager"}</div>
            <div>${language === "ar" ? "التاريخ: ___/___/______" : "Date: ___/___/______"}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">${language === "ar" ? "مدير تقنية المعلومات" : "IT Manager"}</div>
            <div>${language === "ar" ? "التاريخ: ___/___/______" : "Date: ___/___/______"}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">${language === "ar" ? "المدير العام" : "General Manager"}</div>
            <div>${language === "ar" ? "التاريخ: ___/___/______" : "Date: ___/___/______"}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === "ar" ? "تقرير صلاحيات المستخدم" : "User Security Access Report"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>{language === "ar" ? "المستخدم:" : "User:"}</strong> {userName}</p>
            <p><strong>{language === "ar" ? "البريد:" : "Email:"}</strong> {userEmail}</p>
            {departmentName && (
              <p><strong>{language === "ar" ? "القسم:" : "Department:"}</strong> {departmentName}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "ar"
              ? "سيتم طباعة نموذج يوضح جميع الشاشات مع صلاحيات المستخدم الحالية ليقوم مدير القسم بمراجعتها والتوقيع عليها."
              : "A form will be printed showing all screens with the user's current permissions for the department manager to review and sign."}
          </p>
          <Button onClick={handlePrint} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            {language === "ar" ? "طباعة التقرير" : "Print Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSecurityAccessPrint;
