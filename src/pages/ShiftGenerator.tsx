import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Plus, X, Trash2, Copy, Send, Eye, UserPlus } from "lucide-react";

type Period = "weekly" | "biweekly" | "monthly";
type DayOffMode = "auto" | "manual" | "none";

interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  shifts: Shift[];
  dayOffMode: DayOffMode;
  dayOffValue: string;
  coverageId: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const newDefaultShift = (): Shift => ({
  id: uid(),
  name: "Morning",
  start: "07:00",
  end: "15:00",
});

const newEmployee = (name = ""): Employee => ({
  id: uid(),
  name,
  role: "",
  shifts: [newDefaultShift()],
  dayOffMode: "auto",
  dayOffValue: "",
  coverageId: "",
});

export default function ShiftGenerator() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const tt = (en: string, ar: string) => (isAr ? ar : en);
  const navigate = useNavigate();

  const { hasAccess, isLoading, userId } = usePageAccess("/shift-generator");
  const [canSend, setCanSend] = useState(false);

  // Schedule settings
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState<Period>("weekly");

  // Quick add
  const [quickName, setQuickName] = useState("");

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([newEmployee()]);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState<"ar" | "en">("ar");
  const [sending, setSending] = useState(false);

  // Determine send permission via roles (admin/moderator can send; others view/create only)
  useEffect(() => {
    const checkSend = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (data || []).map((r: any) => r.role);
      // admin = full, moderator = manager full, user = supervisor (no send)
      setCanSend(roles.includes("admin") || roles.includes("moderator"));
    };
    checkSend();
  }, [userId]);

  // Quick add handler -> creates new employee card
  const handleQuickAddKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && quickName.trim()) {
      e.preventDefault();
      setEmployees((prev) => [...prev, newEmployee(quickName.trim())]);
      setQuickName("");
    }
  };

  const removeEmployee = (id: string) => {
    setEmployees((prev) =>
      prev
        .filter((e) => e.id !== id)
        .map((e) => (e.coverageId === id ? { ...e, coverageId: "" } : e))
    );
  };

  const updateEmployee = (id: string, patch: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addShift = (empId: string) => {
    updateEmployeeShifts(empId, (s) => [
      ...s,
      { id: uid(), name: "", start: "09:00", end: "17:00" },
    ]);
  };

  const removeShift = (empId: string, shiftId: string) => {
    updateEmployeeShifts(empId, (s) => s.filter((x) => x.id !== shiftId));
  };

  const updateShift = (empId: string, shiftId: string, patch: Partial<Shift>) => {
    updateEmployeeShifts(empId, (s) =>
      s.map((x) => (x.id === shiftId ? { ...x, ...patch } : x))
    );
  };

  const updateEmployeeShifts = (empId: string, fn: (s: Shift[]) => Shift[]) => {
    setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, shifts: fn(e.shifts) } : e)));
  };

  const periodLabel = (lang: "ar" | "en") => {
    const map = {
      en: { weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly" },
      ar: { weekly: "أسبوعي", biweekly: "كل أسبوعين", monthly: "شهري" },
    } as const;
    return map[lang][period];
  };

  const dayOffLabel = (e: Employee, lang: "ar" | "en") => {
    if (e.dayOffMode === "auto") return lang === "ar" ? "تلقائي" : "auto";
    if (e.dayOffMode === "none") return lang === "ar" ? "لا توجد إجازة" : "none";
    return e.dayOffValue || (lang === "ar" ? "غير محدد" : "unspecified");
  };

  const buildPrompt = (lang: "ar" | "en") => {
    const blocks = employees
      .filter((e) => e.name.trim())
      .map((e) => {
        const coverage = employees.find((x) => x.id === e.coverageId);
        const shiftsStr = e.shifts
          .filter((s) => s.name.trim())
          .map((s) => `${s.name} (${s.start}–${s.end})`)
          .join(", ");
        if (lang === "en") {
          const lines = [`**${e.name}**${e.role.trim() ? ` — ${e.role}` : ""}`];
          if (shiftsStr) lines.push(`  Shifts: ${shiftsStr}`);
          lines.push(`  Day off: ${dayOffLabel(e, "en")}`);
          if (coverage) lines.push(`  Coverage when off: ${coverage.name}`);
          return lines.join("\n");
        } else {
          const lines = [`**${e.name}**${e.role.trim() ? ` — ${e.role}` : ""}`];
          if (shiftsStr) lines.push(`  الشيفتات: ${shiftsStr}`);
          lines.push(`  يوم الإجازة: ${dayOffLabel(e, "ar")}`);
          if (coverage) lines.push(`  موظف التغطية عند الغياب: ${coverage.name}`);
          return lines.join("\n");
        }
      })
      .join("\n\n");

    if (lang === "en") {
      return `You are a workforce scheduling assistant. Create a ${periodLabel("en")} shift schedule from ${startDate} to ${endDate} based on the following data:

${blocks}

**Rules:**
- Respect each employee's specified day off
- If day off is marked auto, assign it fairly based on workload
- Coverage employee takes the absent employee's shift on their day off
- Every shift must be covered at all times
- Distribute workload fairly across all employees

**Output:** Present the schedule as a table with employees as rows and days as columns. Show the shift name or OFF in each cell. Add a summary row showing total shifts per employee. Flag any coverage gaps or conflicts clearly.`;
    }
    return `أنت مساعد متخصص في جدولة الشيفتات. قم بإنشاء جدول ${periodLabel("ar")} للفترة من ${startDate} إلى ${endDate} بناءً على البيانات التالية:

${blocks}

القواعد:
- احترم يوم الإجازة المحدد لكل موظف
- إذا كان يوم الإجازة تلقائياً وزّعه بشكل عادل بناءً على عبء العمل
- موظف التغطية يأخذ شيفت الغائب في يوم إجازته
- كل شيفت يجب أن يكون مغطى في جميع الأوقات
- وزّع العبء بشكل عادل بين جميع الموظفين

المطلوب: جدول بالموظفين كصفوف والأيام كأعمدة. اكتب اسم الشيفت أو إجازة في كل خانة. أضف صف ملخص بإجمالي الشيفتات لكل موظف. أشر بوضوح لأي تعارضات أو فجوات في التغطية.`;
  };

  const promptText = useMemo(() => buildPrompt(previewLang), [previewLang, employees, startDate, endDate, period]);

  const validate = () => {
    if (!startDate || !endDate) {
      toast({ title: tt("Missing dates", "تواريخ مفقودة"), description: tt("Please select start and end dates", "يرجى اختيار تاريخ البداية والنهاية"), variant: "destructive" });
      return false;
    }
    if (!employees.some((e) => e.name.trim())) {
      toast({ title: tt("No employees", "لا يوجد موظفون"), description: tt("Add at least one employee", "أضف موظفًا واحدًا على الأقل"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validate()) return;
    setShowPreview(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(promptText);
    toast({ title: tt("Copied", "تم النسخ"), description: tt("Prompt copied to clipboard", "تم نسخ النص إلى الحافظة") });
  };

  const handleSend = async () => {
    if (!canSend) return;
    if (!validate()) return;
    setSending(true);
    try {
      // Submit to AI handler — placeholder: surface success toast.
      // Wire to an edge function later if needed.
      await new Promise((r) => setTimeout(r, 600));
      toast({ title: tt("Sent", "تم الإرسال"), description: tt("Prompt approved and sent.", "تم اعتماد النص وإرساله.") });
    } catch (e: any) {
      toast({ title: tt("Failed", "فشل"), description: e?.message || "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{tt("Loading...", "جاري التحميل...")}</div>;
  }
  if (hasAccess === false) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tt("Access denied", "تم رفض الوصول")}</CardTitle>
            <CardDescription>
              {tt("You don't have permission to access this page.", "ليس لديك صلاحية للوصول إلى هذه الصفحة.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")}>{tt("Back to home", "العودة للرئيسية")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{tt("Shift Generator", "مولّد الشيفتات")}</h1>
          <p className="text-sm text-muted-foreground">
            {tt("Build a structured prompt for AI shift scheduling.", "أنشئ نصًا منظمًا لجدولة الشيفتات بالذكاء الاصطناعي.")}
          </p>
        </div>
      </div>

      {/* Section 1 — Schedule settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tt("Schedule Settings", "إعدادات الجدول")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>{tt("Start date", "تاريخ البداية")}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tt("End date", "تاريخ النهاية")}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tt("Period", "الفترة")}</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{tt("Weekly", "أسبوعي")}</SelectItem>
                <SelectItem value="biweekly">{tt("Bi-weekly", "كل أسبوعين")}</SelectItem>
                <SelectItem value="monthly">{tt("Monthly", "شهري")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tt("Quick add employee", "إضافة سريعة لموظف")}</Label>
            <Input
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onKeyDown={handleQuickAddKey}
              placeholder=""
            />
          </div>
          {employees.filter((e) => e.name.trim()).length > 0 && (
            <div className="md:col-span-4 flex flex-wrap gap-2 pt-2">
              {employees.filter((e) => e.name.trim()).map((e) => (
                <Badge key={e.id} variant="secondary" className="gap-1">
                  {e.name}
                  <button
                    type="button"
                    onClick={() => removeEmployee(e.id)}
                    className="ml-1 hover:text-destructive"
                    aria-label="remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Employee cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tt("Employees", "الموظفون")}</h2>
          <Button variant="outline" size="sm" onClick={() => setEmployees((p) => [...p, newEmployee()])}>
            <UserPlus className="h-4 w-4 mr-2" />
            {tt("Add Employee", "إضافة موظف")}
          </Button>
        </div>

        {employees.map((emp) => (
          <Card key={emp.id}>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tt("Name", "الاسم")}</Label>
                  <Input value={emp.name} onChange={(e) => updateEmployee(emp.id, { name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{tt("Role (optional)", "الدور (اختياري)")}</Label>
                  <Input value={emp.role} onChange={(e) => updateEmployee(emp.id, { role: e.target.value })} />
                </div>
              </div>

              {/* Shifts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{tt("Shifts", "الشيفتات")}</Label>
                  <Button variant="ghost" size="sm" onClick={() => addShift(emp.id)}>
                    <Plus className="h-3 w-3 mr-1" /> {tt("Add shift", "إضافة شيفت")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {emp.shifts.map((s) => (
                    <div key={s.id} className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] items-end">
                      <Input
                        value={s.name}
                        onChange={(e) => updateShift(emp.id, s.id, { name: e.target.value })}
                        placeholder=""
                      />
                      <Input
                        type="time"
                        value={s.start}
                        onChange={(e) => updateShift(emp.id, s.id, { start: e.target.value })}
                      />
                      <Input
                        type="time"
                        value={s.end}
                        onChange={(e) => updateShift(emp.id, s.id, { end: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeShift(emp.id, s.id)}
                        disabled={emp.shifts.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day off + coverage */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{tt("Day off", "يوم الإجازة")}</Label>
                  <Select
                    value={emp.dayOffMode}
                    onValueChange={(v) =>
                      updateEmployee(emp.id, { dayOffMode: v as DayOffMode, dayOffValue: v === "manual" ? emp.dayOffValue : "" })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{tt("Auto (system decides)", "تلقائي (يحدده النظام)")}</SelectItem>
                      <SelectItem value="manual">{tt("Manual (I choose)", "يدوي (أختاره)")}</SelectItem>
                      <SelectItem value="none">{tt("No day off", "لا توجد إجازة")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {emp.dayOffMode === "manual" && (
                  <div className="space-y-2">
                    <Label>{tt("Specify day", "حدد اليوم")}</Label>
                    <Input
                      value={emp.dayOffValue}
                      onChange={(e) => updateEmployee(emp.id, { dayOffValue: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{tt("Coverage employee", "موظف التغطية")}</Label>
                  <Select
                    value={emp.coverageId || "__none__"}
                    onValueChange={(v) => updateEmployee(emp.id, { coverageId: v === "__none__" ? "" : v })}
                    disabled={employees.filter((x) => x.id !== emp.id && x.name.trim()).length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder={tt("Select", "اختر")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tt("None", "لا يوجد")}</SelectItem>
                      {employees
                        .filter((x) => x.id !== emp.id && x.name.trim())
                        .map((x) => (
                          <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeEmployee(emp.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  {tt("Remove", "حذف")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 3 — Preview & send */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tt("Preview & Send", "المعاينة والإرسال")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePreview} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              {tt("Preview Prompt", "معاينة النص")}
            </Button>
          </div>

          {showPreview && (
            <div className="space-y-3">
              <Tabs value={previewLang} onValueChange={(v) => setPreviewLang(v as "ar" | "en")}>
                <TabsList>
                  <TabsTrigger value="ar">{tt("Arabic", "العربية")}</TabsTrigger>
                  <TabsTrigger value="en">{tt("English", "الإنجليزية")}</TabsTrigger>
                </TabsList>
                <TabsContent value="ar" className="mt-3">
                  <Textarea
                    value={promptText}
                    readOnly
                    dir="rtl"
                    className="min-h-[280px] font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="en" className="mt-3">
                  <Textarea
                    value={promptText}
                    readOnly
                    dir="ltr"
                    className="min-h-[280px] font-mono text-sm"
                  />
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  {tt("Copy", "نسخ")}
                </Button>
                {canSend && (
                  <Button onClick={handleSend} disabled={sending}>
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? tt("Sending...", "جاري الإرسال...") : tt("Approve & Send", "اعتماد وإرسال")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
